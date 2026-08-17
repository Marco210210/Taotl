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
  // Valorizzato solo se in testa c'era un pareggio risolto a mano (es. carta
  // alta): in quel caso conta come vittoria solo questo giocatore, non tutti
  // i pari-merito. Assente/null = comportamento di sempre (vincono entrambi).
  tieBreakWinnerId?: string | null;
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

export interface GameHistoryDetailDTO extends GameHistorySummaryDTO {
  startDealerId: string;
  players: { id: string; name: string; seatOrder: number }[];
  rounds: {
    index: number;
    cardsDealt: number;
    presaValue: number;
    rispettoValue: number;
    dealerId: string;
    results: {
      playerId: string;
      name: string;
      bid: number;
      respected: boolean;
      scarto: number;
      score: number;
    }[];
  }[];
}

export function toGameSyncPayload(game: ActiveGame, tieBreakWinnerId?: string | null): GameSyncPayload {
  return {
    id: game.id,
    mode: game.mode,
    numPlayers: game.players.length,
    startDealerId: game.startDealerId,
    createdAt: game.createdAt,
    finishedAt: game.finishedAt,
    tieBreakWinnerId: tieBreakWinnerId ?? null,
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

export function toGameHistoryDetail(game: ActiveGame): GameHistoryDetailDTO {
  const totals = Object.fromEntries(game.players.map((player) => [player.id, 0]));
  for (const round of game.rounds) {
    for (const result of round.results) {
      totals[result.playerId] = (totals[result.playerId] ?? 0) + result.score;
    }
  }
  const playerById = new Map(game.players.map((player) => [player.id, player]));

  return {
    id: game.id,
    mode: game.mode,
    numPlayers: game.players.length,
    startDealerId: game.startDealerId,
    startedAt: game.createdAt,
    endedAt: game.finishedAt,
    players: game.players.map((player, seatOrder) => ({ id: player.id, name: player.name, seatOrder })),
    standings: game.players
      .map((player) => ({ playerId: player.id, name: player.name, total: totals[player.id] ?? 0 }))
      .sort((a, b) => b.total - a.total),
    rounds: game.rounds.map((round) => ({
      index: round.info.index,
      cardsDealt: round.info.cardsDealt,
      presaValue: round.info.presaValue,
      rispettoValue: round.info.rispettoValue,
      dealerId: round.info.dealerId,
      results: round.results.map((result) => ({
        ...result,
        name: playerById.get(result.playerId)?.name ?? "Giocatore",
      })),
    })),
  };
}
