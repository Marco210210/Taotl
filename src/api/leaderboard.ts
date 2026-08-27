import { apiClient } from "./client";

export interface LeaderboardEntryDTO {
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  rateWins: number;
}

export interface LeaderboardDTO {
  id: string;
  name: string;
  createdAt: string;
  visibility: "private" | "public";
  role: "owner" | "manager" | "member" | "viewer" | "superadmin";
  canManage: boolean;
  canSubmit: boolean;
}

export interface AdminAccountDTO {
  id: string;
  handle: string;
  displayName: string;
  firstName: string;
  lastName: string;
  linkedPlayerId: string | null;
}

export function fetchLeaderboards(token: string): Promise<LeaderboardDTO[]> {
  return apiClient.getAuthenticated<LeaderboardDTO[]>("/taotl/leaderboards/", token);
}

export function createLeaderboard(token: string, name: string): Promise<LeaderboardDTO> {
  return apiClient.postAuthenticated<LeaderboardDTO>("/taotl/leaderboards/", token, { name: name.trim() });
}

export function renameLeaderboard(token: string, id: string, name: string): Promise<LeaderboardDTO> {
  return apiClient.putAuthenticated<LeaderboardDTO>(`/taotl/leaderboards/${encodeURIComponent(id)}/`, token, {
    name: name.trim(),
  });
}

export function fetchLeaderboard(token: string, leaderboardId: string): Promise<LeaderboardEntryDTO[]> {
  return apiClient.getAuthenticated<LeaderboardEntryDTO[]>(`/taotl/leaderboards/${encodeURIComponent(leaderboardId)}/`, token);
}

export interface LeaderboardInviteDTO { code: string; role: "manager" | "member" | "viewer"; expiresAt: string }
export interface LeaderboardMemberDTO { accountId: string; handle: string; displayName: string; role: "owner" | "manager" | "member" | "viewer"; playerId: string | null }
export interface ProfileLinkRequestDTO { id: string; leaderboardId: string; leaderboardName: string; playerId: string; playerName: string; targetAccountId: string; targetHandle: string; status: string; createdAt: string }

export function joinLeaderboard(token: string, code: string): Promise<LeaderboardDTO> {
  return apiClient.postAuthenticated<LeaderboardDTO>("/taotl/leaderboards/join/", token, { code: code.trim().toUpperCase() });
}
export function createLeaderboardInvite(token: string, id: string, role: "manager" | "member" | "viewer" = "member"): Promise<LeaderboardInviteDTO> {
  return apiClient.postAuthenticated<LeaderboardInviteDTO>(`/taotl/leaderboards/${encodeURIComponent(id)}/invites/`, token, { role });
}
export function fetchLeaderboardMembers(token: string, id: string): Promise<LeaderboardMemberDTO[]> {
  return apiClient.getAuthenticated<LeaderboardMemberDTO[]>(`/taotl/leaderboards/${encodeURIComponent(id)}/members/`, token);
}
export function updateLeaderboardMember(token: string, id: string, accountId: string, role: "manager" | "member" | "viewer"): Promise<void> {
  return apiClient.putAuthenticated<void>(`/taotl/leaderboards/${encodeURIComponent(id)}/members/`, token, { accountId, role });
}
export function removeLeaderboardMember(token: string, id: string, accountId: string): Promise<void> {
  return apiClient.deleteAuthenticated<void>(`/taotl/leaderboards/${encodeURIComponent(id)}/members/${encodeURIComponent(accountId)}`, token);
}
export function createProfileLinkRequest(token: string, id: string, handle: string, playerId: string): Promise<{ id: string; status: string }> {
  return apiClient.postAuthenticated(`/taotl/leaderboards/${encodeURIComponent(id)}/link-requests/`, token, { handle, playerId });
}
export function fetchProfileLinkRequests(token: string): Promise<ProfileLinkRequestDTO[]> {
  return apiClient.getAuthenticated<ProfileLinkRequestDTO[]>("/taotl/profile-link-requests/", token);
}
export function respondProfileLinkRequest(token: string, id: string, accept: boolean): Promise<{ id: string; status: string }> {
  return apiClient.postAuthenticated(`/taotl/profile-link-requests/${encodeURIComponent(id)}/respond/`, token, { accept });
}

export interface ManualGameDTO {
  id: string;
  leaderboardId?: string;
  playedAt: string;
  winnerId: string;
  winnerName: string;
  myScore: number | null;
  participants: { id: string; name: string }[];
}

// Partite manuali (senza round) in cui il giocatore è coinvolto. Questo endpoint
// serve la scheda giocatore; lo storico generale le include insieme alle altre.
export function fetchManualGames(token: string, playerId: string): Promise<ManualGameDTO[]> {
  return apiClient.getAuthenticated<ManualGameDTO[]>(`/taotl/players/${playerId}/manual-games`, token);
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
