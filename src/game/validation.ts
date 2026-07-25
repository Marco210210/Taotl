// Se il mazziere chiamasse questo valore, la somma di tutte le chiamate sarebbe uguale
// alle carte in mano: per regola non è permesso. Ritorna null se non c'è alcun vincolo.
export function getForbiddenBidForDealer(otherBidsSum: number, cardsInHand: number): number | null {
  const forbidden = cardsInHand - otherBidsSum;
  if (forbidden >= 0 && forbidden <= cardsInHand) {
    return forbidden;
  }
  return null;
}

export function validateBid(params: {
  value: number;
  cardsInHand: number;
  isDealer: boolean;
  otherBidsSum: number;
}): string | null {
  const { value, cardsInHand, isDealer, otherBidsSum } = params;

  if (!Number.isInteger(value) || value < 0) {
    return "Inserisci un numero valido (0 o superiore).";
  }
  if (value > cardsInHand) {
    return `Non puoi chiamare più di ${cardsInHand} prese.`;
  }
  if (isDealer) {
    const forbidden = getForbiddenBidForDealer(otherBidsSum, cardsInHand);
    if (forbidden !== null && value === forbidden) {
      return `Come mazziere non puoi chiamare ${forbidden}: la somma delle chiamate non può essere uguale a ${cardsInHand}.`;
    }
  }
  return null;
}

export function validateScarto(scarto: number, cardsInHand: number, language: AppLanguage = "it"): string | null {
  if (!Number.isInteger(scarto) || scarto < 1) {
    return language === "en"
      ? "Enter how many tricks the player missed by (at least 1)."
      : "Inserisci di quante prese ha sbagliato (almeno 1).";
  }
  if (scarto > cardsInHand) {
    return language === "en"
      ? `The difference cannot exceed the ${cardsInHand} cards in hand.`
      : `Lo scarto non può superare le ${cardsInHand} carte in mano.`;
  }
  return null;
}
import type { AppLanguage } from "@/i18n/translations";
