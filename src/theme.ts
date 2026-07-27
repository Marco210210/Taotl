import { type ColorValue } from "react-native";

export interface ThemeColors {
  background: ColorValue;
  backgroundMuted: ColorValue;
  backgroundFaint: ColorValue;
  backgroundSoft: ColorValue;
  surface: ColorValue;
  surfaceAlt: ColorValue;
  border: ColorValue;
  borderStrong: ColorValue;
  primary: ColorValue;
  primaryText: ColorValue;
  text: ColorValue;
  textMuted: ColorValue;
  textFaint: ColorValue;
  success: ColorValue;
  successHero: ColorValue;
  danger: ColorValue;
  warning: ColorValue;
  yellow: ColorValue;
  gold: ColorValue;
  terracotta: ColorValue;
  teal: ColorValue;
  firstPlace: ColorValue;
  firstPlaceBorder: ColorValue;
  positiveSoft: ColorValue;
  negativeSoft: ColorValue;
  inkSoft: ColorValue;
}

// I colori dipendono dal tema (chiaro/scuro) scelto dall'utente in
// Impostazioni, quindi NON possono essere una costante calcolata una sola
// volta al caricamento del modulo: ogni schermata li ricalcola ad ogni
// render tramite useAppSettings().colors (vedi AppSettingsContext.tsx), così
// il cambio tema è immediato, senza bisogno di ricaricare o riavviare l'app.
export function getThemeColors(isDark: boolean): ThemeColors {
  function semanticColor(light: string, dark: string): ColorValue {
    return isDark ? dark : light;
  }

  return {
    background: semanticColor("#F8F8F5", "#16171B"),
    // Varianti attenuate di `background`, da usare come testo sopra sfondi
    // che si invertono tra i due temi (quelli con backgroundColor:
    // colors.text, es. il pannello "modalità personalizzata" o la schermata
    // di fine partita) — stesso ruolo di textMuted/textFaint ma "al contrario".
    backgroundMuted: semanticColor("rgba(248, 248, 245, 0.62)", "rgba(22, 23, 27, 0.55)"),
    backgroundFaint: semanticColor("rgba(248, 248, 245, 0.42)", "rgba(22, 23, 27, 0.4)"),
    backgroundSoft: semanticColor("rgba(248, 248, 245, 0.08)", "rgba(22, 23, 27, 0.08)"),
    surface: semanticColor("#FFFFFF", "rgba(244, 241, 232, 0.06)"),
    surfaceAlt: semanticColor("#F0F0EC", "rgba(244, 241, 232, 0.08)"),
    border: semanticColor("rgba(23, 24, 29, 0.11)", "rgba(244, 241, 232, 0.10)"),
    borderStrong: semanticColor("rgba(23, 24, 29, 0.15)", "rgba(244, 241, 232, 0.14)"),
    primary: semanticColor("#CF3545", "#E8515F"),
    // Colore fisso (non cambia tra chiaro/scuro): per il testo/le icone sopra
    // sfondi "colorati" che restano scuri/saturi in entrambi i temi (bottoni
    // primary/danger/success, avatar, hero verde...). Da NON confondere con
    // `background`, che invece è pensato per sfondi che si invertono.
    primaryText: "#F8F8F5",
    text: semanticColor("#17181D", "#F4F1E8"),
    textMuted: semanticColor("rgba(23, 24, 29, 0.52)", "rgba(244, 241, 232, 0.5)"),
    textFaint: semanticColor("rgba(23, 24, 29, 0.30)", "rgba(244, 241, 232, 0.25)"),
    success: semanticColor("#17784B", "#2E9E68"),
    successHero: semanticColor("#17784B", "#125C3B"),
    danger: semanticColor("#CF3545", "#E8515F"),
    warning: semanticColor("#A88A12", "#E5C51C"),
    yellow: "#E5C51C",
    gold: semanticColor("#A88A12", "#E5C51C"),
    terracotta: semanticColor("#B85C2B", "#D98249"),
    teal: semanticColor("#2E6E7E", "#54A3B5"),
    firstPlace: semanticColor("#FBF6DC", "rgba(229, 197, 28, 0.14)"),
    firstPlaceBorder: semanticColor("rgba(23, 24, 29, 0.12)", "rgba(229, 197, 28, 0.35)"),
    positiveSoft: semanticColor("rgba(23, 120, 75, 0.10)", "rgba(46, 158, 104, 0.16)"),
    negativeSoft: semanticColor("rgba(207, 53, 69, 0.10)", "rgba(232, 81, 95, 0.16)"),
    inkSoft: semanticColor("rgba(23, 24, 29, 0.06)", "rgba(244, 241, 232, 0.08)"),
  };
}

export function getAvatarColors(isDark: boolean): readonly string[] {
  return isDark
    ? ["#E8515F", "#2E9E68", "#D98249", "#54A3B5", "#F4F1E8", "#E5C51C"]
    : ["#CF3545", "#17784B", "#B85C2B", "#2E6E7E", "#17181D", "#A88A12"];
}

// Token che NON dipendono dal tema: restano un import statico ovunque.
export const theme = {
  spacing: (n: number) => n * 8,
  radius: {
    sm: 8,
    md: 12,
    lg: 14,
    pill: 999,
  },
  font: {
    title: 30,
    heading: 20,
    body: 14,
    small: 12,
    family: {
      regular: "Manrope_400Regular",
      medium: "Manrope_500Medium",
      semibold: "Manrope_600SemiBold",
      bold: "Manrope_700Bold",
      extraBold: "Manrope_800ExtraBold",
      display: "InstrumentSerif_400Regular",
    },
  },
} as const;
