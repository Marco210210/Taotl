import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/theme";

export function ScreenContainer({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(2), gap: theme.spacing(2), flexGrow: 1 },
});
