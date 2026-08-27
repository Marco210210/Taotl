import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import type { Player } from "@/game/types";
import { reportError } from "@/monitoring/errorReporter";
import { STORAGE_KEYS } from "@/state/storageKeys";
import { generateId } from "@/utils/id";

import { apiClient } from "./client";
import { FALLBACK_REQUEST_TIMEOUT_MS, getApiBaseUrl } from "./config";
import type { PlayerDTO } from "./types";

async function readCache(): Promise<Player[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.rosterCache);
  return raw ? (JSON.parse(raw) as Player[]) : [];
}

async function writeCache(players: Player[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.rosterCache, JSON.stringify(players));
}

function fromDTO(dto: PlayerDTO, photoUri: string | null): Player {
  return {
    id: dto.id,
    name: dto.name,
    photoUri,
  };
}

async function fetchProtectedPhoto(id: string, token: string): Promise<string | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;
  const url = `${baseUrl}/players/${encodeURIComponent(id)}/photo`;
  try {
    if (Platform.OS === "web") {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return null;
      return URL.createObjectURL(await response.blob());
    }
    const directory = FileSystem.cacheDirectory;
    if (!directory) return null;
    const result = await FileSystem.downloadAsync(url, `${directory}taotl-photo-${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return result.status >= 200 && result.status < 300 ? result.uri : null;
  } catch { return null; }
}

// Prova il backend; se non è raggiungibile usa/aggiorna la cache locale, così la rubrica
// resta sempre utilizzabile anche prima che il server Oracle sia online.
export async function fetchRoster(token?: string | null): Promise<{ players: Player[]; fromCache: boolean }> {
  try {
    if (!token) throw new Error("Rubrica locale");
    const dtos = await apiClient.getAuthenticated<PlayerDTO[]>("/players/", token, FALLBACK_REQUEST_TIMEOUT_MS);
    const players = await Promise.all(dtos.map(async (dto) => fromDTO(dto, dto.hasPhoto ? await fetchProtectedPhoto(dto.id, token) : null)));
    await writeCache(players);
    return { players, fromCache: false };
  } catch {
    return { players: await readCache(), fromCache: true };
  }
}

export async function createPlayer(name: string, token?: string | null): Promise<Player> {
  const player: Player = { id: generateId("player"), name: name.trim(), photoUri: null };
  if (getApiBaseUrl() && token) {
    await apiClient.postAuthenticated<PlayerDTO>("/players/", token, { id: player.id, name: player.name });
  }
  const cache = await readCache();
  await writeCache([...cache, player]);
  return player;
}

export async function updatePlayerName(id: string, name: string, token?: string | null): Promise<void> {
  if (getApiBaseUrl() && token) {
    await apiClient.putAuthenticated<void>(`/players/${id}`, token, { name: name.trim() });
  }
  const cache = await readCache();
  await writeCache(cache.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
}

// Riservata all'admin: il backend verifica il token di sessione (vedi require_admin
// lato server), non basta più la sola chiave app condivisa.
export async function deletePlayer(id: string, adminToken: string): Promise<void> {
  if (getApiBaseUrl()) {
    await apiClient.deleteAuthenticated<void>(`/players/${id}`, adminToken);
  }
  const cache = await readCache();
  await writeCache(cache.filter((p) => p.id !== id));
}

export async function uploadPlayerPhoto(
  id: string,
  localUri: string,
  contentType = "image/jpeg",
  token?: string | null,
): Promise<string | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl || !token) {
    const cache = await readCache();
    await writeCache(cache.map((p) => (p.id === id ? { ...p, photoUri: localUri } : p)));
    return localUri;
  }

  if (Platform.OS === "web") {
    const localResponse = await fetch(localUri);
    const blob = await localResponse.blob();
    await apiClient.putBinaryAuthenticated<void>(`/players/${id}/photo`, token, blob, blob.type || contentType);
  } else {
    const response = await FileSystem.uploadAsync(`${baseUrl}/players/${id}/photo`, localUri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
        Accept: "application/json",
      },
    }).catch((error) => {
      reportError("api.photoUpload", error, { path: `/players/${id}/photo`, method: "PUT" });
      throw error;
    });

    if (response.status < 200 || response.status >= 300) {
      const uploadError = new Error(`Caricamento della foto fallito (${response.status}).`);
      reportError("api.photoUpload", uploadError, { path: `/players/${id}/photo`, status: response.status });
      throw uploadError;
    }
  }

  const url = localUri;
  const cache = await readCache();
  await writeCache(cache.map((p) => (p.id === id ? { ...p, photoUri: url } : p)));
  return url;
}
