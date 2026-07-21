import { Image, StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme";

export function PlayerAvatar({
  name,
  photoUri,
  size = 44,
}: {
  name: string;
  photoUri?: string | null;
  size?: number;
}) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={[styles.base, dimensionStyle]} />;
  }

  return (
    <View style={[styles.base, styles.fallback, dimensionStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fallback: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  initials: { color: theme.colors.text, fontWeight: "700" },
});
