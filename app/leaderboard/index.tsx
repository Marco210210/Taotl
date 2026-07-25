import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchLeaderboard } from "@/api/leaderboard";
import type { LeaderboardEntryDTO } from "@/api/leaderboard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

export default function LeaderboardScreen() {
  const { t } = useAppSettings();
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
          <Card key={entry.playerId} style={styles.row}>
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
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, fontFamily: theme.font.family.medium },
  error: { fontSize: theme.font.small, color: theme.colors.danger, fontFamily: theme.font.family.semibold },
  list: { gap: theme.spacing(1) },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
  position: {
    width: 26,
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.extraBold,
    fontSize: theme.font.body,
  },
  info: { flex: 1 },
  name: { color: theme.colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
  meta: { color: theme.colors.textMuted, fontSize: theme.font.small, fontFamily: theme.font.family.medium },
  wins: {
    color: theme.colors.success,
    fontSize: theme.font.heading,
    fontFamily: theme.font.family.extraBold,
    fontVariant: ["tabular-nums"],
  },
  winsLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.font.family.semibold,
    textTransform: "uppercase",
  },
  manageLink: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  manageText: { flex: 1, color: theme.colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 12 },
  manageArrow: { color: theme.colors.text, fontSize: 22 },
  pressed: { opacity: 0.72 },
});
