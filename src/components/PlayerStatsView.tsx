import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { GameHistorySummaryDTO } from "@/api/types";
import { Card } from "@/components/Card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { Player } from "@/game/types";
import type { TranslationKey } from "@/i18n/translations";
import { theme } from "@/theme";

interface PlayerStatsViewProps {
  player: Player;
  games: GameHistorySummaryDTO[];
  locale: string;
  t: (key: TranslationKey) => string;
  fromPath: string;
}

// Condiviso fra "Il mio profilo" (le proprie statistiche) e la scheda di un
// altro giocatore aperta dalla classifica generale: stessa vista, sola
// lettura, cambia solo quali partite vengono passate.
export function PlayerStatsView({ player, games, locale, t, fromPath }: PlayerStatsViewProps) {
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

  return (
    <>
      <Card style={styles.profileCard}>
        <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={78} />
        <Text style={styles.profileName}>{player.name}</Text>
      </Card>

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{myGames.length}</Text>
          <Text style={styles.statLabel}>{t("profile.games")}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.wins}</Text>
          <Text style={styles.statLabel}>{t("profile.wins")}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.average.toFixed(1)}</Text>
          <Text style={styles.statLabel}>{t("profile.average")}</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>{t("profile.myGames")}</Text>
      {myGames.map((game) => {
        const mine = game.standings.find((entry) => entry.playerId === player.id);
        const position = game.standings.findIndex((entry) => entry.playerId === player.id) + 1;
        return (
          <Pressable
            key={game.id}
            onPress={() => router.push({ pathname: "/history/[id]", params: { id: game.id, from: fromPath } })}
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

const styles = StyleSheet.create({
  helper: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.medium,
    marginTop: theme.spacing(0.5),
  },
  profileCard: { alignItems: "center", paddingVertical: 20 },
  profileName: { color: theme.colors.text, fontSize: theme.font.title, fontFamily: theme.font.family.extraBold },
  statsGrid: { flexDirection: "row", gap: theme.spacing(1) },
  statCard: { flex: 1, alignItems: "center", paddingHorizontal: theme.spacing(0.5) },
  statValue: { color: theme.colors.success, fontSize: theme.font.heading, fontFamily: theme.font.family.extraBold },
  statLabel: { color: theme.colors.textMuted, fontSize: 10, fontFamily: theme.font.family.semibold, textAlign: "center" },
  sectionTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontFamily: theme.font.family.extraBold },
  pressed: { opacity: 0.72 },
  gameRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
  gameInfo: { flex: 1 },
  gameTitle: { color: theme.colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
  gameScore: {
    color: theme.colors.success,
    fontSize: theme.font.heading,
    fontFamily: theme.font.family.extraBold,
    fontVariant: ["tabular-nums"],
  },
  negative: { color: theme.colors.danger },
});
