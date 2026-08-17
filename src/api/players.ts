import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import type { Player } from "@/game/types";
import { reportError } from "@/monitoring/errorReporter";
import { STORAGE_KEYS } from "@/state/storageKeys";
import { generateId } from "@/utils/id";

import { apiClient, photoUrlForPlayer } from "./client";
import { FALLBACK_REQUEST_TIMEOUT_MS, getApiBaseUrl, getAppKey } from "./config";
import type { PlayerDTO } from "./types";

async function readCache(): Promise<Player[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.rosterCache);
  return raw ? (JSON.parse(raw) as Player[]) : [];
}

async function writeCache(players: Player[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.rosterCache, JSON.stringify(players));
}

function fromDTO(dto: PlayerDTO): Player {
  return {
    id: dto.id,
    name: dto.name,
    photoUri: dto.hasPhoto ? photoUrlForPlayer(dto.id, Date.now()) : null,
  };
}

// Prova il backend; se non è raggiungibile usa/aggiorna la cache locale, così la rubrica
// resta sempre utilizzabile anche prima che il server Oracle sia online.
export async function fetchRoster(): Promise<{ players: Player[]; fromCache: boolean }> {
  try {
    const dtos = await apiClient.get<PlayerDTO[]>("/players/", FALLBACK_REQUEST_TIMEOUT_MS);
    const players = dtos.map(fromDTO);
    await writeCache(players);
    return { players, fromCache: false };
  } catch {
    return { players: await readCache(), fromCache: true };
  }
}

export async function createPlayer(name: string): Promise<Player> {
  const player: Player = { id: generateId("player"), name: name.trim(), photoUri: null };
  if (getApiBaseUrl()) {
    await apiClient.post<PlayerDTO>("/players/", { id: player.id, name: player.name });
  }
  const cache = await readCache();
  await writeCache([...cache, player]);
  return player;
}

export async function updatePlayerName(id: string, name: string): Promise<void> {
  if (getApiBaseUrl()) {
    await apiClient.put<void>(`/players/${id}`, { name: name.trim() });
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
): Promise<string | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    const cache = await readCache();
    await writeCache(cache.map((p) => (p.id === id ? { ...p, photoUri: localUri } : p)));
    return localUri;
  }

  if (Platform.OS === "web") {
    const localResponse = await fetch(localUri);
    const blob = await localResponse.blob();
    await apiClient.putBinary<void>(`/players/${id}/photo`, blob, blob.type || contentType);
  } else {
    const appKey = getAppKey();
    const response = await FileSystem.uploadAsync(`${baseUrl}/players/${id}/photo`, localUri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        ...(appKey ? { "X-App-Key": appKey } : {}),
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

  const url = photoUrlForPlayer(id, Date.now());
  const cache = await readCache();
  await writeCache(cache.map((p) => (p.id === id ? { ...p, photoUri: url } : p)));
  return url;
}
