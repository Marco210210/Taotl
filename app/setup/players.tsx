import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/game/constants";
import { useRoster } from "@/state/useRoster";
import { useSetup } from "@/state/SetupContext";
import { theme } from "@/theme";

export default function SetupPlayersScreen() {
  const { players, loading, addPlayer } = useRoster();
  const { selectedPlayers, togglePlayer } = useSetup();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const selectedIds = new Set(selectedPlayers.map((p) => p.id));
  const canAddMore = selectedPlayers.length < MAX_PLAYERS;
  const canContinue = selectedPlayers.length >= MIN_PLAYERS && selectedPlayers.length <= MAX_PLAYERS;

  const handleAddPlayer = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const player = await addPlayer(name);
      if (canAddMore) togglePlayer(player);
      setNewName("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Chi gioca?</Text>
        <Text style={styles.helper}>
          Seleziona i giocatori dalla rubrica (min {MIN_PLAYERS}, max {MAX_PLAYERS}). L&apos;ordine di selezione è
          l&apos;ordine al tavolo.
        </Text>
      </View>

      <Card>
        <Text style={styles.cardLabel}>Aggiungi nuovo giocatore</Text>
        <View style={styles.addRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Nome"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            onSubmitEditing={handleAddPlayer}
            returnKeyType="done"
          />
          <Button label="Aggiungi" onPress={handleAddPlayer} loading={adding} disabled={!newName.trim()} />
        </View>
      </Card>

      <View style={styles.list}>
        {loading && <Text style={styles.helper}>Carico la rubrica…</Text>}
        {!loading && players.length === 0 && (
          <Text style={styles.helper}>Nessun giocatore in rubrica: aggiungine uno qui sopra.</Text>
        )}
        {players.map((player) => {
          const selected = selectedIds.has(player.id);
          const order = selectedPlayers.findIndex((p) => p.id === player.id);
          const disabled = !selected && !canAddMore;
          return (
            <Pressable
              key={player.id}
              onPress={() => !disabled && togglePlayer(player)}
              style={[styles.playerRow, selected && styles.playerRowSelected, disabled && styles.playerRowDisabled]}
            >
              <PlayerAvatar name={player.name} photoUri={player.photoUri} size={40} />
              <Text style={styles.playerName}>{player.name}</Text>
              {selected && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{order + 1}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Button
        label={`Continua (${selectedPlayers.length}/${MAX_PLAYERS})`}
        onPress={() => router.push("/setup/mode")}
        disabled={!canContinue}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  cardLabel: { fontSize: theme.font.small, color: theme.colors.textMuted, fontWeight: "700", textTransform: "uppercase" },
  addRow: { flexDirection: "row", gap: theme.spacing(1.5), alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: theme.font.body,
  },
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
  playerRowDisabled: { opacity: 0.4 },
  playerName: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, fontWeight: "600" },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: theme.colors.primaryText, fontWeight: "800", fontSize: theme.font.small },
});
