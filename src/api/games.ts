import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ActiveGame } from "@/game/types";
import { STORAGE_KEYS } from "@/state/storageKeys";

import { completeGameRoom } from "./auth";
import { apiClient } from "./client";
import { FALLBACK_REQUEST_TIMEOUT_MS, getApiBaseUrl } from "./config";
import { toGameHistoryDetail, toGameSyncPayload } from "./types";
import type { GameHistoryDetailDTO, GameHistorySummaryDTO, GameSyncPayload } from "./types";

const LOCAL_HISTORY_KEY = `${STORAGE_KEYS.rosterCache}:history-fallback`;
const LOCAL_HISTORY_DETAILS_KEY = `${STORAGE_KEYS.rosterCache}:history-details`;

async function readLocalDetails(): Promise<Record<string, GameHistoryDetailDTO>> {
  const raw = await AsyncStorage.getItem(LOCAL_HISTORY_DETAILS_KEY);
  return raw ? (JSON.parse(raw) as Record<string, GameHistoryDetailDTO>) : {};
}

// Esportata: usata anche quando l'utente sceglie di non salvare la partita
// nell'albo condiviso (resta comunque visibile nello storico su questo
// telefono, ma senza tentare la sync col server).
export async function cacheFinishedGame(game: ActiveGame): Promise<void> {
  const detail = toGameHistoryDetail(game);
  const raw = await AsyncStorage.getItem(LOCAL_HISTORY_KEY);
  const local: GameHistorySummaryDTO[] = raw ? JSON.parse(raw) : [];
  const summaries = [detail, ...local.filter((entry) => entry.id !== detail.id)];
  const details = await readLocalDetails();
  details[detail.id] = detail;
  await Promise.all([
    AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(summaries)),
    AsyncStorage.setItem(LOCAL_HISTORY_DETAILS_KEY, JSON.stringify(details)),
  ]);
}

// Coda delle partite finite che non sono ancora state inviate al server (rete
// assente al momento della fine partita). Alla riapertura dell'app, se il
// backend è raggiungibile, si propone di aggiungerle ora (vedi app/index.tsx).
async function readPendingSyncPayloads(): Promise<GameSyncPayload[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.pendingSyncGames);
  return raw ? (JSON.parse(raw) as GameSyncPayload[]) : [];
}

async function writePendingSyncPayloads(payloads: GameSyncPayload[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.pendingSyncGames, JSON.stringify(payloads));
}

async function addPendingSyncPayload(payload: GameSyncPayload): Promise<void> {
  const existing = await readPendingSyncPayloads();
  await writePendingSyncPayloads([payload, ...existing.filter((entry) => entry.id !== payload.id)]);
}

async function removePendingSyncPayload(id: string): Promise<void> {
  const existing = await readPendingSyncPayloads();
  await writePendingSyncPayloads(existing.filter((entry) => entry.id !== id));
}

export async function fetchPendingSyncGames(): Promise<GameSyncPayload[]> {
  return readPendingSyncPayloads();
}

// Ritenta l'invio delle partite rimaste solo locali. sync_game lato server è
// idempotente (MERGE su games + delete/reinsert su rounds/bids), quindi
// ri-POSTare lo stesso payload più volte è sicuro.
export async function retryPendingSyncGames(): Promise<{ succeeded: string[]; failed: string[] }> {
  const pending = await readPendingSyncPayloads();
  const succeeded: string[] = [];
  const failed: string[] = [];
  for (const payload of pending) {
    try {
      await apiClient.post<void>("/taotl/games/", payload);
      succeeded.push(payload.id);
    } catch {
      failed.push(payload.id);
    }
  }
  if (succeeded.length > 0) {
    await writePendingSyncPayloads(pending.filter((entry) => !succeeded.includes(entry.id)));
  }
  return { succeeded, failed };
}

// Invia la partita conclusa al backend in un'unica chiamata. Se il server non è
// raggiungibile, la partita resta comunque salvata in locale (lo storico la mostrerà
// come "solo su questo telefono" finché non si potrà ritentare la sincronizzazione).
export interface FinishedGameSyncResult {
  synced: boolean;
  verification: "not-requested" | "verified" | "failed";
  verifiedCount: number;
  unmatchedCount: number;
}

export async function syncFinishedGame(
  game: ActiveGame,
  verifiedRoom?: { token: string; roomId: string },
  tieBreakWinnerId?: string | null,
): Promise<FinishedGameSyncResult> {
  const payload = toGameSyncPayload(game, tieBreakWinnerId);
  await cacheFinishedGame(game);
  try {
    await apiClient.post<void>("/taotl/games/", payload);
    await removePendingSyncPayload(payload.id);
  } catch {
    await addPendingSyncPayload(payload);
    return {
      synced: false,
      verification: "not-requested",
      verifiedCount: 0,
      unmatchedCount: 0,
    };
  }

  if (!verifiedRoom) {
    return {
      synced: true,
      verification: "not-requested",
      verifiedCount: 0,
      unmatchedCount: 0,
    };
  }

  try {
    const result = await completeGameRoom(verifiedRoom.token, verifiedRoom.roomId, game.id);
    return {
      synced: true,
      verification: "verified",
      verifiedCount: result.verifiedCount,
      unmatchedCount: result.unmatchedCount,
    };
  } catch {
    return {
      synced: true,
      verification: "failed",
      verifiedCount: 0,
      unmatchedCount: 0,
    };
  }
}

export async function fetchHistory(): Promise<{ games: GameHistorySummaryDTO[]; fromCache: boolean }> {
  try {
    const games = await apiClient.get<GameHistorySummaryDTO[]>("/taotl/games/", FALLBACK_REQUEST_TIMEOUT_MS);
    await AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(games));
    return { games, fromCache: false };
  } catch {
    const raw = await AsyncStorage.getItem(LOCAL_HISTORY_KEY);
    const games: GameHistorySummaryDTO[] = raw ? JSON.parse(raw) : [];
    return { games, fromCache: true };
  }
}

export async function fetchGameHistoryDetail(id: string): Promise<{ game: GameHistoryDetailDTO; fromCache: boolean }> {
  try {
    const game = await apiClient.get<GameHistoryDetailDTO>(`/taotl/games/${id}`, FALLBACK_REQUEST_TIMEOUT_MS);
    const details = await readLocalDetails();
    details[id] = game;
    await AsyncStorage.setItem(LOCAL_HISTORY_DETAILS_KEY, JSON.stringify(details));
    return { game, fromCache: false };
  } catch (error) {
    const details = await readLocalDetails();
    const game = details[id];
    if (game) return { game, fromCache: true };
    throw error;
  }
}

// Riservata all'admin: il backend verifica il token di sessione (vedi require_admin
// lato server).
export async function deleteFinishedGame(id: string, adminToken: string): Promise<void> {
  if (getApiBaseUrl()) {
    await apiClient.deleteAuthenticated<void>(`/taotl/games/${id}`, adminToken);
  }
  const raw = await AsyncStorage.getItem(LOCAL_HISTORY_KEY);
  const summaries: GameHistorySummaryDTO[] = raw ? JSON.parse(raw) : [];
  const details = await readLocalDetails();
  delete details[id];
  await Promise.all([
    AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(summaries.filter((game) => game.id !== id))),
    AsyncStorage.setItem(LOCAL_HISTORY_DETAILS_KEY, JSON.stringify(details)),
  ]);
}
