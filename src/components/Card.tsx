import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { theme } from "@/theme";

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing(1),
  },
});
