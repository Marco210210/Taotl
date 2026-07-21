export const theme = {
  colors: {
    background: "#0F1620",
    surface: "#182333",
    surfaceAlt: "#1F2E42",
    border: "#2C3C52",
    primary: "#E4B363",
    primaryText: "#0F1620",
    text: "#F2F5F8",
    textMuted: "#93A5BC",
    success: "#4FB477",
    danger: "#E5654F",
    warning: "#E4B363",
  },
  spacing: (n: number) => n * 8,
  radius: {
    sm: 8,
    md: 14,
    lg: 22,
    pill: 999,
  },
  font: {
    title: 28,
    heading: 20,
    body: 16,
    small: 13,
  },
} as const;
