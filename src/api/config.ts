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

export const REQUEST_TIMEOUT_MS = 8000;
