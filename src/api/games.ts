import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ActiveGame } from "@/game/types";
import { getTotals } from "@/state/selectors";
import { STORAGE_KEYS } from "@/state/storageKeys";

import { apiClient } from "./client";
import { toGameSyncPayload } from "./types";
import type { GameHistorySummaryDTO } from "./types";

const LOCAL_HISTORY_KEY = `${STORAGE_KEYS.rosterCache}:history-fallback`;

// Invia la partita conclusa al backend in un'unica chiamata. Se il server non è
// raggiungibile, la partita resta comunque salvata in locale (lo storico la mostrerà
// come "solo su questo telefono" finché non si potrà ritentare la sincronizzazione).
export async function syncFinishedGame(game: ActiveGame): Promise<{ synced: boolean }> {
  const payload = toGameSyncPayload(game);
  try {
    await apiClient.post<void>("/taotl/games/", payload);
    return { synced: true };
  } catch {
    const raw = await AsyncStorage.getItem(LOCAL_HISTORY_KEY);
    const local: GameHistorySummaryDTO[] = raw ? JSON.parse(raw) : [];
    const totals = getTotals(game);
    const summary: GameHistorySummaryDTO = {
      id: game.id,
      mode: game.mode,
      numPlayers: game.players.length,
      startedAt: game.createdAt,
      endedAt: game.finishedAt,
      standings: game.players
        .map((p) => ({ playerId: p.id, name: p.name, total: totals[p.id] ?? 0 }))
        .sort((a, b) => b.total - a.total),
    };
    await AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify([summary, ...local]));
    return { synced: false };
  }
}

export async function fetchHistory(): Promise<{ games: GameHistorySummaryDTO[]; fromCache: boolean }> {
  try {
    const games = await apiClient.get<GameHistorySummaryDTO[]>("/taotl/games");
    return { games, fromCache: false };
  } catch {
    const raw = await AsyncStorage.getItem(LOCAL_HISTORY_KEY);
    const games: GameHistorySummaryDTO[] = raw ? JSON.parse(raw) : [];
    return { games, fromCache: true };
  }
}
