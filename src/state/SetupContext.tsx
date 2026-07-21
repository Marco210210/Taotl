import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import type { GameMode, Player } from "@/game/types";

interface SetupContextValue {
  selectedPlayers: Player[];
  mode: GameMode | null;
  togglePlayer: (player: Player) => void;
  setMode: (mode: GameMode) => void;
  reset: () => void;
}

const SetupContext = createContext<SetupContextValue | null>(null);

export function SetupProvider({ children }: PropsWithChildren) {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [mode, setModeState] = useState<GameMode | null>(null);

  const togglePlayer = useCallback((player: Player) => {
    setSelectedPlayers((prev) => {
      const exists = prev.some((p) => p.id === player.id);
      if (exists) return prev.filter((p) => p.id !== player.id);
      return [...prev, player];
    });
  }, []);

  const setMode = useCallback((next: GameMode) => setModeState(next), []);

  const reset = useCallback(() => {
    setSelectedPlayers([]);
    setModeState(null);
  }, []);

  const value = useMemo<SetupContextValue>(
    () => ({ selectedPlayers, mode, togglePlayer, setMode, reset }),
    [selectedPlayers, mode, togglePlayer, setMode, reset]
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error("useSetup deve essere usato dentro <SetupProvider>.");
  return ctx;
}
