import { Stack, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { deleteFinishedGame, fetchGameHistoryDetail } from "@/api/games";
import type { GameHistoryDetailDTO } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";
import { formatAppDateTime } from "@/utils/date";

export default function HistoryDetailScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { account, token } = useAccount();
  const { id, from, playerId, leaderboardFrom } = useLocalSearchParams<{
    id: string;
    from?: string;
    playerId?: string;
    leaderboardFrom?: string;
  }>();
  const backDestination: Href =
    from === "profile"
      ? "/profile"
      : from === "leaderboard"
        ? "/leaderboard"
        : from === "leaderboard-player" && playerId
          ? {
              pathname: "/leaderboard/player/[id]",
              params: {
                id: playerId,
                from: leaderboardFrom ?? "leaderboard",
              },
            }
        : from === "admin-history"
          ? { pathname: "/history", params: { from: "admin" } }
          : "/history";
  const [game, setGame] = useState<GameHistoryDetailDTO | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchGameHistoryDetail(id, token)
      .then((result) => {
        if (!active) return;
        setGame(result.game);
        setFromCache(result.fromCache);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : t("history.unavailable"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, token]);

  const playerById = useMemo(
    () => new Map(game?.players.map((player) => [player.id, player.name]) ?? []),
    [game],
  );

  const requestDelete = () => {
    if (!game || !token) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!game || !token) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deleteFinishedGame(game.id, token);
      router.dismissTo(backDestination);
    } catch (reason) {
      Alert.alert(
        t("history.deleteFailed"),
        reason instanceof Error ? reason.message : t("history.retry"),
      );
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
        <ScreenContainer style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary as string} />
          <Text style={styles.helper}>{t("history.loadingRounds")}</Text>
        </ScreenContainer>
      </>
    );
  }

  if (!game || error) {
    return (
      <>
        <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
        <ScreenContainer style={styles.center}>
          <Text style={styles.error}>{error ?? t("history.notFound")}</Text>
          <Button label={t("history.back")} variant="secondary" onPress={() => router.dismissTo(backDestination)} />
        </ScreenContainer>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t("history.deleteTitle")}
        description={t("history.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ScreenContainer>
      <View>
        <ScreenIntro
          title={t(`mode.${game.mode}`)}
          description={`${formatAppDateTime(game.startedAt)} · ${game.numPlayers} ${t("history.players")}`}
        />
        {fromCache && <Text style={styles.cacheNotice}>{t("history.localCopy")}</Text>}
      </View>

      <Card>
        <Text style={styles.sectionTitle}>
          {game.mode === "manuale" ? t("history.manualParticipants") : t("history.finalStandings")}
        </Text>
        {game.standings.map((standing, index) => (
          <View key={standing.playerId} style={styles.row}>
            <Text style={styles.position}>
              {game.mode === "manuale" && standing.playerId === game.winnerId ? "🏆" : index + 1}
            </Text>
            <Text style={styles.name}>{standing.name}</Text>
            <Text style={[styles.score, (standing.total ?? 0) < 0 && styles.negative]}>
              {standing.total ?? "—"}
            </Text>
          </View>
        ))}
      </Card>

      {game.mode === "manuale" && <Text style={styles.helper}>{t("history.manualNoRounds")}</Text>}
      {game.mode !== "manuale" && <Text style={styles.sectionTitle}>{t("history.allRounds")}</Text>}
      {game.rounds.map((round) => (
        <Card key={round.index}>
          <Text style={styles.roundTitle}>
            {t("game.round")} {round.index} · {round.cardsDealt} {t("game.cards")}
          </Text>
          <Text style={styles.helper}>
            {t("history.dealer")}: {playerById.get(round.dealerId) ?? "—"} · {t("game.trick")} ±{round.presaValue} · {t("game.respect")} +{" "}
            {round.rispettoValue}
          </Text>
          {round.results.map((result) => (
            <View key={result.playerId} style={styles.resultRow}>
              <View style={styles.resultInfo}>
                <Text style={styles.name}>{result.name}</Text>
                <Text style={styles.helper}>
                  {t("history.bid")} {result.bid} ·{" "}
                  {result.respected ? t("history.respected") : `${t("history.notRespected")} ${result.scarto}`}
                </Text>
              </View>
              <Text style={[styles.score, result.score < 0 && styles.negative]}>
                {result.score >= 0 ? "+" : ""}
                {result.score}
              </Text>
            </View>
          ))}
        </Card>
      ))}

      {account?.isAdmin && (
        <Button label={t("history.deleteGame")} variant="danger" loading={deleting} onPress={requestDelete} />
      )}
      </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
    error: {
      color: colors.danger,
      fontSize: theme.font.body,
      fontFamily: theme.font.family.semibold,
      textAlign: "center",
    },
    cacheNotice: {
      color: colors.warning,
      fontSize: theme.font.small,
      fontFamily: theme.font.family.semibold,
      marginTop: theme.spacing(0.5),
    },
    sectionTitle: { color: colors.text, fontSize: 17, fontFamily: theme.font.family.extraBold },
    roundTitle: { color: colors.primary, fontSize: theme.font.body, fontFamily: theme.font.family.extraBold },
    row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1), paddingVertical: 5 },
    position: { width: 22, color: colors.textMuted, fontFamily: theme.font.family.extraBold },
    name: { flex: 1, color: colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
    score: {
      color: colors.success,
      fontSize: theme.font.body,
      fontFamily: theme.font.family.extraBold,
      fontVariant: ["tabular-nums"],
    },
    negative: { color: colors.danger },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      paddingVertical: theme.spacing(0.75),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    resultInfo: { flex: 1, gap: 2 },
    deleteNote: {
      color: colors.textMuted,
      fontSize: theme.font.small,
      fontFamily: theme.font.family.medium,
      textAlign: "center",
    },
  });
}
