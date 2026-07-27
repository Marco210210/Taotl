import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type StoredThemePreference = "system" | "light" | "dark";

const KEY = "taotl.theme-preference.v1";

// Persistenza dedicata e SINCRONA per la sola preferenza del tema (system/
// light/dark), separata dalle altre impostazioni (che restano su AsyncStorage,
// asincrono). Serve perché src/theme.ts deve sapere quale tema applicare nel
// momento stesso in cui il modulo viene caricato, prima che React o
// AsyncStorage esistano — e perché, dentro Expo Go, Updates.reloadAsync()
// rifiuta sempre la promise ("This method cannot be used in Expo Go"): un
// cambio tema può quindi diventare visibile solo alla prossima apertura
// dell'app da zero, mai con un reload "in place". SecureStore.getItem/
// setItem (senza suffisso Async) sono le uniche API sincrone disponibili sia
// nel progetto principale sia nel branch Expo Go, quindi funzionano allo
// stesso modo ovunque l'app venga davvero eseguita.
export function readStoredThemePreference(): StoredThemePreference {
  if (Platform.OS === "web") return "system";
  try {
    const raw = SecureStore.getItem(KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
    return "system";
  } catch {
    return "system";
  }
}

export function writeStoredThemePreference(value: StoredThemePreference): void {
  if (Platform.OS === "web") return;
  try {
    SecureStore.setItem(KEY, value);
  } catch {
    // Nel peggiore dei casi il tema torna a seguire il sistema al prossimo avvio.
  }
}
