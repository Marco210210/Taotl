import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NumberStepper } from "@/components/NumberStepper";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { StatBox } from "@/components/StatBox";
import { maxFirstTurnCards, validatePersonalizzataCards } from "@/game/modes";
import type { ActiveGame, Bid, Player, RoundInfo } from "@/game/types";
import { getForbiddenBidForDealer } from "@/game/validation";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useGame } from "@/state/GameContext";
import { theme, type ThemeColors } from "@/theme";

export default function BidsScreen() {
  const {
    game,
    currentRoundInfo,
    previousCardsDealt,
    setPendingCards,
    reopenCards,
    setBidDraft,
    confirmBids,
    undoLastRound,
  } = useGame();
  const { t } = useAppSettings();
  const [showCorrectPreviousConfirm, setShowCorrectPreviousConfirm] = useState(false);

  useEffect(() => {
    if (!game) router.replace("/");
    else if (game.status === "scoring") router.replace("/game/scoring");
    else if (game.status === "finished") router.replace("/game/end");
  }, [game]);

  if (!game) return null;

  const correctPreviousRound = () => {
    setShowCorrectPreviousConfirm(false);
    undoLastRound();
    router.replace("/game/scoring");
  };

  const correctPreviousDialog = (
    <ConfirmDialog
      visible={showCorrectPreviousConfirm}
      title={t("game.correctPreviousTitle")}
      description={t("game.correctPreviousDescription")}
      confirmLabel={t("game.correctPreviousConfirm")}
      cancelLabel={t("common.cancel")}
      onConfirm={correctPreviousRound}
      onCancel={() => setShowCorrectPreviousConfirm(false)}
    />
  );

  if (game.status === "awaiting-cards") {
    return (
      <>
        {correctPreviousDialog}
        <CardsStep
          game={game}
          previousCardsDealt={previousCardsDealt}
          onConfirm={setPendingCards}
          onCorrectPrevious={game.rounds.length > 0 ? () => setShowCorrectPreviousConfirm(true) : undefined}
        />
      </>
    );
  }

  if (game.status === "bidding" && currentRoundInfo) {
    return (
      <>
        {correctPreviousDialog}
        <BiddingStep
          players={game.players}
          roundInfo={currentRoundInfo}
          bidDrafts={game.pendingBidDrafts ?? []}
          onChangeBid={setBidDraft}
          onConfirm={confirmBids}
          onChangeCards={game.mode === "personalizzata" ? reopenCards : undefined}
          onCorrectPrevious={game.rounds.length > 0 ? () => setShowCorrectPreviousConfirm(true) : undefined}
        />
      </>
    );
  }

  return null;
}

function CardsStep({
  game,
  previousCardsDealt,
  onConfirm,
  onCorrectPrevious,
}: {
  game: ActiveGame;
  previousCardsDealt: number | null;
  onConfirm: (cardsDealt: number) => void;
  onCorrectPrevious?: () => void;
}) {
  const { resolvedLanguage, t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const numPlayers = game.players.length;
  const roundIndex = game.rounds.length + 1;
  const defaultMax = previousCardsDealt !== null ? previousCardsDealt - 1 : maxFirstTurnCards(numPlayers);
  const [value, setValue] = useState(Math.max(1, defaultMax));
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const nextError = validatePersonalizzataCards({
      candidate: value,
      previousCardsDealt,
      numPlayers,
      roundIndex,
    }, resolvedLanguage);
    if (nextError) {
      setError(nextError);
      return;
    }
    setError(null);
    onConfirm(value);
  };

  return (
    <ScreenContainer
      footer={<Button label={t("game.confirmCards")} trailing="→" variant="secondary" onPress={handleConfirm} />}
    >
      <ScreenIntro
        title={`${t("game.round")} ${roundIndex}`}
        description={
          previousCardsDealt !== null
            ? `${t("game.previousCards")} ${previousCardsDealt}. ${t("game.chooseLower")}`
            : `${t("game.chooseCards")} ${numPlayers} ${t("home.players")}: ${t("game.maximum")} ${maxFirstTurnCards(numPlayers)}.`
        }
      />

      {game.rounds.length > 0 && <MiniStandings />}

      <Card style={styles.cardsCard}>
        <Text style={styles.eyebrow}>{t("game.cardsEach")}</Text>
        <NumberStepper value={value} min={1} max={Math.max(1, defaultMax)} onChange={setValue} />
        <Text style={styles.cardsHint}>{t("game.customHint")}</Text>
      </Card>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.utilityRow}>
        <Pressable onPress={() => router.push("/game/standings")} style={styles.utilityButton}>
          <Text style={styles.utilityText}>{t("game.standings")}</Text>
        </Pressable>
        {roundIndex === 1 && (
          <Pressable onPress={() => router.push("/game/dealer")} style={styles.utilityButton}>
            <Text style={styles.utilityText}>{t("game.fixDealer")}</Text>
          </Pressable>
        )}
        {onCorrectPrevious && (
          <Pressable onPress={onCorrectPrevious} style={styles.utilityButton}>
            <Text style={styles.utilityText}>{t("game.correctPreviousRound")}</Text>
          </Pressable>
        )}
      </View>
    </ScreenContainer>
  );
}

function MiniStandings() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { game, ranked } = useGame();
  if (!game) return null;
  const playerById = new Map(game.players.map((player) => [player.id, player]));
  return (
    <View style={styles.miniStandings}>
      <View style={styles.miniHeader}>
        <Text style={styles.eyebrow}>{t("game.currentStandings")}</Text>
        <Pressable onPress={() => router.push("/game/standings")}>
          <Text style={styles.miniLink}>{t("game.detail")}</Text>
        </Pressable>
      </View>
      {ranked.slice(0, 4).map((entry, index) => {
        const player = playerById.get(entry.playerId);
        return (
          <View key={entry.playerId} style={styles.miniRow}>
            <Text style={styles.miniPosition}>{index + 1}</Text>
            <PlayerAvatar name={player?.name ?? "?"} photoUri={player?.photoUri} colorKey={entry.playerId} size={24} />
            <Text style={styles.miniName}>{player?.name}</Text>
            <Text style={styles.miniTotal}>{entry.total}</Text>
          </View>
        );
      })}
    </View>
  );
}

function BiddingStep({
  players,
  roundInfo,
  bidDrafts,
  onChangeBid,
  onConfirm,
  onChangeCards,
  onCorrectPrevious,
}: {
  players: Player[];
  roundInfo: RoundInfo;
  bidDrafts: Bid[];
  onChangeBid: (playerId: string, bid: number) => void;
  onConfirm: (bids: Bid[]) => void;
  onChangeCards?: () => void;
  onCorrectPrevious?: () => void;
}) {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, fontScale } = useWindowDimensions();
  const useCompactRows = width < 360 || fontScale > 1.2;
  const calls = useMemo<Record<string, number>>(
    () => Object.fromEntries([
      ...roundInfo.biddingOrder.map((playerId) => [playerId, 0] as const),
      ...bidDrafts.map(({ playerId, bid }) => [playerId, bid] as const),
    ]),
    [bidDrafts, roundInfo.biddingOrder],
  );
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const dealerId = roundInfo.dealerId;
  const otherBidsSum = roundInfo.biddingOrder
    .filter((playerId) => playerId !== dealerId)
    .reduce((sum, playerId) => sum + (calls[playerId] ?? 0), 0);
  const forbiddenBid = getForbiddenBidForDealer(otherBidsSum, roundInfo.cardsDealt);
  const total = roundInfo.biddingOrder.reduce((sum, playerId) => sum + (calls[playerId] ?? 0), 0);
  const dealerHasForbiddenBid = forbiddenBid !== null && calls[dealerId] === forbiddenBid;
  const valid = total !== roundInfo.cardsDealt && !dealerHasForbiddenBid;

  const confirm = () => {
    if (!valid) return;
    onConfirm(
      roundInfo.biddingOrder.map((playerId) => ({
        playerId,
        bid: calls[playerId] ?? 0,
      })),
    );
  };

  return (
    <ScreenContainer
      footer={
        <View style={styles.bidFooter}>
          <View style={styles.sumLine}>
            <Text style={styles.sumLabel}>{t("game.bidsSum")}</Text>
            <Text style={[styles.sumValue, !valid && styles.invalidSum]}>
              {total} / {roundInfo.cardsDealt} {t("game.cards")}
            </Text>
          </View>
          <Button
            label={valid ? t("game.recordResults") : `${t("game.sumCannot")} ${roundInfo.cardsDealt}`}
            trailing={valid ? "→" : undefined}
            variant="secondary"
            onPress={confirm}
            disabled={!valid}
          />
        </View>
      }
    >
      <ScreenIntro
        title={`${t("game.bidsTitle")} · ${t("game.round").toLowerCase()} ${roundInfo.index}`}
        description={t("game.bidsDescription")}
      />

      <View style={styles.statsRow}>
        <StatBox label={t("game.cardsEach")} value={roundInfo.cardsDealt} />
        <StatBox label={t("game.trick")} value={`± ${roundInfo.presaValue}`} />
        <StatBox label={t("game.respect")} value={`+ ${roundInfo.rispettoValue}`} />
      </View>

      <View style={styles.utilityRow}>
        <Pressable onPress={() => router.push("/game/standings")} style={styles.utilityButton}>
          <Text style={styles.utilityText}>{t("game.standings")}</Text>
        </Pressable>
        {roundInfo.index === 1 && (
          <Pressable onPress={() => router.push("/game/dealer")} style={styles.utilityButton}>
            <Text style={styles.utilityText}>{t("game.fixDealer")}</Text>
          </Pressable>
        )}
        {onChangeCards && (
          <Pressable onPress={onChangeCards} style={styles.utilityButton}>
            <Text style={styles.utilityText}>{t("game.changeCards")}</Text>
          </Pressable>
        )}
        {onCorrectPrevious && (
          <Pressable onPress={onCorrectPrevious} style={styles.utilityButton}>
            <Text style={styles.utilityText} numberOfLines={2}>{t("game.correctPreviousRound")}</Text>
          </Pressable>
        )}
      </View>

      {dealerHasForbiddenBid && (
        <Text style={styles.bidWarning}>
          {t("game.dealerBidWarning")} {forbiddenBid}. {t("game.chooseAnotherBid")}
        </Text>
      )}

      <View style={styles.callsList}>
        {roundInfo.biddingOrder.map((playerId) => {
          const player = playerById.get(playerId);
          if (!player) return null;
          const isDealer = playerId === dealerId;
          const value = calls[playerId] ?? 0;
          const expected = value * roundInfo.presaValue + roundInfo.rispettoValue;
          return (
            <View key={playerId} style={[styles.callRow, useCompactRows && styles.callRowCompact]}>
              <View style={[styles.callIdentity, !useCompactRows && styles.callIdentityRegular]}>
                <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={36} />
                <View style={styles.callInfo}>
                  <Text style={styles.callName}>{player.name}</Text>
                  <Text style={[styles.callMeta, isDealer && styles.dealerMeta]}>
                    {isDealer
                      ? `${t("game.dealer")} · ${t("game.cannotBid")} ${forbiddenBid ?? "—"}`
                      : `${value} ${value === 1 ? t("game.trickSingle") : t("game.trickPlural")} = ${expected} ${t("game.pointsIfRespected")}`}
                  </Text>
                </View>
              </View>
              <NumberStepper
                value={value}
                min={0}
                max={roundInfo.cardsDealt}
                // Lo zero resta selezionabile: se è vietato mostriamo l'avviso,
                // senza spostare automaticamente alcuna chiamata. Da 1 in su,
                // invece, lo stepper del solo mazziere salta il valore vietato.
                disabledValues={isDealer && forbiddenBid !== null && forbiddenBid >= 1 ? [forbiddenBid] : []}
                onChange={(next) => onChangeBid(playerId, next)}
              />
            </View>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    statsRow: { flexDirection: "row", gap: 7 },
    cardsCard: { alignItems: "center", gap: 16, paddingVertical: 24 },
    eyebrow: {
      color: colors.textMuted,
      fontFamily: theme.font.family.bold,
      fontSize: 9.5,
      letterSpacing: 1.2,
    },
    cardsHint: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11, textAlign: "center" },
    error: {
      padding: 13,
      borderRadius: 11,
      color: colors.danger,
      backgroundColor: colors.negativeSoft,
      fontFamily: theme.font.family.semibold,
      fontSize: 11.5,
      lineHeight: 17,
    },
    utilityRow: { flexDirection: "row", gap: 8 },
    utilityButton: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inkSoft,
    },
    utilityText: {
      color: colors.text,
      fontFamily: theme.font.family.bold,
      fontSize: 11.5,
      lineHeight: 15,
      textAlign: "center",
      flexShrink: 1,
    },
    callsList: { gap: 9 },
    callRow: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    callRowCompact: { alignItems: "stretch", flexDirection: "column" },
    callIdentity: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
    callIdentityRegular: { flex: 1 },
    callInfo: { flex: 1, minWidth: 0 },
    callName: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 14.5 },
    callMeta: { marginTop: 2, color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 10.5 },
    dealerMeta: { color: colors.terracotta },
    bidWarning: {
      padding: 12,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.warning,
      color: colors.warning,
      backgroundColor: colors.negativeSoft,
      fontFamily: theme.font.family.bold,
      fontSize: 11.5,
      lineHeight: 17,
      textAlign: "center",
    },
    bidFooter: { gap: 9 },
    sumLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sumLabel: { color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 12 },
    sumValue: {
      color: colors.success,
      fontFamily: theme.font.family.extraBold,
      fontSize: 14,
      fontVariant: ["tabular-nums"],
    },
    invalidSum: { color: colors.danger },
    miniStandings: {
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 6,
    },
    miniHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    miniLink: { color: colors.success, fontFamily: theme.font.family.bold, fontSize: 10.5 },
    miniRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 5 },
    miniPosition: { width: 18, color: colors.textFaint, fontFamily: theme.font.family.extraBold, fontSize: 11 },
    miniName: { flex: 1, color: colors.text, fontFamily: theme.font.family.semibold, fontSize: 12.5 },
    miniTotal: {
      color: colors.text,
      fontFamily: theme.font.family.extraBold,
      fontSize: 13,
      fontVariant: ["tabular-nums"],
    },
  });
}
