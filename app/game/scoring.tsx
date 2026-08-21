import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NumberStepper } from "@/components/NumberStepper";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { StatBox } from "@/components/StatBox";
import { computePlayerScore } from "@/game/scoring";
import type { PendingResultDraft, RoundPlayerResult } from "@/game/types";
import { validateScarto } from "@/game/validation";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useGame } from "@/state/GameContext";
import { theme, type ThemeColors } from "@/theme";

export default function ScoringScreen() {
  const { resolvedLanguage, t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { game, currentRoundInfo, confirmRoundResults, reopenBids, setResultDraft } = useGame();
  const [showRedealConfirm, setShowRedealConfirm] = useState(false);
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

  if (!game || game.status !== "scoring" || !currentRoundInfo) return null;

  const playerById = new Map(game.players.map((p) => [p.id, p]));
  const draftByPlayer = new Map(
    (game.pendingResultDrafts ?? []).map((draft) => [draft.playerId, draft]),
  );
  const getDraft = (playerId: string): PendingResultDraft => {
    const stored = draftByPlayer.get(playerId);
    return stored
      ? { ...stored, scarto: Math.max(1, stored.scarto) }
      : { playerId, respected: null, scarto: 1 };
  };
  const totalBids = game.pendingBids.reduce((sum, bid) => sum + bid.bid, 0);
  const allPlayersDecided = game.pendingBids.every((b) => {
    const draft = getDraft(b.playerId);
    if (draft.respected === null) return false;
    if (draft.respected === false) {
      return validateScarto(draft.scarto, currentRoundInfo.cardsDealt, resolvedLanguage) === null;
    }
    return true;
  });
  const hasMissedBid = game.pendingBids.some((bid) => getDraft(bid.playerId).respected === false);
  const canConfirm = allPlayersDecided && hasMissedBid;

  const setRespected = (playerId: string, respected: boolean) => {
    setResultDraft(playerId, respected, getDraft(playerId).scarto);
  };

  const setScarto = (playerId: string, scarto: number) => {
    setResultDraft(playerId, getDraft(playerId).respected ?? false, scarto);
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    const results: RoundPlayerResult[] = game.pendingBids.map((b) => {
      const draft = getDraft(b.playerId);
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

  const handleRedeal = () => setShowRedealConfirm(true);

  const confirmRedeal = () => {
    setShowRedealConfirm(false);
    reopenBids();
    router.replace("/game/bids");
  };

  return (
    <>
    <ConfirmDialog
      visible={showRedealConfirm}
      title={t("game.redealTitle")}
      description={t("game.redealDescription")}
      confirmLabel={t("game.redealConfirm")}
      cancelLabel={t("common.cancel")}
      destructive
      onConfirm={confirmRedeal}
      onCancel={() => setShowRedealConfirm(false)}
    />
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
        <StatBox label={t("game.bidsOnCards")} value={`${totalBids}/${currentRoundInfo.cardsDealt}`} />
        <StatBox label={t("game.trick")} value={`± ${currentRoundInfo.presaValue}`} />
        <StatBox label={t("game.respect")} value={`+ ${currentRoundInfo.rispettoValue}`} />
      </View>

      <View style={styles.utilityRow}>
        <Pressable onPress={() => router.push("/game/standings")} style={styles.utilityButton}>
          <Text style={styles.utilityText}>{t("game.viewStandings")}</Text>
        </Pressable>
        <Pressable onPress={handleRedeal} style={[styles.utilityButton, styles.redealButton]}>
          <Text style={[styles.utilityText, styles.redealText]}>{t("game.redealBids")}</Text>
        </Pressable>
      </View>

      {game.pendingBids.map((bid) => {
        const player = playerById.get(bid.playerId);
        const draft = getDraft(bid.playerId);
        if (!player) return null;
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
    </>
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
    utilityRow: { flexDirection: "row", gap: 8 },
    utilityButton: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: 8,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inkSoft,
    },
    utilityText: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 11, textAlign: "center" },
    redealButton: { borderWidth: 1, borderColor: colors.warning },
    redealText: { color: colors.warning },
    playerCard: { padding: 13, gap: 12 },
    playerHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    playerInfo: { flex: 1, minWidth: 0 },
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
