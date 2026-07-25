import { useCallback } from "react";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { LinearBackButton } from "@/components/LinearBackButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useRoster } from "@/state/useRoster";
import { theme } from "@/theme";

export default function RosterScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backDestination = from === "setup" ? "/setup/players" : "/";
  const { t } = useAppSettings();
  const { players, loading, fromCache, reload } = useRoster();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.colors.primary} />}
        >
        <Text style={styles.heading}>{t("roster.title")}</Text>
        {fromCache && (
          <Text style={styles.helper}>
            {t("roster.offline")}
          </Text>
        )}

        <Button label={t("roster.add")} onPress={() => router.push("/roster/edit")} />

        <View style={styles.list}>
          {players.map((player) => (
            <Pressable
              key={player.id}
              style={styles.row}
              onPress={() => router.push({ pathname: "/roster/edit", params: { id: player.id } })}
            >
              <PlayerAvatar name={player.name} photoUri={player.photoUri} size={44} />
              <Text style={styles.name}>{player.name}</Text>
            </Pressable>
          ))}
          {!loading && players.length === 0 && (
            <Text style={styles.helper}>{t("roster.empty")}</Text>
          )}
        </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(2), gap: theme.spacing(2) },
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted },
  list: { gap: theme.spacing(1) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  name: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: "600" },
});
