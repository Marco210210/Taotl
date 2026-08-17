import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { Platform } from "react-native";

import {
  confirmPasswordReset,
  createGameRoom,
  fetchGameRoom,
  fetchMyAccount,
  joinGameRoom,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestPasswordReset,
  type AccountDTO,
  type GameRoomDTO,
} from "@/api/auth";
import { FALLBACK_REQUEST_TIMEOUT_MS } from "@/api/config";
import { ApiRequestError } from "@/api/client";

const SESSION_KEY = "taotl.auth-session.v1";
const ROOM_KEY = "taotl.verified-room.v1";
const ACCOUNT_CACHE_KEY = "taotl.account-cache.v1";

interface AccountContextValue {
  account: AccountDTO | null;
  token: string | null;
  room: GameRoomDTO | null;
  loading: boolean;
  authError: string | null;
  register: (input: {
    handle: string;
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  login: (handle: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestReset: (handle: string, email: string) => Promise<{ message: string }>;
  confirmReset: (token: string, password: string) => Promise<void>;
  createRoom: () => Promise<GameRoomDTO>;
  joinRoom: (code: string) => Promise<GameRoomDTO>;
  refreshRoom: () => Promise<void>;
  clearRoom: () => Promise<void>;
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
    void (async () => {
      try {
        const [storedToken, storedRoomId, cachedRaw] = await Promise.all([
          readSecret(),
          AsyncStorage.getItem(ROOM_KEY),
          AsyncStorage.getItem(ACCOUNT_CACHE_KEY),
        ]);
        if (!storedToken) return;

        let cachedAccount: AccountDTO | null = null;
        if (cachedRaw) {
          try {
            cachedAccount = JSON.parse(cachedRaw) as AccountDTO;
          } catch {
            await AsyncStorage.removeItem(ACCOUNT_CACHE_KEY);
          }
        }
        if (active && cachedAccount) {
          // Mostra subito il profilo noto: l'aggiornamento dal server avviene
          // in sottofondo e non blocca l'apertura su rete lenta o estera.
          setToken(storedToken);
          setAccount(cachedAccount);
          setLoading(false);
        }

        try {
          const nextAccount = await fetchMyAccount(storedToken, FALLBACK_REQUEST_TIMEOUT_MS);
          if (!active) return;
          setToken(storedToken);
          setAccount(nextAccount);
          await AsyncStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(nextAccount));

          if (storedRoomId) {
            try {
              const nextRoom = await fetchGameRoom(storedToken, storedRoomId, FALLBACK_REQUEST_TIMEOUT_MS);
              if (!active) return;
              if (nextRoom.status === "open") setRoom(nextRoom);
              else await AsyncStorage.removeItem(ROOM_KEY);
            } catch {
              // Una rete assente non deve cancellare la stanza né rallentare
              // l'avvio. Verrà aggiornata quando l'utente la riapre.
            }
          }
        } catch (error) {
          // Si elimina la sessione solo se il server la dichiara davvero non
          // valida; timeout/aereo/rete estera conservano account e token.
          if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
            await Promise.all([writeSecret(null), AsyncStorage.removeItem(ACCOUNT_CACHE_KEY)]);
            if (active) {
              setToken(null);
              setAccount(null);
            }
          }
        }
      } catch {
        // Cache locale corrotta: l'app resta utilizzabile come ospite.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const acceptSession = useCallback(async (session: Awaited<ReturnType<typeof loginAccount>>) => {
    await Promise.all([
      writeSecret(session.token),
      AsyncStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(session.account)),
    ]);
    setToken(session.token);
    setAccount(session.account);
    setAuthError(null);
  }, []);

  const register = useCallback(async (input: {
    handle: string;
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => {
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

  const login = useCallback(async (handle: string, password: string) => {
    setLoading(true);
    try {
      await acceptSession(await loginAccount(handle, password));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Accesso non riuscito.";
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [acceptSession]);

  const requestReset = useCallback(async (handle: string, email: string) => {
    return requestPasswordReset(handle, email);
  }, []);

  const confirmReset = useCallback(async (token: string, password: string) => {
    setLoading(true);
    try {
      await acceptSession(await confirmPasswordReset(token, password));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset non riuscito.";
      setAuthError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [acceptSession]);

  const logout = useCallback(async () => {
    if (token) await logoutAccount(token).catch(() => {});
    await Promise.all([
      writeSecret(null),
      AsyncStorage.removeItem(ROOM_KEY),
      AsyncStorage.removeItem(ACCOUNT_CACHE_KEY),
    ]);
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
    const nextRoom = await fetchGameRoom(token, room.id);
    if (nextRoom.status === "open") {
      setRoom(nextRoom);
      return;
    }
    setRoom(null);
    await AsyncStorage.removeItem(ROOM_KEY);
  }, [room, token]);

  const clearRoom = useCallback(async () => {
    setRoom(null);
    await AsyncStorage.removeItem(ROOM_KEY);
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      account,
      token,
      room,
      loading,
      authError,
      register,
      login,
      logout,
      requestReset,
      confirmReset,
      createRoom,
      joinRoom,
      refreshRoom,
      clearRoom,
    }),
    [
      account, authError, clearRoom, confirmReset, createRoom, joinRoom, loading, login, logout,
      refreshRoom, register, requestReset, room, token,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used inside AccountProvider.");
  return context;
}
