import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { NumberStepper } from "@/components/NumberStepper";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
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

  useEffect(() => {
    if (!game) {
      router.replace("/");
      return;
    }
    if (game.status !== "scoring") {
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
  const allDecided = game.pendingBids.every((b) => {
    const draft = drafts[b.playerId];
    if (!draft || draft.respected === null) return false;
    if (draft.respected === false) {
      return validateScarto(draft.scarto, currentRoundInfo.cardsDealt) === null;
    }
    return true;
  });

  const setRespected = (playerId: string, respected: boolean) => {
    setDrafts((prev) => ({ ...prev, [playerId]: { respected, scarto: prev[playerId]?.scarto ?? 1 } }));
  };

  const setScarto = (playerId: string, scarto: number) => {
    setDrafts((prev) => ({ ...prev, [playerId]: { respected: prev[playerId]?.respected ?? false, scarto } }));
  };

  const handleConfirm = () => {
    if (!allDecided) return;
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
    confirmRoundResults(results);
    router.replace(wasLastRound ? "/game/end" : "/game/bids");
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Punteggio turno {currentRoundInfo.index}</Text>
        <Text style={styles.helper}>
          {currentRoundInfo.cardsDealt} carte · Presa {currentRoundInfo.presaValue} pt · Rispetto{" "}
          {currentRoundInfo.rispettoValue} pt
        </Text>
      </View>

      <Button label="Vedi classifica" variant="ghost" onPress={() => router.push("/game/standings")} />

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
          <Card key={bid.playerId}>
            <View style={styles.playerHeader}>
              <PlayerAvatar name={player.name} photoUri={player.photoUri} size={44} />
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.helper}>Chiamata: {bid.bid}</Text>
              </View>
              {preview !== null && (
                <Text style={[styles.score, preview < 0 && styles.scoreNegative]}>
                  {preview >= 0 ? "+" : ""}
                  {preview}
                </Text>
              )}
            </View>

            <View style={styles.respectRow}>
              <Pressable
                onPress={() => setRespected(bid.playerId, true)}
                style={[styles.respectBtn, draft.respected === true && styles.respectBtnYes]}
              >
                <Text style={styles.respectLabel}>Ha rispettato</Text>
              </Pressable>
              <Pressable
                onPress={() => setRespected(bid.playerId, false)}
                style={[styles.respectBtn, draft.respected === false && styles.respectBtnNo]}
              >
                <Text style={styles.respectLabel}>Non ha rispettato</Text>
              </Pressable>
            </View>

            {draft.respected === false && (
              <View style={styles.scartoRow}>
                <Text style={styles.helper}>Di quante prese ha sbagliato?</Text>
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

      <Button label="Conferma turno" onPress={handleConfirm} disabled={!allDecided} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  error: { color: theme.colors.danger, fontSize: theme.font.small, fontWeight: "600" },
  playerHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1.5) },
  playerInfo: { flex: 1 },
  playerName: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  score: { fontSize: theme.font.heading, fontWeight: "800", color: theme.colors.success },
  scoreNegative: { color: theme.colors.danger },
  respectRow: { flexDirection: "row", gap: theme.spacing(1) },
  respectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
  },
  respectBtnYes: { borderColor: theme.colors.success, backgroundColor: "#1D3A2B" },
  respectBtnNo: { borderColor: theme.colors.danger, backgroundColor: "#3A231D" },
  respectLabel: { color: theme.colors.text, fontWeight: "700", fontSize: theme.font.small },
  scartoRow: { alignItems: "flex-start", gap: theme.spacing(1) },
});
