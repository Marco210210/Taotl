import { DynamicColorIOS, Platform, PlatformColor, type ColorValue } from "react-native";

function semanticColor(
  light: string,
  dark: string,
  androidAttribute: string,
): ColorValue {
  if (Platform.OS === "ios") return DynamicColorIOS({ light, dark });
  if (Platform.OS === "android") return PlatformColor(androidAttribute);
  return light;
}

export const theme = {
  colors: {
    background: semanticColor("#F8F8F5", "#111215", "?attr/colorBackground"),
    surface: semanticColor("#FFFFFF", "#1B1C20", "?attr/colorBackgroundFloating"),
    surfaceAlt: semanticColor("#F0F0EC", "#24252A", "?attr/colorBackground"),
    border: semanticColor("rgba(23, 24, 29, 0.11)", "rgba(248, 248, 245, 0.12)", "?attr/colorControlNormal"),
    borderStrong: semanticColor("rgba(23, 24, 29, 0.15)", "rgba(248, 248, 245, 0.18)", "?attr/colorControlNormal"),
    primary: "#CF3545",
    primaryText: "#F8F8F5",
    text: semanticColor("#17181D", "#F4F3EF", "?attr/textColorPrimary"),
    textMuted: semanticColor("rgba(23, 24, 29, 0.52)", "rgba(244, 243, 239, 0.62)", "?attr/textColorSecondary"),
    textFaint: semanticColor("rgba(23, 24, 29, 0.30)", "rgba(244, 243, 239, 0.38)", "?attr/textColorSecondary"),
    success: semanticColor("#17784B", "#38A873", "?attr/colorAccent"),
    danger: "#CF3545",
    warning: semanticColor("#A88A12", "#E0BE39", "?attr/colorAccent"),
    yellow: "#E5C51C",
    gold: semanticColor("#A88A12", "#E0BE39", "?attr/colorAccent"),
    terracotta: "#B85C2B",
    teal: "#2E6E7E",
    firstPlace: semanticColor("#FBF6DC", "#342F19", "?attr/colorBackgroundFloating"),
    positiveSoft: semanticColor("rgba(23, 120, 75, 0.10)", "rgba(56, 168, 115, 0.16)", "?attr/colorControlHighlight"),
    negativeSoft: semanticColor("rgba(207, 53, 69, 0.10)", "rgba(207, 53, 69, 0.18)", "?attr/colorControlHighlight"),
    inkSoft: semanticColor("rgba(23, 24, 29, 0.06)", "rgba(248, 248, 245, 0.08)", "?attr/colorControlHighlight"),
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
  avatarColors: ["#CF3545", "#17784B", "#B85C2B", "#2E6E7E", "#17181D", "#A88A12"],
} as const;
