import type { Href } from "expo-router";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import type { ThemeColors } from "@/theme";

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
      <View pointerEvents="none" style={styles.icon} />
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
      width: 13,
      height: 13,
      marginLeft: 5,
      borderLeftWidth: 2.5,
      borderBottomWidth: 2.5,
      borderColor: colors.text,
      transform: [{ rotate: "45deg" }],
    },
    pressed: {
      backgroundColor: colors.inkSoft,
    },
  });
}
