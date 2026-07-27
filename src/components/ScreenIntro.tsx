import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export function ScreenIntro({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: 4 },
    title: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 24, lineHeight: 30 },
    description: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12.5, lineHeight: 18 },
  });
}
