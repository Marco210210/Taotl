import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { NumberStepper } from "@/components/NumberStepper";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { StatBox } from "@/components/StatBox";
import { computePlayerScore } from "@/game/scoring";
import type { RoundPlayerResult } from "@/game/types";
import { validateScarto } from "@/game/validation";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useGame } from "@/state/GameContext";
import { theme, type ThemeColors } from "@/theme";

interface Draft {
  respected: boolean | null;
  scarto: number;
}

export default function ScoringScreen() {
  const { resolvedLanguage, t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { game, currentRoundInfo, confirmRoundResults } = useGame();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const isSubmitting = useRef(false);

  useEffect(() => {
    if (!game) {
      router.replace("/");
      return;
    }
    if (game.status !== "scoring" && !isSubmitting.current) {
      router.replace("/game/bids");
    }
  }, [game]);

  useEffect(() => {
    if (game?.status === "scoring") {
      const initial: Record<string, Draft> = {};
      for (const bid of game.pendingBids) {
        initial[bid.playerId] = { respected: null, scarto: 1 };
      }
      setDrafts(initial);
    }
    // Si reinizializza solo quando inizia un nuovo turno di punteggio, non ad ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.rounds.length]);

  if (!game || game.status !== "scoring" || !currentRoundInfo) return null;

  const playerById = new Map(game.players.map((p) => [p.id, p]));
  const allPlayersDecided = game.pendingBids.every((b) => {
    const draft = drafts[b.playerId];
    if (!draft || draft.respected === null) return false;
    if (draft.respected === false) {
      return validateScarto(draft.scarto, currentRoundInfo.cardsDealt, resolvedLanguage) === null;
    }
    return true;
  });
  const hasMissedBid = game.pendingBids.some((bid) => drafts[bid.playerId]?.respected === false);
  const canConfirm = allPlayersDecided && hasMissedBid;

  const setRespected = (playerId: string, respected: boolean) => {
    setDrafts((prev) => ({ ...prev, [playerId]: { respected, scarto: prev[playerId]?.scarto ?? 1 } }));
  };

  const setScarto = (playerId: string, scarto: number) => {
    setDrafts((prev) => ({ ...prev, [playerId]: { respected: prev[playerId]?.respected ?? false, scarto } }));
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    const results: RoundPlayerResult[] = game.pendingBids.map((b) => {
      const draft = drafts[b.playerId];
      const respected = draft.respected === true;
      const scarto = respected ? 0 : draft.scarto;
      const score = computePlayerScore({
        bid: b.bid,
        respected,
        scarto,
        presaValue: currentRoundInfo.presaValue,
        rispettoValue: currentRoundInfo.rispettoValue,
      });
      return { playerId: b.playerId, bid: b.bid, respected, scarto, score };
    });
    const wasLastRound = currentRoundInfo.cardsDealt === 1;
    isSubmitting.current = true;
    confirmRoundResults(results);
    router.replace(wasLastRound ? "/game/end" : "/game/standings");
  };

  return (
    <ScreenContainer
      footer={
        <Button
          label={canConfirm ? t("game.closeRound") : t("game.markAll")}
          trailing={canConfirm ? "→" : undefined}
          variant="success"
          onPress={handleConfirm}
          disabled={!canConfirm}
        />
      }
    >
      <ScreenIntro
        title={`${t("game.resultsTitle")} · ${t("game.round").toLowerCase()} ${currentRoundInfo.index}`}
        description={t("game.resultsDescription")}
      />
      <View style={styles.statsRow}>
        <StatBox label={t("game.cardsEach")} value={currentRoundInfo.cardsDealt} />
        <StatBox label={t("game.trick")} value={`± ${currentRoundInfo.presaValue}`} />
        <StatBox label={t("game.respect")} value={`+ ${currentRoundInfo.rispettoValue}`} />
      </View>

      <Pressable onPress={() => router.push("/game/standings")} style={styles.standingsButton}>
        <Text style={styles.standingsText}>{t("game.viewStandings")}</Text>
      </Pressable>

      {game.pendingBids.map((bid) => {
        const player = playerById.get(bid.playerId);
        const draft = drafts[bid.playerId];
        if (!player || !draft) return null;
        const scartoError =
          draft.respected === false ? validateScarto(draft.scarto, currentRoundInfo.cardsDealt, resolvedLanguage) : null;
        const preview =
          draft.respected === null
            ? null
            : computePlayerScore({
                bid: bid.bid,
                respected: draft.respected,
                scarto: draft.respected ? 0 : draft.scarto,
                presaValue: currentRoundInfo.presaValue,
                rispettoValue: currentRoundInfo.rispettoValue,
              });

        return (
          <Card key={bid.playerId} style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={36} />
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.helper}>
                  {t("game.called")} {bid.bid} {bid.bid === 1 ? t("game.trickSingle") : t("game.trickPlural")}
                </Text>
              </View>
              <Text style={[styles.score, preview === null && styles.scorePending, (preview ?? 0) < 0 && styles.scoreNegative]}>
                {preview === null ? "—" : (
                  <>
                  {preview >= 0 ? "+" : ""}
                  {preview}
                  </>
                )}
              </Text>
            </View>

            <View style={styles.respectRow}>
              <Pressable
                onPress={() => setRespected(bid.playerId, true)}
                style={[styles.respectBtn, draft.respected === true && styles.respectBtnYes]}
              >
                <Text style={[styles.respectLabel, draft.respected === true && styles.activeRespectLabel]}>
                  {t("game.respected")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRespected(bid.playerId, false)}
                style={[styles.respectBtn, draft.respected === false && styles.respectBtnNo]}
              >
                <Text style={[styles.respectLabel, draft.respected === false && styles.activeRespectLabel]}>
                  {t("game.missed")}
                </Text>
              </Pressable>
            </View>

            {draft.respected === false && (
              <View style={styles.scartoRow}>
                <Text style={styles.scartoLabel}>{t("game.missedBy")}</Text>
                <NumberStepper
                  value={draft.scarto}
                  min={1}
                  max={currentRoundInfo.cardsDealt}
                  onChange={(v) => setScarto(bid.playerId, v)}
                />
                {scartoError && <Text style={styles.error}>{scartoError}</Text>}
              </View>
            )}
          </Card>
        );
      })}

      {allPlayersDecided && !hasMissedBid && (
        <Text style={styles.constraintError}>
          {t("game.everyoneConstraint")}
        </Text>
      )}
    </ScreenContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    statsRow: { flexDirection: "row", gap: 7 },
    helper: { fontSize: 11, color: colors.textMuted, fontFamily: theme.font.family.semibold, marginTop: 2 },
    error: { color: colors.danger, fontSize: theme.font.small, fontFamily: theme.font.family.semibold },
    constraintError: {
      color: colors.danger,
      fontSize: 11.5,
      lineHeight: 17,
      fontFamily: theme.font.family.bold,
      textAlign: "center",
      borderRadius: 11,
      padding: 12,
      backgroundColor: colors.negativeSoft,
    },
    standingsButton: {
      minHeight: 44,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inkSoft,
    },
    standingsText: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 11.5 },
    playerCard: { padding: 13, gap: 12 },
    playerHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    playerInfo: { flex: 1 },
    playerName: { fontSize: 14.5, fontFamily: theme.font.family.bold, color: colors.text },
    score: {
      minWidth: 46,
      textAlign: "right",
      fontSize: 19,
      fontFamily: theme.font.family.extraBold,
      fontVariant: ["tabular-nums"],
      color: colors.success,
    },
    scorePending: { color: colors.textFaint },
    scoreNegative: { color: colors.danger },
    respectRow: { flexDirection: "row", gap: 8 },
    respectBtn: {
      flex: 1,
      minHeight: 46,
      paddingVertical: 12,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inkSoft,
    },
    respectBtnYes: { backgroundColor: colors.success },
    respectBtnNo: { backgroundColor: colors.danger },
    respectLabel: { color: colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 12.5 },
    activeRespectLabel: { color: colors.primaryText },
    scartoRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingTop: 3,
    },
    scartoLabel: { color: colors.danger, fontFamily: theme.font.family.bold, fontSize: 11.5 },
  });
}
