import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { theme } from "@/theme";

export function StatBox({
  label,
  value,
  style,
}: {
  label: string;
  value: string | number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: 9,
    letterSpacing: 1,
  },
  value: {
    marginTop: 3,
    color: theme.colors.text,
    fontFamily: theme.font.family.extraBold,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
  },
});
