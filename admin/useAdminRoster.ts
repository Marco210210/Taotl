import { useRoster } from "@/state/useRoster";
import { deletePlayer } from "./api";

export function useAdminRoster(leaderboardId?: string | null) {
  const roster = useRoster(leaderboardId);
  return {
    ...roster,
    removePlayer: async (id: string, token: string) => {
      await deletePlayer(id, token);
      await roster.reload();
    },
  };
}
