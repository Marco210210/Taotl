// Configurabili in fase di build/dev tramite variabili d'ambiente Expo (prefisso EXPO_PUBLIC_
// così Metro le inlinea nel bundle). Finché non sono impostate, l'app resta pienamente
// utilizzabile in locale (rubrica e storico in cache su AsyncStorage) e riprova quando
// il backend sarà online.
export function getApiBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  return url && url.trim().length > 0 ? url.replace(/\/+$/, "") : null;
}

export function getAppKey(): string | null {
  const key = process.env.EXPO_PUBLIC_APP_KEY;
  return key && key.trim().length > 0 ? key : null;
}

// Oracle esegue l'hash della password prima di rispondere a registrazione e login.
// Su un'istanza Always Free, nei momenti di carico, otto secondi possono essere
// troppo pochi e il client finirebbe per mostrare un falso errore di password.
export const REQUEST_TIMEOUT_MS = 20000;

// Per le chiamate che hanno già un fallback in cache locale pronto (rubrica,
// storico, classifica) non ha senso restare bloccati fino a 20s su rete lenta
// o estera prima di mostrare i dati in cache: un timeout più corto fa scattare
// prima il fallback, a costo di ritentare la rete un po' più aggressivamente.
export const FALLBACK_REQUEST_TIMEOUT_MS = 6000;
