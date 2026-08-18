import { apiClient } from "./client";

export interface AccountDTO {
  id: string;
  handle: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  linkedPlayerId: string | null;
  createdAt: string;
}

export interface AuthSessionDTO {
  token: string;
  expiresAt: string;
  account: AccountDTO;
}

export interface GameRoomParticipantDTO {
  userId: string;
  handle: string;
  displayName: string;
  isHost: boolean;
  joinedAt: string;
}

export interface GameRoomDTO {
  id: string;
  code: string;
  status: "open" | "playing" | "finished" | "cancelled";
  expiresAt: string;
  participants: GameRoomParticipantDTO[];
}

export interface CompleteGameRoomResultDTO {
  verifiedCount: number;
  unmatchedCount: number;
}

export function registerAccount(input: {
  handle: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<AuthSessionDTO> {
  return apiClient.post<AuthSessionDTO>("/taotl/auth/register/", input);
}

export function loginAccount(handle: string, password: string): Promise<AuthSessionDTO> {
  return apiClient.post<AuthSessionDTO>("/taotl/auth/login/", { handle, password });
}

export function requestPasswordReset(handle: string, email: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>("/taotl/auth/forgot-password/", { handle, email });
}

export function confirmPasswordReset(token: string, password: string): Promise<AuthSessionDTO> {
  return apiClient.post<AuthSessionDTO>("/taotl/auth/reset-password/", { token, password });
}

export function fetchMyAccount(token: string, timeoutMs?: number): Promise<AccountDTO> {
  return apiClient.getAuthenticated<AccountDTO>("/taotl/auth/me/", token, timeoutMs);
}

export function logoutAccount(token: string): Promise<void> {
  return apiClient.postAuthenticated<void>("/taotl/auth/logout/", token);
}

export function createGameRoom(token: string): Promise<GameRoomDTO> {
  return apiClient.postAuthenticated<GameRoomDTO>("/taotl/rooms/", token);
}

export function joinGameRoom(token: string, code: string): Promise<GameRoomDTO> {
  return apiClient.postAuthenticated<GameRoomDTO>("/taotl/rooms/join/", token, {
    code: code.trim().toUpperCase(),
  });
}

export function fetchGameRoom(token: string, roomId: string, timeoutMs?: number): Promise<GameRoomDTO> {
  return apiClient.getAuthenticated<GameRoomDTO>(`/taotl/rooms/${roomId}/`, token, timeoutMs);
}

export function completeGameRoom(
  token: string,
  roomId: string,
  gameId: string,
): Promise<CompleteGameRoomResultDTO> {
  return apiClient.postAuthenticated<CompleteGameRoomResultDTO>("/taotl/rooms/complete/", token, {
    roomId,
    gameId,
  });
}
