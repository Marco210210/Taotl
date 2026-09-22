import { apiClient } from "@/api/client";
export interface AdminAccountDTO {
  id: string;
  handle: string;
  displayName: string;
  firstName: string;
  lastName: string;
  linkedPlayerId: string | null;
}

// Riservate all'admin: il backend verifica il token di sessione (require_admin).
export function addManualGame(
  adminToken: string,
  input: {
    players: string[];
    winnerId: string;
    winnerOnly?: boolean;
    playedAt?: string;
    scores?: { playerId: string; score: number }[];
    leaderboardId: string;
  },
): Promise<{ id: string }> {
  return apiClient.postAuthenticated<{ id: string }>("/taotl/admin/games/", adminToken, input);
}

export function fetchAdminAccounts(adminToken: string): Promise<AdminAccountDTO[]> {
  return apiClient.getAuthenticated<AdminAccountDTO[]>("/taotl/admin/accounts/", adminToken);
}

export function linkAccountToPlayer(
  adminToken: string,
  input: { accountId: string; playerId: string },
): Promise<void> {
  return apiClient.postAuthenticated<void>("/taotl/admin/link-player/", adminToken, input);
}

export async function deletePlayer(id: string, token: string): Promise<void> {
  await apiClient.deleteAuthenticated(`/players/${encodeURIComponent(id)}`, token);
}
export async function deleteFinishedGame(id: string, token: string): Promise<void> {
  await apiClient.deleteAuthenticated(`/taotl/games/${encodeURIComponent(id)}`, token);
}
