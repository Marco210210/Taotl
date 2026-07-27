import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchLeaderboard } from "@/api/leaderboard";
import type { LeaderboardEntryDTO } from "@/api/leaderboard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function LeaderboardScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backDestination = from === "profile" ? "/profile" : from === "admin" ? "/admin" : "/";
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { account } = useAccount();
  const [entries, setEntries] = useState<LeaderboardEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      fetchLeaderboard()
        .then((result) => {
          if (active) setEntries(result);
        })
        .catch((reason) => {
          if (active) setError(reason instanceof Error ? reason.message : t("leaderboard.unavailable"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [t]),
  );

  return (
    <>
    <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
    <ScreenContainer>
      <ScreenIntro title={t("leaderboard.title")} description={t("leaderboard.description")} />

      {account?.isAdmin && (
        <Button
          label={t("leaderboard.addGame")}
          variant="success"
          onPress={() => router.push("/leaderboard/add-game")}
        />
      )}

      {loading && <Text style={styles.helper}>{t("common.loading")}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && entries.length === 0 && (
        <Text style={styles.helper}>{t("leaderboard.empty")}</Text>
      )}

      <View style={styles.list}>
        {entries.map((entry, index) => (
          <Pressable
            key={entry.playerId}
            onPress={() => router.push({
              pathname: "/leaderboard/player/[id]",
              params: {
                id: entry.playerId,
                from: from === "profile" ? "profile-leaderboard" : "leaderboard",
              },
            })}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={styles.row}>
              <Text style={styles.position}>{index + 1}</Text>
              <View style={styles.info}>
                <Text style={styles.name}>{entry.name}</Text>
                <Text style={styles.meta}>
                  {entry.gamesPlayed} {t("leaderboard.games")}
                </Text>
              </View>
              <Text style={styles.wins}>{entry.wins}</Text>
              <Text style={styles.winsLabel}>{t("leaderboard.wins")}</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      {account?.isAdmin && (
        <Pressable
          onPress={() => router.push("/leaderboard/link-account")}
          style={({ pressed }) => [styles.manageLink, pressed && styles.pressed]}
        >
          <Text style={styles.manageText}>{t("leaderboard.linkAccount")}</Text>
          <Text style={styles.manageArrow}>›</Text>
        </Pressable>
      )}
    </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
    error: { fontSize: theme.font.small, color: colors.danger, fontFamily: theme.font.family.semibold },
    list: { gap: theme.spacing(1) },
    row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
    position: {
      width: 26,
      color: colors.textMuted,
      fontFamily: theme.font.family.extraBold,
      fontSize: theme.font.body,
    },
    info: { flex: 1 },
    name: { color: colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
    meta: { color: colors.textMuted, fontSize: theme.font.small, fontFamily: theme.font.family.medium },
    wins: {
      color: colors.success,
      fontSize: theme.font.heading,
      fontFamily: theme.font.family.extraBold,
      fontVariant: ["tabular-nums"],
    },
    winsLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontFamily: theme.font.family.semibold,
      textTransform: "uppercase",
    },
    manageLink: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
    manageText: { flex: 1, color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 12 },
    manageArrow: { color: colors.text, fontSize: 22 },
    pressed: { opacity: 0.72 },
  });
}
