import { useCallback, useEffect, useState } from "react";

import { createPlayer, deletePlayer, fetchRoster, updatePlayerName, uploadPlayerPhoto } from "@/api/players";
import type { Player } from "@/game/types";
import { useAccount } from "@/state/AccountContext";

export function useRoster() {
  const { token } = useAccount();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchRoster(token);
    setPlayers(result.players);
    setFromCache(result.fromCache);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addPlayer = useCallback(async (name: string) => {
    const player = await createPlayer(name, token);
    setPlayers((prev) => [...prev, player]);
    return player;
  }, [token]);

  const renamePlayer = useCallback(async (id: string, name: string) => {
    await updatePlayerName(id, name, token);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, [token]);

  const setPlayerPhoto = useCallback(async (id: string, localUri: string, contentType?: string) => {
    const url = await uploadPlayerPhoto(id, localUri, contentType, token);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, photoUri: url } : p)));
  }, [token]);

  const removePlayer = useCallback(async (id: string, adminToken: string) => {
    await deletePlayer(id, adminToken);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { players, loading, fromCache, reload, addPlayer, renamePlayer, setPlayerPhoto, removePlayer };
}
