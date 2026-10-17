export function getRoundValues(roundIndex: number): { presaValue: number; rispettoValue: number } {
  return {
    presaValue: 5 * roundIndex,
    rispettoValue: 10 * roundIndex,
  };
}

export function computePlayerScore(params: {
  bid: number;
  respected: boolean;
  scarto: number;
  presaValue: number;
  rispettoValue: number;
}): number {
  const { bid, respected, scarto, presaValue, rispettoValue } = params;
  if (respected) {
    return presaValue * bid + rispettoValue;
  }
  return -presaValue * Math.abs(scarto);
}

export function computeTotals(
  players: { id: string }[],
  rounds: { results: { playerId: string; score: number }[] }[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const player of players) {
    totals[player.id] = 0;
  }
  for (const round of rounds) {
    for (const result of round.results) {
      totals[result.playerId] = (totals[result.playerId] ?? 0) + result.score;
    }
  }
  return totals;
}

/** Classifica cumulativa alla fine di ciascun turno, senza cambiare l'ordine di gioco. */
export function rankResultsByRound<Result extends { playerId: string; score: number }>(
  rounds: readonly { index: number; results: readonly Result[] }[],
  playerIds: readonly string[],
): Map<number, Result[]> {
  const totals = new Map<string, number>();
  const seats = new Map(playerIds.map((id, index) => [id, index]));
  const ranked = new Map<number, Result[]>();
  for (const round of [...rounds].sort((a, b) => a.index - b.index)) {
    for (const result of round.results) {
      totals.set(result.playerId, (totals.get(result.playerId) ?? 0) + result.score);
    }
    ranked.set(round.index, [...round.results].sort((a, b) =>
      (totals.get(b.playerId) ?? 0) - (totals.get(a.playerId) ?? 0)
      || (seats.get(a.playerId) ?? Infinity) - (seats.get(b.playerId) ?? Infinity),
    ));
  }
  return ranked;
}
