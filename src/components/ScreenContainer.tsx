import type { PropsWithChildren, ReactNode } from "react";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppSettings } from "@/state/AppSettingsContext";
import type { ThemeColors } from "@/theme";

export function ScreenContainer({
  children,
  style,
  footer,
}: PropsWithChildren<{ style?: ViewStyle; footer?: ReactNode }>) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.content, footer ? styles.contentWithFooter : null, style]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {!!footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: 620,
      alignSelf: "center",
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 28,
      gap: 16,
      flexGrow: 1,
    },
    contentWithFooter: { paddingBottom: 18 },
    footer: {
      width: "100%",
      maxWidth: 620,
      alignSelf: "center",
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 10,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });
}
