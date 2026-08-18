import { useMemo } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export function ToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.borderStrong as string, true: colors.success as string }}
        thumbColor={colors.surface as string}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    toggleRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    toggleInfo: { flex: 1 },
    title: {
      color: colors.text,
      fontFamily: theme.font.family.bold,
      fontSize: 14,
    },
    description: {
      marginTop: 2,
      color: colors.textMuted,
      fontFamily: theme.font.family.medium,
      fontSize: 10.5,
      lineHeight: 15,
    },
  });
}
