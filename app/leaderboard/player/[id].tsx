import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";

import { fetchHistory } from "@/api/games";
import { fetchRoster } from "@/api/players";
import type { GameHistorySummaryDTO } from "@/api/types";
import { PlayerStatsView } from "@/components/PlayerStatsView";
import { ScreenContainer } from "@/components/ScreenContainer";
import type { Player } from "@/game/types";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function LeaderboardPlayerScreen() {
  const { locale, t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<GameHistorySummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([fetchRoster(), fetchHistory()])
      .then(([roster, history]) => {
        if (!active) return;
        setPlayer(roster.players.find((entry) => entry.id === id) ?? null);
        setGames(history.games);
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
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary as string} />
      </ScreenContainer>
    );
  }

  if (!player) {
    return (
      <ScreenContainer style={styles.center}>
        <Text style={styles.helper}>{t("player.missing")}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PlayerStatsView player={player} games={games} locale={locale} t={t} fromPath="leaderboard" />
    </ScreenContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
  });
}
