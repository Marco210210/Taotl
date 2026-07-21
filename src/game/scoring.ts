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
