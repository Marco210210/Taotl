import { getBiddingOrder, getDealerIdForRound } from "./dealer";
import { getRoundValues } from "./scoring";
import type { Player, RoundInfo } from "./types";

export function buildRoundInfo(params: {
  roundIndex: number;
  cardsDealt: number;
  players: Player[];
  startDealerId: string;
}): RoundInfo {
  const { roundIndex, cardsDealt, players, startDealerId } = params;
  const seatOrder = players.map((p) => p.id);
  const dealerId = getDealerIdForRound(seatOrder, startDealerId, roundIndex);
  const biddingOrder = getBiddingOrder(seatOrder, dealerId);
  const { presaValue, rispettoValue } = getRoundValues(roundIndex);
  return { index: roundIndex, cardsDealt, presaValue, rispettoValue, dealerId, biddingOrder };
}
