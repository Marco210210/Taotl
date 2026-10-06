import type { SetupDraft } from "./setupDraft";

const KEY = "taotl:setup-draft:v1";

export function readSetupDraft(): SetupDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || !Array.isArray(draft.selectedPlayers) || draft.selectedPlayers.length > 12) return null;
    if (!draft.selectedPlayers.every((p: unknown) => p && typeof p === "object" &&
      "id" in p && typeof p.id === "string" && "name" in p && typeof p.name === "string")) return null;
    if (draft.leaderboardId !== null && typeof draft.leaderboardId !== "string") return null;
    if (typeof draft.leaderboardName !== "string") return null;
    if (![null, "classica", "completa", "breve", "personalizzata"].includes(draft.mode)) return null;
    if (draft.dealerId !== null && !draft.selectedPlayers.some((p: { id: string }) => p.id === draft.dealerId)) return null;
    return draft as SetupDraft;
  } catch { return null; }
}

export function writeSetupDraft(draft: SetupDraft): void {
  try {
    // Per scheda: due finestre non condividono la preparazione della partita.
    if (!draft.selectedPlayers.length && !draft.leaderboardId) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch { /* Storage disabilitato: la preparazione resta disponibile in memoria. */ }
}
