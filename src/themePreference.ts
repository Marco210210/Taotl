import { File, Paths } from "expo-file-system";

export type StoredThemePreference = "system" | "light" | "dark";

// Persistenza dedicata e SINCRONA per la sola preferenza del tema (system/
// light/dark), separata dalle altre impostazioni (che restano su AsyncStorage,
// asincrono). Serve perché src/theme.ts deve sapere quale tema applicare nel
// momento stesso in cui il modulo viene caricato, prima che React o
// AsyncStorage esistano. In precedenza ci si affidava ad
// Appearance.setColorScheme() per "far ricordare" la scelta al sistema nativo
// tra un reload e l'altro, ma dentro Expo Go quella forzatura non è
// affidabile (Expo Go ospita più progetti e può non applicarla/persisterla),
// il che faceva restare l'app bloccata sul tema di sistema. Un file letto/
// scritto in modo sincrono (via le API JSI di expo-file-system) elimina la
// dipendenza da quel comportamento.
let file: File | null = null;
function preferenceFile(): File {
  if (!file) file = new File(Paths.document, "taotl-theme-preference.txt");
  return file;
}

export function readStoredThemePreference(): StoredThemePreference {
  try {
    const f = preferenceFile();
    if (!f.exists) return "system";
    const raw = f.textSync().trim();
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
    return "system";
  } catch {
    return "system";
  }
}

export function writeStoredThemePreference(value: StoredThemePreference): void {
  try {
    preferenceFile().write(value);
  } catch {
    // Nel peggiore dei casi il tema torna a seguire il sistema al prossimo avvio.
  }
}
