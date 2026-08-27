import { useCallback, useEffect, useState } from "react";

import { createPlayer, deletePlayer, fetchRoster, updatePlayerName, uploadPlayerPhoto } from "@/api/players";
import type { Player } from "@/game/types";
import { useAccount } from "@/state/AccountContext";

export function useRoster(leaderboardId?: string | null, enabled = true) {
  const { token } = useAccount();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      setPlayers([]);
      setFromCache(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchRoster(token, leaderboardId);
    setPlayers(result.players);
    setFromCache(result.fromCache);
    setLoading(false);
  }, [enabled, leaderboardId, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addPlayer = useCallback(async (name: string) => {
    const player = await createPlayer(name, token, leaderboardId);
    setPlayers((prev) => [...prev, player]);
    return player;
  }, [leaderboardId, token]);

  const renamePlayer = useCallback(async (id: string, name: string) => {
    await updatePlayerName(id, name, token, leaderboardId);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, [leaderboardId, token]);

  const setPlayerPhoto = useCallback(async (id: string, localUri: string, contentType?: string) => {
    const url = await uploadPlayerPhoto(id, localUri, contentType, token, leaderboardId);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, photoUri: url } : p)));
  }, [leaderboardId, token]);

  const removePlayer = useCallback(async (id: string, adminToken: string) => {
    await deletePlayer(id, adminToken);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { players, loading, fromCache, reload, addPlayer, renamePlayer, setPlayerPhoto, removePlayer };
}
