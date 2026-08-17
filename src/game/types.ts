export type GameMode = "classica" | "completa" | "breve" | "personalizzata";

export interface Player {
  id: string;
  name: string;
  photoUri?: string | null;
}

export interface RoundInfo {
  index: number; // 1-based
  cardsDealt: number;
  presaValue: number;
  rispettoValue: number;
  dealerId: string;
  biddingOrder: string[]; // player ids, dealer sempre ultimo
}

export interface Bid {
  playerId: string;
  bid: number;
}

export interface RoundPlayerResult {
  playerId: string;
  bid: number;
  respected: boolean;
  scarto: number; // 0 se respected
  score: number;
}

export interface CompletedRound {
  info: RoundInfo;
  results: RoundPlayerResult[];
}

export type GameStatus = "awaiting-cards" | "bidding" | "scoring" | "finished";

export interface ActiveGame {
  id: string;
  mode: GameMode;
  players: Player[]; // ordine = ordine al tavolo
  startDealerId: string;
  status: GameStatus;
  rounds: CompletedRound[];
  // Carte del turno in corso: null solo in "awaiting-cards" (personalizzata, in attesa di input manuale).
  pendingCardsDealt: number | null;
  // Chiamate raccolte per il turno in corso (popolate quando si passa a status "scoring").
  pendingBids: Bid[];
  // Stanza scelta prima dell'inizio: resta legata a questa partita anche se
  // l'utente apre o abbandona altri codici durante il gioco.
  verifiedRoomId?: string | null;
  // Se false, la partita non va inviata all'albo/classifica condivisa a fine
  // gioco: resta comunque nello storico locale del telefono.
  saveToAlbo: boolean;
  createdAt: string;
  finishedAt: string | null;
}
