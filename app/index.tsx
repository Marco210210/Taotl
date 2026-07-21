import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

export default function HomeScreen() {
  const { game, isHydrated } = useGame();

  const hasActiveGame = !!game && game.status !== "finished";
  const hasFinishedGame = !!game && game.status === "finished";

  const resumeGame = () => {
    if (!game) return;
    if (game.status === "scoring") router.push("/game/scoring");
    else router.push("/game/bids");
  };

  return (
    <ScreenContainer style={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>Taotl</Text>
        <Text style={styles.subtitle}>Conta i punti al tavolo, senza blocco note.</Text>
      </View>

      {isHydrated && hasActiveGame && (
        <Card>
          <Text style={styles.cardTitle}>Partita in corso</Text>
          <Text style={styles.cardBody}>
            {game!.players.length} giocatori · turno {game!.rounds.length + 1}
          </Text>
          <Button label="Riprendi partita" onPress={resumeGame} />
        </Card>
      )}

      {isHydrated && hasFinishedGame && (
        <Card>
          <Text style={styles.cardTitle}>Partita conclusa</Text>
          <Text style={styles.cardBody}>Vai al riepilogo finale o inizia una nuova partita.</Text>
          <Button label="Vedi risultato finale" onPress={() => router.push("/game/end")} />
        </Card>
      )}

      {isHydrated && !hasActiveGame && !hasFinishedGame && (
        <Button label="Nuova partita" onPress={() => router.push("/setup/players")} />
      )}

      <View style={styles.secondaryActions}>
        <Button label="Rubrica giocatori" variant="secondary" onPress={() => router.push("/roster")} />
        <Button label="Storico partite" variant="secondary" onPress={() => router.push("/history")} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: theme.spacing(3) },
  title: { fontSize: 44, fontWeight: "800", color: theme.colors.primary },
  subtitle: { fontSize: theme.font.body, color: theme.colors.textMuted, marginTop: theme.spacing(1), textAlign: "center" },
  cardTitle: { fontSize: theme.font.heading, fontWeight: "700", color: theme.colors.text },
  cardBody: { fontSize: theme.font.body, color: theme.colors.textMuted },
  secondaryActions: { gap: theme.spacing(1.5), marginTop: theme.spacing(2) },
});
