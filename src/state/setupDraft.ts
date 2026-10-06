import type { GameMode, Player } from "@/game/types";

export interface SetupDraft {
  leaderboardId: string | null;
  leaderboardName: string;
  selectedPlayers: Player[];
  mode: GameMode | null;
  dealerId: string | null;
}

// Expo Go continua a conservare la preparazione soltanto in memoria.
export function readSetupDraft(): SetupDraft | null { return null; }
export function writeSetupDraft(_draft: SetupDraft): void {}
