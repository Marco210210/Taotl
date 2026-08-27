import { useCallback, useEffect, useMemo, useState } from "react";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchHistory } from "@/api/games";
import type { GameHistorySummaryDTO } from "@/api/types";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { LeaderboardSelector } from "@/components/LeaderboardSelector";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useAccount } from "@/state/AccountContext";
import { theme, type ThemeColors } from "@/theme";
import { formatAppDate } from "@/utils/date";

export default function HistoryScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backDestination = from === "admin" ? "/admin" : "/";
  const { t, colors } = useAppSettings();
  const { account, token } = useAccount();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [games, setGames] = useState<GameHistorySummaryDTO[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<string | null>(null);
  const leaderboards = account?.leaderboards ?? [];

  useEffect(() => {
    if (!account || selectedLeaderboardId) return;
    const preferred = leaderboards.find((item) => item.id === account.defaultLeaderboardId) ?? leaderboards[0];
    setSelectedLeaderboardId(preferred?.id ?? null);
  }, [account, leaderboards, selectedLeaderboardId]);

  const visibleGames = useMemo(
    () => selectedLeaderboardId
      ? games.filter((game) => game.leaderboardId === selectedLeaderboardId)
      : games,
    [games, selectedLeaderboardId],
  );
  const selectedLeaderboard = leaderboards.find((item) => item.id === selectedLeaderboardId);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      fetchHistory(token).then((result) => {
        if (!active) return;
        setGames(result.games);
        setFromCache(result.fromCache);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [token]),
  );

  return (
    <>
    <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
    <ScreenContainer>
      <ScreenIntro
        title={selectedLeaderboard ? `${t("history.title")} · ${selectedLeaderboard.name}` : t("history.title")}
        description={t("history.description")}
      />
      {leaderboards.length > 1 && (
        <LeaderboardSelector
          leaderboards={leaderboards}
          selectedIds={selectedLeaderboardId ? [selectedLeaderboardId] : []}
          onChange={(ids) => setSelectedLeaderboardId(ids[0] ?? null)}
        />
      )}
      {fromCache && (
        <Text style={styles.helper}>
          {t("history.offline")}
        </Text>
      )}
      {loading && <Text style={styles.helper}>{t("history.loading")}</Text>}
      {!loading && visibleGames.length === 0 && <Text style={styles.helper}>{t("history.empty")}</Text>}

      {visibleGames.map((g) => {
        const winner = g.winnerId
          ? g.standings.find((standing) => standing.playerId === g.winnerId)
          : g.standings[0];
        return (
        <Pressable
          key={g.id}
          accessibilityRole="button"
          onPress={() => router.push({
            pathname: "/history/[id]",
            params: {
              id: g.id,
              from: from === "admin" ? "admin-history" : "history",
            },
          })}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.gameCard}>
            <View style={styles.titleRow}>
              <Text style={styles.date}>
                {formatAppDate(g.startedAt)}
              </Text>
              <Text style={styles.meta}>{t(`mode.${g.mode}`)} · {g.numPlayers} {t("history.players")}</Text>
            </View>
            <View style={styles.winnerRow}>
              <View style={styles.mark}>
                <Image source={require("../../assets/design/suit-mask.png")} resizeMode="contain" style={styles.markImage} />
              </View>
              <View style={styles.winnerInfo}>
                <Text style={styles.winnerLabel}>{t("history.winner")}</Text>
                <Text style={styles.winnerName}>{winner?.name ?? "—"}</Text>
                <Text style={styles.others}>
                  {g.standings.slice(1).map((standing) => standing.name).join(" · ") || t("history.twoPlayers")}
                </Text>
              </View>
              <Text style={styles.winnerScore}>{winner?.total ?? "—"}</Text>
            </View>
            <Text style={styles.openHint}>
              {g.mode === "manuale" ? t("history.openDetails") : t("history.openRounds")}
            </Text>
          </Card>
        </Pressable>
        );
      })}
    </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
    gameCard: { padding: 15, gap: 11 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(1) },
    date: { color: colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 9.5, letterSpacing: 1.2 },
    meta: { color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 10.5 },
    winnerRow: { flexDirection: "row", alignItems: "center", gap: 11 },
    mark: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.success,
    },
    markImage: { width: 26, height: 26 },
    winnerInfo: { flex: 1 },
    winnerLabel: { color: colors.primary, fontFamily: theme.font.family.bold, fontSize: 8.5, letterSpacing: 1 },
    winnerName: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 15 },
    others: { marginTop: 1, color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10.5 },
    winnerScore: {
      color: colors.text,
      fontFamily: theme.font.family.extraBold,
      fontSize: 20,
      fontVariant: ["tabular-nums"],
    },
    openHint: { color: colors.success, fontSize: 10.5, fontFamily: theme.font.family.bold, textAlign: "right" },
    pressed: { opacity: 0.72 },
  });
}
