import { Appearance, type ColorValue } from "react-native";

// I colori "chiaro/scuro" vengono decisi una sola volta, quando il modulo viene
// caricato (non ad ogni render): per applicare un cambio di tema serve un
// ricaricamento della app (vedi AppSettingsContext, che lo fa in automatico
// quando l'utente cambia l'impostazione). Appearance.getColorScheme() riflette
// sia il tema di sistema sia un'eventuale forzatura fatta con
// Appearance.setColorScheme(), quindi funziona anche per l'override manuale.
const isDark = Appearance.getColorScheme() === "dark";

function semanticColor(light: string, dark: string): ColorValue {
  return isDark ? dark : light;
}

export const theme = {
  colors: {
    background: semanticColor("#F8F8F5", "#16171B"),
    surface: semanticColor("#FFFFFF", "rgba(244, 241, 232, 0.06)"),
    surfaceAlt: semanticColor("#F0F0EC", "rgba(244, 241, 232, 0.08)"),
    border: semanticColor("rgba(23, 24, 29, 0.11)", "rgba(244, 241, 232, 0.10)"),
    borderStrong: semanticColor("rgba(23, 24, 29, 0.15)", "rgba(244, 241, 232, 0.14)"),
    primary: semanticColor("#CF3545", "#E8515F"),
    primaryText: semanticColor("#F8F8F5", "#16171B"),
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
  },
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
  avatarColors: isDark
    ? ["#E8515F", "#2E9E68", "#D98249", "#54A3B5", "#F4F1E8", "#E5C51C"]
    : ["#CF3545", "#17784B", "#B85C2B", "#2E6E7E", "#17181D", "#A88A12"],
  isDark,
} as const;
