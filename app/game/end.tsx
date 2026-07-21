import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { syncFinishedGame } from "@/api/games";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

type SyncStatus = "syncing" | "synced" | "offline";

export default function GameEndScreen() {
  const { game, ranked, resetGame } = useGame();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");

  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    syncFinishedGame(game).then((result) => {
      if (!cancelled) setSyncStatus(result.synced ? "synced" : "offline");
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  if (!game) {
    return (
      <ScreenContainer>
        <Text style={styles.helper}>Nessuna partita da mostrare.</Text>
        <Button label="Torna alla home" onPress={() => router.replace("/")} />
      </ScreenContainer>
    );
  }

  const playerById = new Map(game.players.map((p) => [p.id, p]));

  const handleNewGame = () => {
    resetGame();
    router.replace("/setup/players");
  };

  const handleHome = () => {
    resetGame();
    router.replace("/");
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Partita conclusa</Text>
        <Text style={styles.helper}>
          {syncStatus === "syncing" && "Sincronizzazione in corso…"}
          {syncStatus === "synced" && "Salvata online."}
          {syncStatus === "offline" && "Server non raggiungibile: salvata solo su questo telefono."}
        </Text>
      </View>

      <Card>
        {ranked.map((entry, index) => {
          const player = playerById.get(entry.playerId);
          if (!player) return null;
          const isWinner = index === 0;
          return (
            <View key={entry.playerId} style={styles.row}>
              <Text style={styles.position}>{index + 1}</Text>
              <PlayerAvatar name={player.name} photoUri={player.photoUri} size={44} />
              <View style={styles.playerInfo}>
                <Text style={styles.name}>{player.name}</Text>
                {isWinner && <Text style={styles.winnerTag}>Vincitore</Text>}
              </View>
              <Text style={[styles.total, entry.total < 0 && styles.totalNegative]}>{entry.total}</Text>
            </View>
          );
        })}
      </Card>

      <Button label="Nuova partita" onPress={handleNewGame} />
      <Button label="Torna alla home" variant="secondary" onPress={handleHome} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1.25), paddingVertical: 8 },
  position: { width: 22, color: theme.colors.textMuted, fontWeight: "700" },
  playerInfo: { flex: 1 },
  name: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: "700" },
  winnerTag: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: "700" },
  total: { fontSize: theme.font.heading, fontWeight: "800", color: theme.colors.success },
  totalNegative: { color: theme.colors.danger },
});
