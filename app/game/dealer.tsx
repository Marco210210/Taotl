import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

export default function CorrectDealerScreen() {
  const { game, currentRoundInfo, setCurrentDealer } = useGame();

  if (
    !game ||
    game.rounds.length > 0 ||
    (game.status !== "bidding" && game.status !== "awaiting-cards")
  ) {
    return (
      <ScreenContainer>
        <Text style={styles.helper}>
          Il mazziere si può correggere soltanto durante il primo turno. Dopo, ruota automaticamente seguendo
          l&apos;ordine iniziale dei giocatori.
        </Text>
        <Button label="Torna indietro" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  const currentDealerId =
    currentRoundInfo?.dealerId ??
    game.players[(game.players.findIndex((player) => player.id === game.startDealerId) + game.rounds.length) % game.players.length]
      ?.id;

  const selectDealer = (dealerId: string) => {
    setCurrentDealer(dealerId);
    router.back();
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Correggi il primo mazziere</Text>
        <Text style={styles.helper}>
          Seleziona chi sta dando realmente le carte nel primo turno. L&apos;ordine dei giocatori non cambia: dai
          turni successivi il mazziere ruoterà automaticamente.
        </Text>
      </View>

      <View style={styles.list}>
        {game.players.map((player) => (
          <Pressable
            key={player.id}
            onPress={() => selectDealer(player.id)}
            style={[styles.row, currentDealerId === player.id && styles.rowSelected]}
          >
            <PlayerAvatar name={player.name} photoUri={player.photoUri} size={42} />
            <Text style={styles.name}>{player.name}</Text>
            {currentDealerId === player.id && <Text style={styles.tag}>Attuale</Text>}
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  list: { gap: theme.spacing(1) },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  rowSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceAlt },
  name: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, fontWeight: "700" },
  tag: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: "800" },
});
