import type { ActiveGame, GameMode } from "@/game/types";

export interface PlayerDTO {
  id: string;
  name: string;
  hasPhoto: boolean;
}

export interface GameSyncPayload {
  id: string;
  mode: GameMode;
  numPlayers: number;
  startDealerId: string;
  createdAt: string;
  finishedAt: string | null;
  players: { id: string; name: string; seatOrder: number }[];
  rounds: {
    index: number;
    cardsDealt: number;
    presaValue: number;
    rispettoValue: number;
    dealerId: string;
    results: { playerId: string; bid: number; respected: boolean; scarto: number; score: number }[];
  }[];
}

export interface GameHistorySummaryDTO {
  id: string;
  mode: GameMode;
  numPlayers: number;
  startedAt: string;
  endedAt: string | null;
  standings: { playerId: string; name: string; total: number }[];
}

export function toGameSyncPayload(game: ActiveGame): GameSyncPayload {
  return {
    id: game.id,
    mode: game.mode,
    numPlayers: game.players.length,
    startDealerId: game.startDealerId,
    createdAt: game.createdAt,
    finishedAt: game.finishedAt,
    players: game.players.map((p, index) => ({ id: p.id, name: p.name, seatOrder: index })),
    rounds: game.rounds.map((round) => ({
      index: round.info.index,
      cardsDealt: round.info.cardsDealt,
      presaValue: round.info.presaValue,
      rispettoValue: round.info.rispettoValue,
      dealerId: round.info.dealerId,
      results: round.results.map((r) => ({
        playerId: r.playerId,
        bid: r.bid,
        respected: r.respected,
        scarto: r.scarto,
        score: r.score,
      })),
    })),
  };
}
