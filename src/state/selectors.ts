import { computeTotals } from "@/game/scoring";
import { buildRoundInfo } from "@/game/roundBuilder";
import type { ActiveGame, RoundInfo } from "@/game/types";

export function getCurrentRoundInfo(game: ActiveGame): RoundInfo | null {
  if (game.pendingCardsDealt === null) return null;
  return buildRoundInfo({
    roundIndex: game.rounds.length + 1,
    cardsDealt: game.pendingCardsDealt,
    players: game.players,
    startDealerId: game.startDealerId,
  });
}

export function getPreviousCardsDealt(game: ActiveGame): number | null {
  return game.rounds.length ? game.rounds[game.rounds.length - 1].info.cardsDealt : null;
}

export function getTotals(game: ActiveGame): Record<string, number> {
  return computeTotals(game.players, game.rounds);
}

export function getRankedPlayers(game: ActiveGame): { playerId: string; total: number }[] {
  const totals = getTotals(game);
  return game.players
    .map((p) => ({ playerId: p.id, total: totals[p.id] ?? 0 }))
    .sort((a, b) => b.total - a.total);
}
