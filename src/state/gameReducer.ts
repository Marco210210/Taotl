import { getFixedSequence, isGameFinished } from "@/game/modes";
import { buildRoundInfo } from "@/game/roundBuilder";
import type { ActiveGame, Bid, GameMode, Player, RoundPlayerResult } from "@/game/types";
import { generateId } from "@/utils/id";

export type GameAction =
  | { type: "START_GAME"; mode: GameMode; players: Player[]; startDealerId: string; verifiedRoomId?: string | null; saveToAlbo: boolean }
  | { type: "SET_PENDING_CARDS"; cardsDealt: number }
  | { type: "REOPEN_CARDS" }
  | { type: "CONFIRM_BIDS"; bids: Bid[] }
  | { type: "REOPEN_BIDS" }
  | { type: "CONFIRM_ROUND_RESULTS"; results: RoundPlayerResult[] }
  | { type: "UNDO_LAST_ROUND" }
  | { type: "SET_CURRENT_DEALER"; dealerId: string }
  | { type: "RESET_GAME" }
  | { type: "HYDRATE"; game: ActiveGame | null };

export function gameReducer(state: ActiveGame | null, action: GameAction): ActiveGame | null {
  switch (action.type) {
    case "HYDRATE": {
      return action.game;
    }

    case "START_GAME": {
      const { mode, players, startDealerId, verifiedRoomId, saveToAlbo } = action;
      const base: ActiveGame = {
        id: generateId("game"),
        mode,
        players,
        startDealerId,
        status: "bidding",
        rounds: [],
        pendingCardsDealt: null,
        pendingBids: [],
        verifiedRoomId: verifiedRoomId ?? null,
        saveToAlbo,
        createdAt: new Date().toISOString(),
        finishedAt: null,
      };

      if (mode === "personalizzata") {
        return { ...base, status: "awaiting-cards" };
      }

      const sequence = getFixedSequence(mode, players.length);
      return { ...base, pendingCardsDealt: sequence[0] };
    }

    case "SET_PENDING_CARDS": {
      if (!state) return state;
      return { ...state, pendingCardsDealt: action.cardsDealt, status: "bidding" };
    }

    case "REOPEN_CARDS": {
      if (!state || state.mode !== "personalizzata" || state.status !== "bidding") return state;
      return { ...state, status: "awaiting-cards" };
    }

    case "CONFIRM_BIDS": {
      if (!state) return state;
      return { ...state, pendingBids: action.bids, status: "scoring" };
    }

    case "REOPEN_BIDS": {
      if (!state || state.status !== "scoring") return state;
      return { ...state, pendingBids: [], status: "bidding" };
    }

    case "SET_CURRENT_DEALER": {
      if (
        !state ||
        state.rounds.length > 0 ||
        (state.status !== "bidding" && state.status !== "awaiting-cards")
      ) {
        return state;
      }
      const selectedIndex = state.players.findIndex((player) => player.id === action.dealerId);
      if (selectedIndex < 0) return state;
      return { ...state, startDealerId: state.players[selectedIndex].id, pendingBids: [] };
    }

    case "CONFIRM_ROUND_RESULTS": {
      if (!state || state.pendingCardsDealt === null) return state;

      const cardsDealt = state.pendingCardsDealt;
      const roundInfo = buildRoundInfo({
        roundIndex: state.rounds.length + 1,
        cardsDealt,
        players: state.players,
        startDealerId: state.startDealerId,
      });
      const rounds = [...state.rounds, { info: roundInfo, results: action.results }];

      if (isGameFinished(cardsDealt)) {
        return {
          ...state,
          rounds,
          pendingBids: [],
          pendingCardsDealt: null,
          status: "finished",
          finishedAt: new Date().toISOString(),
        };
      }

      const mode = state.mode;
      if (mode === "personalizzata") {
        return { ...state, rounds, pendingBids: [], pendingCardsDealt: null, status: "awaiting-cards" };
      }

      const sequence = getFixedSequence(mode, state.players.length);
      return {
        ...state,
        rounds,
        pendingBids: [],
        pendingCardsDealt: sequence[rounds.length],
        status: "bidding",
      };
    }

    case "UNDO_LAST_ROUND": {
      if (!state || state.rounds.length === 0) return state;
      const lastRound = state.rounds[state.rounds.length - 1];
      const rounds = state.rounds.slice(0, -1);
      const pendingBids: Bid[] = lastRound.results.map((result) => ({
        playerId: result.playerId,
        bid: result.bid,
      }));
      return {
        ...state,
        rounds,
        pendingBids,
        pendingCardsDealt: lastRound.info.cardsDealt,
        status: "scoring",
        finishedAt: null,
      };
    }

    case "RESET_GAME": {
      return null;
    }

    default:
      return state;
  }
}
