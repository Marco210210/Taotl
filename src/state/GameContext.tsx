import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { PropsWithChildren } from "react";

import type { ActiveGame, Bid, GameMode, Player, RoundPlayerResult } from "@/game/types";

import { gameReducer } from "./gameReducer";
import { getCurrentRoundInfo, getPreviousCardsDealt, getRankedPlayers, getTotals } from "./selectors";
import { STORAGE_KEYS } from "./storageKeys";

interface GameContextValue {
  game: ActiveGame | null;
  isHydrated: boolean;
  currentRoundInfo: ReturnType<typeof getCurrentRoundInfo>;
  previousCardsDealt: number | null;
  totals: Record<string, number>;
  ranked: { playerId: string; total: number }[];
  startGame: (mode: GameMode, players: Player[], startDealerId: string) => void;
  setPendingCards: (cardsDealt: number) => void;
  confirmBids: (bids: Bid[]) => void;
  confirmRoundResults: (results: RoundPlayerResult[]) => void;
  setCurrentDealer: (dealerId: string) => void;
  resetGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: PropsWithChildren) {
  const [game, dispatch] = useReducer(gameReducer, null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.activeGame);
        const stored: ActiveGame | null = raw ? JSON.parse(raw) : null;
        dispatch({ type: "HYDRATE", game: stored });
      } catch {
        dispatch({ type: "HYDRATE", game: null });
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (game) {
      AsyncStorage.setItem(STORAGE_KEYS.activeGame, JSON.stringify(game)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEYS.activeGame).catch(() => {});
    }
  }, [game, isHydrated]);

  const startGame = useCallback((mode: GameMode, players: Player[], startDealerId: string) => {
    dispatch({ type: "START_GAME", mode, players, startDealerId });
  }, []);

  const setPendingCards = useCallback((cardsDealt: number) => {
    dispatch({ type: "SET_PENDING_CARDS", cardsDealt });
  }, []);

  const confirmBids = useCallback((bids: Bid[]) => {
    dispatch({ type: "CONFIRM_BIDS", bids });
  }, []);

  const confirmRoundResults = useCallback((results: RoundPlayerResult[]) => {
    dispatch({ type: "CONFIRM_ROUND_RESULTS", results });
  }, []);

  const setCurrentDealer = useCallback((dealerId: string) => {
    dispatch({ type: "SET_CURRENT_DEALER", dealerId });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: "RESET_GAME" });
  }, []);

  const value = useMemo<GameContextValue>(() => {
    return {
      game,
      isHydrated,
      currentRoundInfo: game ? getCurrentRoundInfo(game) : null,
      previousCardsDealt: game ? getPreviousCardsDealt(game) : null,
      totals: game ? getTotals(game) : {},
      ranked: game ? getRankedPlayers(game) : [],
      startGame,
      setPendingCards,
      confirmBids,
      confirmRoundResults,
      setCurrentDealer,
      resetGame,
    };
  }, [game, isHydrated, startGame, setPendingCards, confirmBids, confirmRoundResults, setCurrentDealer, resetGame]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame deve essere usato dentro <GameProvider>.");
  }
  return ctx;
}
