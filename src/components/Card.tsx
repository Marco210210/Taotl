import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      borderWidth: 1,
      borderColor: colors.border,
      gap: theme.spacing(1),
    },
  });
}
