import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useGame } from "@/state/GameContext";
import { useSetup } from "@/state/SetupContext";
import { theme } from "@/theme";

export default function SetupDealerScreen() {
  const { selectedPlayers, mode, reset } = useSetup();
  const { startGame } = useGame();
  const [dealerId, setDealerId] = useState<string | null>(null);

  if (selectedPlayers.length === 0 || !mode) {
    return (
      <ScreenContainer>
        <Text style={styles.helper}>Torna indietro e completa prima i passaggi precedenti.</Text>
        <Button label="Torna alla selezione giocatori" onPress={() => router.replace("/setup/players")} />
      </ScreenContainer>
    );
  }

  const handleStart = () => {
    if (!dealerId) return;
    startGame(mode, selectedPlayers, dealerId);
    reset();
    router.replace("/game/bids");
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Chi dà le carte?</Text>
        <Text style={styles.helper}>
          Scegli chi è il mazziere al primo turno. Chi riceve le carte per primo dopo di lui parlerà per primo.
        </Text>
      </View>

      <View style={styles.list}>
        {selectedPlayers.map((player, index) => (
          <Pressable
            key={player.id}
            onPress={() => setDealerId(player.id)}
            style={[styles.playerRow, dealerId === player.id && styles.playerRowSelected]}
          >
            <Text style={styles.seatNumber}>{index + 1}</Text>
            <PlayerAvatar name={player.name} photoUri={player.photoUri} size={40} />
            <Text style={styles.playerName}>{player.name}</Text>
            {dealerId === player.id && <Text style={styles.dealerTag}>Mazziere</Text>}
          </Pressable>
        ))}
      </View>

      <Button label="Inizia partita" onPress={handleStart} disabled={!dealerId} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  list: { gap: theme.spacing(1) },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  playerRowSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceAlt },
  seatNumber: { width: 20, textAlign: "center", color: theme.colors.textMuted, fontWeight: "700" },
  playerName: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, fontWeight: "600" },
  dealerTag: { color: theme.colors.primary, fontWeight: "800", fontSize: theme.font.small },
});
