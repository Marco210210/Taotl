import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import type { GameMode, Player } from "@/game/types";
import { readSetupDraft, writeSetupDraft } from "./setupDraft";

interface SetupContextValue {
  leaderboardId: string | null;
  leaderboardName: string;
  selectedPlayers: Player[];
  mode: GameMode | null;
  dealerId: string | null;
  setLeaderboard: (id: string | null, name?: string) => void;
  togglePlayer: (player: Player) => void;
  movePlayer: (fromIndex: number, toIndex: number) => void;
  setMode: (mode: GameMode) => void;
  setDealerId: (playerId: string) => void;
  reset: () => void;
}

const SetupContext = createContext<SetupContextValue | null>(null);

export function SetupProvider({ children }: PropsWithChildren) {
  const [draft] = useState(readSetupDraft);
  const [leaderboardId, setLeaderboardId] = useState<string | null>(draft?.leaderboardId ?? null);
  const [leaderboardName, setLeaderboardName] = useState(draft?.leaderboardName ?? "");
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>(draft?.selectedPlayers ?? []);
  const [mode, setModeState] = useState<GameMode | null>(draft?.mode ?? null);
  const [dealerId, setDealerIdState] = useState<string | null>(draft?.dealerId ?? null);

  useEffect(() => {
    writeSetupDraft({ leaderboardId, leaderboardName, selectedPlayers, mode, dealerId });
  }, [leaderboardId, leaderboardName, selectedPlayers, mode, dealerId]);

  const togglePlayer = useCallback((player: Player) => {
    setSelectedPlayers((prev) => {
      const exists = prev.some((p) => p.id === player.id);
      if (exists) return prev.filter((p) => p.id !== player.id);
      return [...prev, player];
    });
  }, []);

  const setMode = useCallback((next: GameMode) => setModeState(next), []);
  const setDealerId = useCallback((playerId: string) => setDealerIdState(playerId), []);
  const setLeaderboard = useCallback((id: string | null, name = "") => {
    setLeaderboardId(id);
    setLeaderboardName(name);
    setSelectedPlayers([]);
    setModeState(null);
    setDealerIdState(null);
  }, []);

  const movePlayer = useCallback((fromIndex: number, toIndex: number) => {
    setSelectedPlayers((previous) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= previous.length ||
        toIndex >= previous.length
      ) {
        return previous;
      }
      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setLeaderboardId(null);
    setLeaderboardName("");
    setSelectedPlayers([]);
    setModeState(null);
    setDealerIdState(null);
  }, []);

  const value = useMemo<SetupContextValue>(
    () => ({ leaderboardId, leaderboardName, selectedPlayers, mode, dealerId, setLeaderboard, togglePlayer, movePlayer, setMode, setDealerId, reset }),
    [leaderboardId, leaderboardName, selectedPlayers, mode, dealerId, setLeaderboard, togglePlayer, movePlayer, setMode, setDealerId, reset]
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error("useSetup deve essere usato dentro <SetupProvider>.");
  return ctx;
}
