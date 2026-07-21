import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

export default function StandingsScreen() {
  const { game, ranked } = useGame();

  if (!game) {
    return (
      <ScreenContainer>
        <Text style={styles.helper}>Nessuna partita in corso.</Text>
      </ScreenContainer>
    );
  }

  const playerById = new Map(game.players.map((p) => [p.id, p]));

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Classifica</Text>
        <Text style={styles.helper}>
          Dopo {game.rounds.length} turn{game.rounds.length === 1 ? "o" : "i"} giocat
          {game.rounds.length === 1 ? "o" : "i"}
        </Text>
      </View>

      <Card>
        {ranked.map((entry, index) => {
          const player = playerById.get(entry.playerId);
          if (!player) return null;
          return (
            <View key={entry.playerId} style={styles.row}>
              <Text style={styles.position}>{index + 1}</Text>
              <PlayerAvatar name={player.name} photoUri={player.photoUri} size={36} />
              <Text style={styles.name}>{player.name}</Text>
              <Text style={[styles.total, entry.total < 0 && styles.totalNegative]}>{entry.total}</Text>
            </View>
          );
        })}
      </Card>

      {game.rounds.length > 0 && (
        <View style={styles.roundsList}>
          <Text style={styles.sectionTitle}>Storico turni</Text>
          {[...game.rounds].reverse().map((round) => (
            <Card key={round.info.index}>
              <Text style={styles.cardLabel}>
                Turno {round.info.index} · {round.info.cardsDealt} carte
              </Text>
              {round.results.map((result) => (
                <View key={result.playerId} style={styles.row}>
                  <Text style={styles.name}>{playerById.get(result.playerId)?.name}</Text>
                  <Text style={styles.helper}>chiamata {result.bid}</Text>
                  <Text style={[styles.total, result.score < 0 && styles.totalNegative]}>
                    {result.score >= 0 ? "+" : ""}
                    {result.score}
                  </Text>
                </View>
              ))}
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1.25), paddingVertical: 6 },
  position: { width: 22, color: theme.colors.textMuted, fontWeight: "700" },
  name: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, fontWeight: "600" },
  total: { fontSize: theme.font.heading, fontWeight: "800", color: theme.colors.success },
  totalNegative: { color: theme.colors.danger },
  roundsList: { gap: theme.spacing(1.5) },
  sectionTitle: { fontSize: theme.font.heading, fontWeight: "700", color: theme.colors.text },
  cardLabel: { fontSize: theme.font.small, color: theme.colors.textMuted, fontWeight: "700", textTransform: "uppercase" },
});
