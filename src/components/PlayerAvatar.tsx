import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export function PlayerAvatar({
  name,
  photoUri,
  size = 44,
  colorKey,
}: {
  name: string;
  photoUri?: string | null;
  size?: number;
  colorKey?: string;
}) {
  const { colors, avatarColors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={[styles.base, dimensionStyle]} />;
  }

  return (
    <View
      style={[
        styles.base,
        styles.fallback,
        { backgroundColor: getAvatarColor(colorKey ?? name, avatarColors) },
        dimensionStyle,
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function getAvatarColor(value: string, avatarColors: readonly string[]): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return avatarColors[hash % avatarColors.length];
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    base: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
    fallback: { borderWidth: 1, borderColor: "rgba(255,255,255,.25)" },
    initials: { color: colors.primaryText, fontFamily: theme.font.family.extraBold },
  });
}
