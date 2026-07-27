import { useMemo } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export function StatBox({
  label,
  value,
  style,
}: {
  label: string;
  value: string | number;
  style?: ViewStyle;
}) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    box: {
      flex: 1,
      minWidth: 88,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      color: colors.textMuted,
      fontFamily: theme.font.family.bold,
      fontSize: 9,
      letterSpacing: 1,
    },
    value: {
      marginTop: 3,
      color: colors.text,
      fontFamily: theme.font.family.extraBold,
      fontSize: 20,
      fontVariant: ["tabular-nums"],
    },
  });
}
