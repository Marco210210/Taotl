import { useCallback, useEffect, useState } from "react";

import { createPlayer, fetchRoster, updatePlayerName, uploadPlayerPhoto } from "@/api/players";
import type { Player } from "@/game/types";

export function useRoster() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchRoster();
    setPlayers(result.players);
    setFromCache(result.fromCache);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addPlayer = useCallback(async (name: string) => {
    const player = await createPlayer(name);
    setPlayers((prev) => [...prev, player]);
    return player;
  }, []);

  const renamePlayer = useCallback(async (id: string, name: string) => {
    await updatePlayerName(id, name);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const setPlayerPhoto = useCallback(async (id: string, localUri: string) => {
    const url = await uploadPlayerPhoto(id, localUri);
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, photoUri: url } : p)));
  }, []);

  return { players, loading, fromCache, reload, addPlayer, renamePlayer, setPlayerPhoto };
}
