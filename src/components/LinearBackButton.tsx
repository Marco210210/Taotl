import type { Href } from "expo-router";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export function LinearBackButton({ destination }: { destination: Href }) {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={12}
      onPress={() => router.dismissTo(destination)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text pointerEvents="none" style={styles.icon}>‹</Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      width: 42,
      height: 42,
      marginLeft: -8,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 21,
    },
    icon: {
      marginTop: -2,
      color: colors.text,
      fontFamily: theme.font.family.regular,
      fontSize: 34,
      lineHeight: 36,
    },
    pressed: {
      backgroundColor: colors.inkSoft,
    },
  });
}
