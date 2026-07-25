import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

export default function StandingsScreen() {
  const { game, ranked } = useGame();

  if (!game) {
    return (
      <ScreenContainer>
        <ScreenIntro title="Nessuna classifica" description="Non c’è una partita in corso." />
        <Button label="Torna alla home" onPress={() => router.replace("/")} />
      </ScreenContainer>
    );
  }

  const playerById = new Map(game.players.map((player) => [player.id, player]));
  const lastRound = game.rounds[game.rounds.length - 1];
  const lastScoreByPlayer = new Map(lastRound?.results.map((result) => [result.playerId, result.score]) ?? []);
  const nextCards = game.pendingCardsDealt;
  const footerLabel =
    game.status === "finished"
      ? "Vedi il risultato finale"
      : game.status === "scoring"
        ? "Torna agli esiti"
        : `Turno ${game.rounds.length + 1}${nextCards ? ` · ${nextCards} carte` : ""}`;
  const continueGame = () => {
    if (game.status === "finished") router.replace("/game/end");
    else if (game.status === "scoring") router.replace("/game/scoring");
    else router.replace("/game/bids");
  };

  return (
    <ScreenContainer
      footer={
        <Button
          label={footerLabel}
          trailing="→"
          variant="success"
          onPress={continueGame}
        />
      }
    >
      <ScreenIntro
        title="Classifica"
        description={`Dopo ${game.rounds.length} ${game.rounds.length === 1 ? "turno giocato" : "turni giocati"}`}
      />

      <View style={styles.ranking}>
        {ranked.map((entry, index) => {
          const player = playerById.get(entry.playerId);
          if (!player) return null;
          const delta = lastScoreByPlayer.get(entry.playerId);
          return (
            <View key={entry.playerId} style={[styles.rankRow, index === 0 && styles.firstRow]}>
              <Text style={[styles.position, index === 0 && styles.firstPosition]}>{index + 1}</Text>
              <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
              <View style={styles.playerInfo}>
                <Text style={styles.name}>{player.name}</Text>
                {delta !== undefined && (
                  <Text style={[styles.delta, delta < 0 && styles.negative]}>
                    ultimo turno {delta >= 0 ? "+" : ""}
                    {delta}
                  </Text>
                )}
              </View>
              <Text style={[styles.total, entry.total < 0 && styles.negative]}>{entry.total}</Text>
            </View>
          );
        })}
      </View>

      {game.rounds.length > 0 && (
        <Card style={styles.roundLog}>
          <Text style={styles.sectionTitle}>TURNO PER TURNO</Text>
          {[...game.rounds].reverse().map((round, roundIndex) => (
            <View key={round.info.index} style={[styles.roundBlock, roundIndex > 0 && styles.roundDivider]}>
              <View style={styles.roundHeader}>
                <Text style={styles.roundTitle}>Turno {round.info.index}</Text>
                <Text style={styles.roundMeta}>
                  {round.info.cardsDealt} carte · presa ±{round.info.presaValue} · rispetto +{round.info.rispettoValue}
                </Text>
              </View>
              <View style={styles.resultChips}>
                {round.results.map((result) => (
                  <View
                    key={result.playerId}
                    style={[styles.resultChip, result.score < 0 ? styles.negativeChip : styles.positiveChip]}
                  >
                    <Text style={styles.chipName}>{playerById.get(result.playerId)?.name}</Text>
                    <Text style={[styles.chipScore, result.score < 0 && styles.negative]}>
                      {result.score >= 0 ? "+" : ""}
                      {result.score}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  ranking: { gap: 8 },
  rankRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  firstRow: { backgroundColor: theme.colors.firstPlace },
  position: { width: 20, color: theme.colors.textMuted, fontFamily: theme.font.family.extraBold, fontSize: 15 },
  firstPosition: { color: theme.colors.gold },
  playerInfo: { flex: 1 },
  name: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 14.5 },
  delta: { marginTop: 2, color: theme.colors.success, fontFamily: theme.font.family.semibold, fontSize: 10.5 },
  total: {
    color: theme.colors.text,
    fontFamily: theme.font.family.extraBold,
    fontSize: 24,
    fontVariant: ["tabular-nums"],
  },
  negative: { color: theme.colors.danger },
  roundLog: { padding: 14, gap: 12 },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: 9.5,
    letterSpacing: 1.3,
  },
  roundBlock: { gap: 8 },
  roundDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12 },
  roundHeader: { gap: 2 },
  roundTitle: { color: theme.colors.text, fontFamily: theme.font.family.extraBold, fontSize: 12 },
  roundMeta: { color: theme.colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 10.5 },
  resultChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  resultChip: { flexDirection: "row", gap: 7, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  positiveChip: { backgroundColor: theme.colors.positiveSoft },
  negativeChip: { backgroundColor: theme.colors.negativeSoft },
  chipName: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 10.5 },
  chipScore: { color: theme.colors.success, fontFamily: theme.font.family.extraBold, fontSize: 11.5 },
});
