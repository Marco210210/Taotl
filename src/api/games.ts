import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ActiveGame } from "@/game/types";
import { STORAGE_KEYS } from "@/state/storageKeys";

import { apiClient } from "./client";
import { getApiBaseUrl } from "./config";
import { toGameHistoryDetail, toGameSyncPayload } from "./types";
import type { GameHistoryDetailDTO, GameHistorySummaryDTO } from "./types";

const LOCAL_HISTORY_KEY = `${STORAGE_KEYS.rosterCache}:history-fallback`;
const LOCAL_HISTORY_DETAILS_KEY = `${STORAGE_KEYS.rosterCache}:history-details`;

async function readLocalDetails(): Promise<Record<string, GameHistoryDetailDTO>> {
  const raw = await AsyncStorage.getItem(LOCAL_HISTORY_DETAILS_KEY);
  return raw ? (JSON.parse(raw) as Record<string, GameHistoryDetailDTO>) : {};
}

async function cacheFinishedGame(game: ActiveGame): Promise<void> {
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

// Invia la partita conclusa al backend in un'unica chiamata. Se il server non è
// raggiungibile, la partita resta comunque salvata in locale (lo storico la mostrerà
// come "solo su questo telefono" finché non si potrà ritentare la sincronizzazione).
export async function syncFinishedGame(game: ActiveGame): Promise<{ synced: boolean }> {
  const payload = toGameSyncPayload(game);
  await cacheFinishedGame(game);
  try {
    await apiClient.post<void>("/taotl/games/", payload);
    return { synced: true };
  } catch {
    return { synced: false };
  }
}

export async function fetchHistory(): Promise<{ games: GameHistorySummaryDTO[]; fromCache: boolean }> {
  try {
    const games = await apiClient.get<GameHistorySummaryDTO[]>("/taotl/games");
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
    const game = await apiClient.get<GameHistoryDetailDTO>(`/taotl/games/${id}`);
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

export async function deleteFinishedGame(id: string): Promise<void> {
  if (getApiBaseUrl()) {
    await apiClient.delete<void>(`/taotl/games/${id}`);
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
