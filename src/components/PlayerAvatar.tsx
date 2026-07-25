import { Image, StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme";

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
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={[styles.base, dimensionStyle]} />;
  }

  return (
    <View style={[styles.base, styles.fallback, { backgroundColor: getAvatarColor(colorKey ?? name) }, dimensionStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function getAvatarColor(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return theme.avatarColors[hash % theme.avatarColors.length];
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fallback: { borderWidth: 1, borderColor: "rgba(255,255,255,.25)" },
  initials: { color: theme.colors.background, fontFamily: theme.font.family.extraBold },
});
