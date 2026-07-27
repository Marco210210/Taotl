import { Stack, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";

import { fetchHistory } from "@/api/games";
import { fetchLeaderboard, type LeaderboardEntryDTO } from "@/api/leaderboard";
import { fetchRoster } from "@/api/players";
import type { GameHistorySummaryDTO } from "@/api/types";
import { PlayerStatsView } from "@/components/PlayerStatsView";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import type { Player } from "@/game/types";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function LeaderboardPlayerScreen() {
  const { locale, t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const backDestination: Href =
    from === "profile-leaderboard"
      ? { pathname: "/leaderboard", params: { from: "profile" } }
      : "/leaderboard";
  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<GameHistorySummaryDTO[]>([]);
  const [officialStats, setOfficialStats] = useState<LeaderboardEntryDTO | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([fetchRoster(), fetchHistory(), fetchLeaderboard()])
      .then(([roster, history, entries]) => {
        if (!active) return;
        setPlayer(roster.players.find((entry) => entry.id === id) ?? null);
        setGames(history.games);
        setOfficialStats(entries.find((entry) => entry.playerId === id));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary as string} />
      </ScreenContainer>
      </>
    );
  }

  if (!player) {
    return (
      <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
      <ScreenContainer style={styles.center}>
        <Text style={styles.helper}>{t("player.missing")}</Text>
      </ScreenContainer>
      </>
    );
  }

  return (
    <>
    <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
    <ScreenContainer>
      <PlayerStatsView
        player={player}
        games={games}
        officialStats={officialStats}
        locale={locale}
        t={t}
        fromPath="leaderboard"
        leaderboardOrigin={from}
      />
    </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
  });
}
