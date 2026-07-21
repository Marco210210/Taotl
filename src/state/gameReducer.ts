import { getFixedSequence, isGameFinished } from "@/game/modes";
import { buildRoundInfo } from "@/game/roundBuilder";
import type { ActiveGame, Bid, GameMode, Player, RoundPlayerResult } from "@/game/types";
import { generateId } from "@/utils/id";

export type GameAction =
  | { type: "START_GAME"; mode: GameMode; players: Player[]; startDealerId: string }
  | { type: "SET_PENDING_CARDS"; cardsDealt: number }
  | { type: "CONFIRM_BIDS"; bids: Bid[] }
  | { type: "CONFIRM_ROUND_RESULTS"; results: RoundPlayerResult[] }
  | { type: "RESET_GAME" }
  | { type: "HYDRATE"; game: ActiveGame | null };

export function gameReducer(state: ActiveGame | null, action: GameAction): ActiveGame | null {
  switch (action.type) {
    case "HYDRATE": {
      return action.game;
    }

    case "START_GAME": {
      const { mode, players, startDealerId } = action;
      const base: ActiveGame = {
        id: generateId("game"),
        mode,
        players,
        startDealerId,
        status: "bidding",
        rounds: [],
        pendingCardsDealt: null,
        pendingBids: [],
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

    case "CONFIRM_BIDS": {
      if (!state) return state;
      return { ...state, pendingBids: action.bids, status: "scoring" };
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

    case "RESET_GAME": {
      return null;
    }

    default:
      return state;
  }
}
