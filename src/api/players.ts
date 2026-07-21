import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Player } from "@/game/types";
import { STORAGE_KEYS } from "@/state/storageKeys";
import { generateId } from "@/utils/id";

import { apiClient, photoUrlForPlayer } from "./client";
import type { PlayerDTO } from "./types";

async function readCache(): Promise<Player[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.rosterCache);
  return raw ? (JSON.parse(raw) as Player[]) : [];
}

async function writeCache(players: Player[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.rosterCache, JSON.stringify(players));
}

function fromDTO(dto: PlayerDTO): Player {
  return { id: dto.id, name: dto.name, photoUri: dto.hasPhoto ? photoUrlForPlayer(dto.id) : null };
}

// Prova il backend; se non è raggiungibile usa/aggiorna la cache locale, così la rubrica
// resta sempre utilizzabile anche prima che il server Oracle sia online.
export async function fetchRoster(): Promise<{ players: Player[]; fromCache: boolean }> {
  try {
    const dtos = await apiClient.get<PlayerDTO[]>("/players");
    const players = dtos.map(fromDTO);
    await writeCache(players);
    return { players, fromCache: false };
  } catch {
    return { players: await readCache(), fromCache: true };
  }
}

export async function createPlayer(name: string): Promise<Player> {
  const player: Player = { id: generateId("player"), name: name.trim(), photoUri: null };
  try {
    await apiClient.post<PlayerDTO>("/players", { id: player.id, name: player.name });
  } catch {
    // resta salvato solo in locale: verrà comunque usato nella rubrica.
  }
  const cache = await readCache();
  await writeCache([...cache, player]);
  return player;
}

export async function updatePlayerName(id: string, name: string): Promise<void> {
  try {
    await apiClient.put<void>(`/players/${id}`, { name: name.trim() });
  } catch {
    // ignorato: la modifica locale sotto è comunque applicata.
  }
  const cache = await readCache();
  await writeCache(cache.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
}

export async function uploadPlayerPhoto(id: string, localUri: string): Promise<string | null> {
  try {
    const fileResponse = await fetch(localUri);
    const blob = await fileResponse.blob();
    const contentType = blob.type || "image/jpeg";
    await apiClient.putBinary<void>(`/players/${id}/photo`, blob, contentType);
    const url = photoUrlForPlayer(id);
    const cache = await readCache();
    await writeCache(cache.map((p) => (p.id === id ? { ...p, photoUri: url } : p)));
    return url;
  } catch {
    // Senza backend la foto non può essere resa persistente lato server: la teniamo
    // comunque in cache locale usando l'URI del file scelto, per questa sessione.
    const cache = await readCache();
    await writeCache(cache.map((p) => (p.id === id ? { ...p, photoUri: localUri } : p)));
    return localUri;
  }
}
