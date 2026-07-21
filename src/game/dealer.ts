export function getDealerIdForRound(seatOrder: string[], startDealerId: string, roundIndex: number): string {
  const startIdx = seatOrder.indexOf(startDealerId);
  if (startIdx === -1) {
    throw new Error("Mazziere iniziale non trovato tra i giocatori della partita.");
  }
  const offset = (roundIndex - 1) % seatOrder.length;
  return seatOrder[(startIdx + offset) % seatOrder.length];
}

// Chi parla per primo è il giocatore dopo il mazziere; il mazziere è sempre l'ultimo a dichiarare.
export function getBiddingOrder(seatOrder: string[], dealerId: string): string[] {
  const dealerIdx = seatOrder.indexOf(dealerId);
  if (dealerIdx === -1) {
    throw new Error("Mazziere non trovato tra i giocatori della partita.");
  }
  return [...seatOrder.slice(dealerIdx + 1), ...seatOrder.slice(0, dealerIdx + 1)];
}
