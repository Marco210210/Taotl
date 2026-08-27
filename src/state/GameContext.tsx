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
  startGame: (
    mode: GameMode,
    players: Player[],
    startDealerId: string,
    verifiedRoomId?: string | null,
    saveToAlbo?: boolean,
    leaderboardId?: string,
    leaderboardName?: string,
  ) => void;
  setPendingCards: (cardsDealt: number) => void;
  reopenCards: () => void;
  setBidDraft: (playerId: string, bid: number) => void;
  confirmBids: (bids: Bid[]) => void;
  reopenBids: () => void;
  setResultDraft: (playerId: string, respected: boolean | null, scarto: number) => void;
  confirmRoundResults: (results: RoundPlayerResult[]) => void;
  undoLastRound: () => void;
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

  const startGame = useCallback((
    mode: GameMode,
    players: Player[],
    startDealerId: string,
    verifiedRoomId?: string | null,
    saveToAlbo: boolean = false,
    leaderboardId: string = "",
    leaderboardName: string = "",
  ) => {
    dispatch({
      type: "START_GAME",
      mode,
      players,
      startDealerId,
      verifiedRoomId,
      saveToAlbo,
      leaderboardId,
      leaderboardName,
    });
  }, []);

  const setPendingCards = useCallback((cardsDealt: number) => {
    dispatch({ type: "SET_PENDING_CARDS", cardsDealt });
  }, []);

  const reopenCards = useCallback(() => {
    dispatch({ type: "REOPEN_CARDS" });
  }, []);

  const setBidDraft = useCallback((playerId: string, bid: number) => {
    dispatch({ type: "SET_BID_DRAFT", playerId, bid });
  }, []);

  const confirmBids = useCallback((bids: Bid[]) => {
    dispatch({ type: "CONFIRM_BIDS", bids });
  }, []);

  const reopenBids = useCallback(() => {
    dispatch({ type: "REOPEN_BIDS" });
  }, []);

  const setResultDraft = useCallback((playerId: string, respected: boolean | null, scarto: number) => {
    dispatch({ type: "SET_RESULT_DRAFT", playerId, respected, scarto });
  }, []);

  const confirmRoundResults = useCallback((results: RoundPlayerResult[]) => {
    dispatch({ type: "CONFIRM_ROUND_RESULTS", results });
  }, []);

  const undoLastRound = useCallback(() => {
    dispatch({ type: "UNDO_LAST_ROUND" });
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
      reopenCards,
      setBidDraft,
      confirmBids,
      reopenBids,
      setResultDraft,
      confirmRoundResults,
      undoLastRound,
      setCurrentDealer,
      resetGame,
    };
  }, [
    game, isHydrated, startGame, setPendingCards, reopenCards, setBidDraft, confirmBids, reopenBids,
    setResultDraft, confirmRoundResults, undoLastRound, setCurrentDealer, resetGame,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame deve essere usato dentro <GameProvider>.");
  }
  return ctx;
}
