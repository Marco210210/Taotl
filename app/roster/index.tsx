import { useCallback, useMemo } from "react";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { LinearBackButton } from "@/components/LinearBackButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useAccount } from "@/state/AccountContext";
import { useRoster } from "@/state/useRoster";
import { theme, type ThemeColors } from "@/theme";

export default function RosterScreen() {
  const { from, leaderboardId } = useLocalSearchParams<{ from?: string; leaderboardId?: string }>();
  const backDestination = from === "setup" ? "/setup/players" : from === "admin" ? "/" : "/";
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { account, token } = useAccount();
  const canCreate = !token || account?.isAdmin || account?.leaderboards.some((board) => board.id === leaderboardId && board.canManage);
  const { players, loading, fromCache, reload } = useRoster(leaderboardId);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (token && !account?.isAdmin && !(leaderboardId
    ? account?.leaderboards.some((board) => board.id === leaderboardId && board.canManage)
    : account?.leaderboards.some((board) => board.canManage))) {
    return <SafeAreaView><Text>La gestione della rubrica è riservata ai gestori della classifica.</Text><Button label="Indietro" onPress={() => router.back()} /></SafeAreaView>;
  }

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} preferHistory /> }} />
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary as string} />}
        >
        <Text style={styles.heading}>{t("roster.title")}</Text>
        {fromCache && (
          <Text style={styles.helper}>
            {t("roster.offline")}
          </Text>
        )}

        {canCreate && <Button
          label={t("roster.add")}
          onPress={() => router.push({
            pathname: "/roster/edit",
            params: { ...(from ? { from } : {}), ...(leaderboardId ? { leaderboardId } : {}) },
          })}
        />}

        <View style={styles.list}>
          {players.filter((player) => !token || player.canEdit).map((player) => (
            <Pressable
              key={player.id}
              style={styles.row}
              onPress={() => router.push({
                pathname: "/roster/edit",
                params: { id: player.id, ...(from ? { from } : {}), ...(leaderboardId ? { leaderboardId } : {}) },
              })}
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), gap: theme.spacing(2) },
    heading: { fontSize: theme.font.title, fontWeight: "800", color: colors.text },
    helper: { fontSize: theme.font.small, color: colors.textMuted },
    list: { gap: theme.spacing(1) },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.25),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    name: { color: colors.text, fontSize: theme.font.body, fontWeight: "600" },
  });
}
