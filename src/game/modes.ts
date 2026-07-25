import { CLASSICA_TABLE } from "./classicaTable";
import { MIN_TURNS_PERSONALIZZATA, TOTAL_CARDS } from "./constants";
import type { GameMode } from "./types";

export function maxFirstTurnCards(numPlayers: number): number {
  return Math.floor(TOTAL_CARDS / numPlayers);
}

export function getClassicaSequence(numPlayers: number): number[] {
  const sequence = CLASSICA_TABLE[numPlayers];
  if (!sequence) {
    throw new Error(`Nessuna distribuzione classica definita per ${numPlayers} giocatori.`);
  }
  return sequence;
}

export function getCompletaSequence(numPlayers: number): number[] {
  const first = maxFirstTurnCards(numPlayers);
  const sequence: number[] = [];
  for (let cards = first; cards >= 1; cards -= 1) {
    sequence.push(cards);
  }
  return sequence;
}

export function getBreveSequence(): number[] {
  return [6, 5, 4, 3, 2, 1];
}

// Solo per modalità con sequenza precalcolata (non "personalizzata").
export function getFixedSequence(mode: Exclude<GameMode, "personalizzata">, numPlayers: number): number[] {
  switch (mode) {
    case "classica":
      return getClassicaSequence(numPlayers);
    case "completa":
      return getCompletaSequence(numPlayers);
    case "breve":
      return getBreveSequence();
  }
}

export function isGameFinished(cardsDealt: number): boolean {
  return cardsDealt === 1;
}

// Valida il numero di carte inserito manualmente per il prossimo turno in modalità "personalizzata".
export function validatePersonalizzataCards(params: {
  candidate: number;
  previousCardsDealt: number | null; // null se è il primo turno della partita
  numPlayers: number;
  roundIndex: number; // 1-based, indice del turno che si sta per iniziare
}): string | null {
  const { candidate, previousCardsDealt, numPlayers, roundIndex } = params;

  if (!Number.isInteger(candidate) || candidate < 1) {
    return "Inserisci un numero di carte valido (almeno 1).";
  }

  if (previousCardsDealt === null) {
    const max = maxFirstTurnCards(numPlayers);
    if (candidate > max) {
      return `Con ${numPlayers} giocatori si possono distribuire al massimo ${max} carte al primo turno.`;
    }
  } else {
    if (candidate >= previousCardsDealt) {
      return `Il numero di carte deve essere minore del turno precedente (${previousCardsDealt}).`;
    }
    if (candidate === 2 && previousCardsDealt !== 3) {
      return "Si può scendere a 2 carte solo se il turno precedente era di 3 carte.";
    }
    if (candidate === 1 && previousCardsDealt !== 2) {
      return "Si può scendere a 1 carta solo se il turno precedente era di 2 carte.";
    }
  }

  const latestPossibleFinalRound = roundIndex + candidate - 1;
  if (latestPossibleFinalRound < MIN_TURNS_PERSONALIZZATA) {
    const minimumCards = MIN_TURNS_PERSONALIZZATA - roundIndex + 1;
    return (
      `Scegli almeno ${minimumCards} carte: partendo da ${candidate}, anche scendendo poi ` +
      `di una carta alla volta, la partita terminerebbe al turno ${latestPossibleFinalRound} ` +
      `invece che dopo almeno ${MIN_TURNS_PERSONALIZZATA} turni.`
    );
  }

  return null;
}
