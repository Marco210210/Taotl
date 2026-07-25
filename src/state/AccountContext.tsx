import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { Platform } from "react-native";

import {
  createGameRoom,
  fetchGameRoom,
  fetchMyAccount,
  joinGameRoom,
  loginAccount,
  logoutAccount,
  registerAccount,
  type AccountDTO,
  type GameRoomDTO,
} from "@/api/auth";

const SESSION_KEY = "taotl:auth-session:v1";
const ROOM_KEY = "taotl:verified-room:v1";

interface AccountContextValue {
  account: AccountDTO | null;
  room: GameRoomDTO | null;
  loading: boolean;
  authError: string | null;
  register: (input: { handle: string; displayName: string; pin: string }) => Promise<void>;
  login: (handle: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  createRoom: () => Promise<GameRoomDTO>;
  joinRoom: (code: string) => Promise<GameRoomDTO>;
  refreshRoom: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

async function readSecret(): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(SESSION_KEY);
  return SecureStore.getItemAsync(SESSION_KEY);
}

async function writeSecret(value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value) await AsyncStorage.setItem(SESSION_KEY, value);
    else await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }
  if (value) await SecureStore.setItemAsync(SESSION_KEY, value);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function AccountProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountDTO | null>(null);
  const [room, setRoom] = useState<GameRoomDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([readSecret(), AsyncStorage.getItem(ROOM_KEY)])
      .then(async ([storedToken, storedRoomId]) => {
        if (!storedToken) return;
        const nextAccount = await fetchMyAccount(storedToken);
        if (!active) return;
        setToken(storedToken);
        setAccount(nextAccount);
        if (storedRoomId) {
          const nextRoom = await fetchGameRoom(storedToken, storedRoomId).catch(() => null);
          if (active) setRoom(nextRoom);
        }
      })
      .catch(() => {
        void writeSecret(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const acceptSession = useCallback(async (session: Awaited<ReturnType<typeof loginAccount>>) => {
    await writeSecret(session.token);
    setToken(session.token);
    setAccount(session.account);
    setAuthError(null);
  }, []);

  const register = useCallback(async (input: { handle: string; displayName: string; pin: string }) => {
    setLoading(true);
    try {
      await acceptSession(await registerAccount(input));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registrazione non riuscita.";
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [acceptSession]);

  const login = useCallback(async (handle: string, pin: string) => {
    setLoading(true);
    try {
      await acceptSession(await loginAccount(handle, pin));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Accesso non riuscito.";
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [acceptSession]);

  const logout = useCallback(async () => {
    if (token) await logoutAccount(token).catch(() => {});
    await Promise.all([writeSecret(null), AsyncStorage.removeItem(ROOM_KEY)]);
    setToken(null);
    setAccount(null);
    setRoom(null);
    setAuthError(null);
  }, [token]);

  const createRoom = useCallback(async () => {
    if (!token) throw new Error("Accedi prima di creare una stanza.");
    const nextRoom = await createGameRoom(token);
    setRoom(nextRoom);
    await AsyncStorage.setItem(ROOM_KEY, nextRoom.id);
    return nextRoom;
  }, [token]);

  const joinRoom = useCallback(async (code: string) => {
    if (!token) throw new Error("Accedi prima di entrare in una stanza.");
    const nextRoom = await joinGameRoom(token, code);
    setRoom(nextRoom);
    await AsyncStorage.setItem(ROOM_KEY, nextRoom.id);
    return nextRoom;
  }, [token]);

  const refreshRoom = useCallback(async () => {
    if (!token || !room) return;
    setRoom(await fetchGameRoom(token, room.id));
  }, [room, token]);

  const value = useMemo<AccountContextValue>(
    () => ({
      account,
      room,
      loading,
      authError,
      register,
      login,
      logout,
      createRoom,
      joinRoom,
      refreshRoom,
    }),
    [account, authError, createRoom, joinRoom, loading, login, logout, refreshRoom, register, room],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used inside AccountProvider.");
  return context;
}
