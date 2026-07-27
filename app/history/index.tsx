import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchHistory } from "@/api/games";
import type { GameHistorySummaryDTO } from "@/api/types";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function HistoryScreen() {
  const { locale, t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [games, setGames] = useState<GameHistorySummaryDTO[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      fetchHistory().then((result) => {
        if (!active) return;
        setGames(result.games);
        setFromCache(result.fromCache);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScreenContainer>
      <ScreenIntro title={t("history.title")} description={t("history.description")} />
      {fromCache && (
        <Text style={styles.helper}>
          {t("history.offline")}
        </Text>
      )}
      {loading && <Text style={styles.helper}>{t("history.loading")}</Text>}
      {!loading && games.length === 0 && <Text style={styles.helper}>{t("history.empty")}</Text>}

      {games.map((g) => (
        <Pressable
          key={g.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/history/[id]", params: { id: g.id } })}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.gameCard}>
            <View style={styles.titleRow}>
              <Text style={styles.date}>
                {new Date(g.startedAt).toLocaleDateString(locale, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }).toUpperCase()}
              </Text>
              <Text style={styles.meta}>{t(`mode.${g.mode}`)} · {g.numPlayers} {t("history.players")}</Text>
            </View>
            <View style={styles.winnerRow}>
              <View style={styles.mark}>
                <Image source={require("../../assets/design/suit-mask.png")} resizeMode="contain" style={styles.markImage} />
              </View>
              <View style={styles.winnerInfo}>
                <Text style={styles.winnerLabel}>{t("history.winner")}</Text>
                <Text style={styles.winnerName}>{g.standings[0]?.name ?? "—"}</Text>
                <Text style={styles.others}>
                  {g.standings.slice(1).map((standing) => standing.name).join(" · ") || t("history.twoPlayers")}
                </Text>
              </View>
              <Text style={styles.winnerScore}>{g.standings[0]?.total ?? 0}</Text>
            </View>
            <Text style={styles.openHint}>{t("history.openRounds")}</Text>
          </Card>
        </Pressable>
      ))}
    </ScreenContainer>
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
