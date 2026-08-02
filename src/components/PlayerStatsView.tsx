import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { GameHistorySummaryDTO } from "@/api/types";
import { Card } from "@/components/Card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { Player } from "@/game/types";
import type { TranslationKey } from "@/i18n/translations";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

interface PlayerStatsViewProps {
  player: Player;
  games: GameHistorySummaryDTO[];
  officialStats?: {
    gamesPlayed: number;
    wins: number;
    rateWins: number;
  };
  locale: string;
  t: (key: TranslationKey) => string;
  fromPath: "profile" | "leaderboard";
  leaderboardOrigin?: string;
  showAccountInfo?: boolean;
  accountInfo?: {
    displayName: string;
    handle: string;
  } | null;
  accountInfoUnavailable?: boolean;
}

// Condiviso fra "Il mio profilo" (le proprie statistiche) e la scheda di un
// altro giocatore aperta dalla classifica generale: stessa vista, sola
// lettura, cambia solo quali partite vengono passate.
export function PlayerStatsView({
  player,
  games,
  officialStats,
  locale,
  t,
  fromPath,
  leaderboardOrigin,
  showAccountInfo = false,
  accountInfo = null,
  accountInfoUnavailable = false,
}: PlayerStatsViewProps) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const myGames = useMemo(
    () => games.filter((game) => game.standings.some((entry) => entry.playerId === player.id)),
    [games, player.id],
  );

  const stats = useMemo(() => {
    let wins = 0;
    let total = 0;
    for (const game of myGames) {
      const mine = game.standings.find((entry) => entry.playerId === player.id);
      if (!mine) continue;
      total += mine.total;
      const best = Math.max(...game.standings.map((entry) => entry.total));
      if (mine.total === best) wins += 1;
    }
    return { wins, total, average: myGames.length ? total / myGames.length : 0 };
  }, [myGames, player.id]);
  const gamesPlayed = officialStats?.gamesPlayed ?? myGames.length;
  const wins = officialStats?.wins ?? stats.wins;
  const rateWins = officialStats?.rateWins ?? stats.wins;
  const winRate = gamesPlayed > 0 ? (rateWins / gamesPlayed) * 100 : 0;
  const historicalWins = Math.max(0, wins - rateWins);

  return (
    <>
      <Card style={styles.profileCard}>
        <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={78} />
        <Text style={styles.profileName}>{player.name}</Text>
      </Card>

      {showAccountInfo && (
        <Card style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <Text style={styles.accountTitle}>{t("leaderboard.accountTitle")}</Text>
            {!accountInfoUnavailable && (
              <View style={[styles.accountBadge, !accountInfo && styles.accountBadgeMissing]}>
                <Text style={[styles.accountBadgeText, !accountInfo && styles.accountBadgeTextMissing]}>
                  {t(accountInfo ? "leaderboard.accountLinked" : "leaderboard.accountNotLinked")}
                </Text>
              </View>
            )}
          </View>
          {accountInfoUnavailable ? (
            <Text style={styles.accountError}>{t("leaderboard.accountUnavailable")}</Text>
          ) : accountInfo ? (
            <View>
              <Text style={styles.accountName}>{accountInfo.displayName}</Text>
              <Text style={styles.accountHandle}>@{accountInfo.handle}</Text>
            </View>
          ) : (
            <Text style={styles.accountHelper}>{t("leaderboard.accountMissingDescription")}</Text>
          )}
        </Card>
      )}

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{gamesPlayed}</Text>
          <Text style={styles.statLabel}>{t("profile.games")}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{wins}</Text>
          <Text style={styles.statLabel}>{t("profile.wins")}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{winRate.toFixed(1)}%</Text>
          <Text style={styles.statLabel}>{t("profile.winRate")}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.average.toFixed(1)}</Text>
          <Text style={styles.statLabel}>{t("profile.average")}</Text>
        </Card>
      </View>
      {historicalWins > 0 && (
        <Text style={styles.rateNote}>
          {historicalWins} {historicalWins === 1 ? t("profile.historicalWin") : t("profile.historicalWins")}
          {" "}{t("profile.excludedFromRate")}
        </Text>
      )}

      <Text style={styles.sectionTitle}>{t("profile.myGames")}</Text>
      {myGames.map((game) => {
        const mine = game.standings.find((entry) => entry.playerId === player.id);
        const position = game.standings.findIndex((entry) => entry.playerId === player.id) + 1;
        return (
          <Pressable
            key={game.id}
            onPress={() => router.push({
              pathname: "/history/[id]",
              params: fromPath === "profile"
                ? { id: game.id, from: "profile" }
                : {
                    id: game.id,
                    from: "leaderboard-player",
                    playerId: player.id,
                    leaderboardFrom: leaderboardOrigin ?? "leaderboard",
                  },
            })}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card>
              <View style={styles.gameRow}>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle}>
                    {new Date(game.startedAt).toLocaleDateString(locale)} · {game.numPlayers} {t("history.players")}
                  </Text>
                  <Text style={styles.helper}>{t("profile.position")} {position}</Text>
                </View>
                <Text style={[styles.gameScore, (mine?.total ?? 0) < 0 && styles.negative]}>
                  {mine?.total ?? 0}
                </Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {myGames.length === 0 && <Text style={styles.helper}>{t("profile.noGames")}</Text>}
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    helper: {
      fontSize: theme.font.small,
      color: colors.textMuted,
      fontFamily: theme.font.family.medium,
      marginTop: theme.spacing(0.5),
    },
    profileCard: { alignItems: "center", paddingVertical: 20 },
    profileName: { color: colors.text, fontSize: theme.font.title, fontFamily: theme.font.family.extraBold },
    accountCard: { gap: theme.spacing(1) },
    accountHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
    accountTitle: {
      flex: 1,
      color: colors.text,
      fontSize: theme.font.body,
      fontFamily: theme.font.family.extraBold,
    },
    accountBadge: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.positiveSoft,
    },
    accountBadgeMissing: { backgroundColor: colors.inkSoft },
    accountBadgeText: {
      color: colors.success,
      fontSize: 9,
      fontFamily: theme.font.family.extraBold,
      textTransform: "uppercase",
    },
    accountBadgeTextMissing: { color: colors.textMuted },
    accountName: { color: colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
    accountHandle: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: theme.font.small,
      fontFamily: theme.font.family.semibold,
    },
    accountHelper: { color: colors.textMuted, fontSize: theme.font.small, fontFamily: theme.font.family.medium },
    accountError: { color: colors.danger, fontSize: theme.font.small, fontFamily: theme.font.family.semibold },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(1) },
    statCard: { width: "48%", flexGrow: 1, alignItems: "center", paddingHorizontal: theme.spacing(0.5) },
    statValue: { color: colors.success, fontSize: 18, fontFamily: theme.font.family.extraBold },
    statLabel: { color: colors.textMuted, fontSize: 10, fontFamily: theme.font.family.semibold, textAlign: "center" },
    rateNote: {
      marginTop: -4,
      color: colors.textMuted,
      fontSize: 10.5,
      lineHeight: 16,
      fontFamily: theme.font.family.medium,
      textAlign: "center",
    },
    sectionTitle: { color: colors.text, fontSize: theme.font.heading, fontFamily: theme.font.family.extraBold },
    pressed: { opacity: 0.72 },
    gameRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
    gameInfo: { flex: 1 },
    gameTitle: { color: colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
    gameScore: {
      color: colors.success,
      fontSize: theme.font.heading,
      fontFamily: theme.font.family.extraBold,
      fontVariant: ["tabular-nums"],
    },
    negative: { color: colors.danger },
  });
}
