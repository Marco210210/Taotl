import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/game/constants";
import { useSetup } from "@/state/SetupContext";
import { useRoster } from "@/state/useRoster";
import { theme } from "@/theme";

export default function SetupPlayersScreen() {
  const { players, loading, addPlayer } = useRoster();
  const { selectedPlayers, togglePlayer } = useSetup();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const selectedIds = new Set(selectedPlayers.map((player) => player.id));
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

  const footerLabel = canContinue
    ? `Ordine e mazziere · ${selectedPlayers.length}`
    : `Servono almeno ${MIN_PLAYERS} giocatori`;

  return (
    <ScreenContainer
      footer={
        <Button
          label={footerLabel}
          trailing={canContinue ? "→" : undefined}
          variant="secondary"
          onPress={() => router.push("/setup/dealer")}
          disabled={!canContinue}
        />
      }
    >
      <ScreenIntro
        title="Chi gioca?"
        description={`Scegli da ${MIN_PLAYERS} a ${MAX_PLAYERS} giocatori. Potrai sistemare l’ordine nel passaggio successivo.`}
      />

      <View style={styles.addRow}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Aggiungi un giocatore"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          onSubmitEditing={handleAddPlayer}
          returnKeyType="done"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aggiungi giocatore"
          disabled={!newName.trim() || adding}
          onPress={handleAddPlayer}
          style={({ pressed }) => [styles.addButton, (!newName.trim() || adding) && styles.disabled, pressed && styles.pressed]}
        >
          <Text pointerEvents="none" style={styles.addButtonText}>{adding ? "…" : "+"}</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {loading && <Text style={styles.helper}>Carico la rubrica…</Text>}
        {!loading && players.length === 0 && (
          <Text style={styles.empty}>Non ci sono ancora giocatori. Scrivi il primo nome qui sopra.</Text>
        )}
        {players.map((player) => {
          const selected = selectedIds.has(player.id);
          const order = selectedPlayers.findIndex((entry) => entry.id === player.id);
          const disabled = !selected && !canAddMore;
          return (
            <Pressable
              key={player.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              onPress={() => !disabled && togglePlayer(player)}
              style={({ pressed }) => [
                styles.playerRow,
                selected && styles.playerRowSelected,
                disabled && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerMeta}>{selected ? `posizione ${order + 1}` : "Tocca per selezionare"}</Text>
              </View>
              <View style={[styles.check, selected && styles.checkSelected]}>
                <Text pointerEvents="none" style={[styles.checkText, selected && styles.checkTextSelected]}>
                  {selected ? "✓" : ""}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => router.push("/roster")} style={styles.manageLink}>
        <Text style={styles.manageText}>Modifica nomi, foto e profili</Text>
        <Text style={styles.manageArrow}>›</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontFamily: theme.font.family.semibold,
    fontSize: 14,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.text,
  },
  addButtonText: { color: theme.colors.background, fontFamily: theme.font.family.regular, fontSize: 28 },
  list: { gap: 9 },
  playerRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  playerRowSelected: { borderColor: theme.colors.success },
  playerInfo: { flex: 1 },
  playerName: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 14.5 },
  playerMeta: { marginTop: 2, color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23,24,29,.12)",
  },
  checkSelected: { backgroundColor: theme.colors.success },
  checkText: { color: theme.colors.textMuted, fontFamily: theme.font.family.extraBold, fontSize: 13 },
  checkTextSelected: { color: theme.colors.background },
  helper: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12 },
  empty: {
    padding: 16,
    borderRadius: 13,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontFamily: theme.font.family.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  manageLink: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  manageText: { flex: 1, color: theme.colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 12 },
  manageArrow: { color: theme.colors.text, fontSize: 22 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
});
