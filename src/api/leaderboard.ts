import { apiClient } from "./client";

export interface LeaderboardEntryDTO {
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  rateWins: number;
}

export interface AdminAccountDTO {
  id: string;
  handle: string;
  displayName: string;
  linkedPlayerId: string | null;
}

export function fetchLeaderboard(): Promise<LeaderboardEntryDTO[]> {
  return apiClient.get<LeaderboardEntryDTO[]>("/taotl/leaderboard");
}

// Riservate all'admin: il backend verifica il token di sessione (require_admin).
export function addManualGame(
  adminToken: string,
  input: { players: string[]; winnerId: string; winnerOnly?: boolean; playedAt?: string },
): Promise<{ id: string }> {
  return apiClient.postAuthenticated<{ id: string }>("/taotl/admin/games/", adminToken, input);
}

export function fetchAdminAccounts(adminToken: string): Promise<AdminAccountDTO[]> {
  return apiClient.getAuthenticated<AdminAccountDTO[]>("/taotl/admin/accounts", adminToken);
}

export function linkAccountToPlayer(
  adminToken: string,
  input: { accountId: string; playerId: string },
): Promise<void> {
  return apiClient.postAuthenticated<void>("/taotl/admin/link-player/", adminToken, input);
}
