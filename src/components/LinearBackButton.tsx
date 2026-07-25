import type { Href } from "expo-router";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

export function LinearBackButton({ destination }: { destination: Href }) {
  const { t } = useAppSettings();

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

const styles = StyleSheet.create({
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
    color: theme.colors.text,
    fontFamily: theme.font.family.regular,
    fontSize: 34,
    lineHeight: 36,
  },
  pressed: {
    backgroundColor: theme.colors.inkSoft,
  },
});
