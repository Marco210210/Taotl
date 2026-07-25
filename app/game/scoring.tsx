import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

interface Draft {
  respected: boolean | null;
  scarto: number;
}

export default function ScoringScreen() {
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
      return validateScarto(draft.scarto, currentRoundInfo.cardsDealt) === null;
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
          label={canConfirm ? "Chiudi il turno" : "Segna tutti gli esiti"}
          trailing={canConfirm ? "→" : undefined}
          variant="success"
          onPress={handleConfirm}
          disabled={!canConfirm}
        />
      }
    >
      <ScreenIntro
        title={`Esiti · turno ${currentRoundInfo.index}`}
        description="Segna chi ha rispettato la chiamata. Almeno una persona deve aver sbagliato."
      />
      <View style={styles.statsRow}>
        <StatBox label="CARTE A TESTA" value={currentRoundInfo.cardsDealt} />
        <StatBox label="PRESA" value={`± ${currentRoundInfo.presaValue}`} />
        <StatBox label="RISPETTO" value={`+ ${currentRoundInfo.rispettoValue}`} />
      </View>

      <Pressable onPress={() => router.push("/game/standings")} style={styles.standingsButton}>
        <Text style={styles.standingsText}>Vedi la classifica attuale ›</Text>
      </Pressable>

      {game.pendingBids.map((bid) => {
        const player = playerById.get(bid.playerId);
        const draft = drafts[bid.playerId];
        if (!player || !draft) return null;
        const scartoError =
          draft.respected === false ? validateScarto(draft.scarto, currentRoundInfo.cardsDealt) : null;
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
                <Text style={styles.helper}>ha chiamato {bid.bid} {bid.bid === 1 ? "presa" : "prese"}</Text>
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
                  Rispettata
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRespected(bid.playerId, false)}
                style={[styles.respectBtn, draft.respected === false && styles.respectBtnNo]}
              >
                <Text style={[styles.respectLabel, draft.respected === false && styles.activeRespectLabel]}>
                  Sbagliata
                </Text>
              </Pressable>
            </View>

            {draft.respected === false && (
              <View style={styles.scartoRow}>
                <Text style={styles.scartoLabel}>Prese di scarto</Text>
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
          Non possono rispettare tutti: in ogni turno almeno un giocatore deve non rispettare la chiamata.
        </Text>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 7 },
  helper: { fontSize: 11, color: theme.colors.textMuted, fontFamily: theme.font.family.semibold, marginTop: 2 },
  error: { color: theme.colors.danger, fontSize: theme.font.small, fontFamily: theme.font.family.semibold },
  constraintError: {
    color: theme.colors.danger,
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: theme.font.family.bold,
    textAlign: "center",
    borderRadius: 11,
    padding: 12,
    backgroundColor: theme.colors.negativeSoft,
  },
  standingsButton: {
    minHeight: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.inkSoft,
  },
  standingsText: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 11.5 },
  playerCard: { padding: 13, gap: 12 },
  playerHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 14.5, fontFamily: theme.font.family.bold, color: theme.colors.text },
  score: {
    minWidth: 46,
    textAlign: "right",
    fontSize: 19,
    fontFamily: theme.font.family.extraBold,
    fontVariant: ["tabular-nums"],
    color: theme.colors.success,
  },
  scorePending: { color: theme.colors.textFaint },
  scoreNegative: { color: theme.colors.danger },
  respectRow: { flexDirection: "row", gap: 8 },
  respectBtn: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 12,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.inkSoft,
  },
  respectBtnYes: { backgroundColor: theme.colors.success },
  respectBtnNo: { backgroundColor: theme.colors.danger },
  respectLabel: { color: theme.colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 12.5 },
  activeRespectLabel: { color: theme.colors.background },
  scartoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 3,
  },
  scartoLabel: { color: theme.colors.danger, fontFamily: theme.font.family.bold, fontSize: 11.5 },
});
