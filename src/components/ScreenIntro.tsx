import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme";

export function ScreenIntro({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  title: { color: theme.colors.text, fontFamily: theme.font.family.extraBold, fontSize: 24, lineHeight: 30 },
  description: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12.5, lineHeight: 18 },
});
