import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { getFixedSequence } from "@/game/modes";
import type { GameMode } from "@/game/types";
import { useGame } from "@/state/GameContext";
import { useSetup } from "@/state/SetupContext";
import { theme } from "@/theme";

const MODE_OPTIONS: { value: GameMode; title: string; description: string }[] = [
  {
    value: "classica",
    title: "Classica",
    description: "Sei turni con la distribuzione Taotl prevista per il numero di giocatori.",
  },
  {
    value: "completa",
    title: "Completa",
    description: "Dal massimo distribuibile con il mazzo da 72 carte fino a una carta.",
  },
  {
    value: "breve",
    title: "Breve",
    description: "La partita rapida: 6, 5, 4, 3, 2, 1 carte.",
  },
  {
    value: "personalizzata",
    title: "Personalizzata",
    description: "Scegli le carte turno per turno. Minimo 6 turni, finale obbligatorio 3–2–1.",
  },
];

export default function SetupModeScreen() {
  const { mode, setMode, selectedPlayers, dealerId, reset } = useSetup();
  const { startGame } = useGame();

  if (selectedPlayers.length === 0 || !dealerId) {
    return (
      <ScreenContainer>
        <ScreenIntro title="Manca il mazziere" description="Completa prima ordine e mazziere." />
        <Button label="Torna a ordine e mazziere" onPress={() => router.replace("/setup/dealer")} />
      </ScreenContainer>
    );
  }

  const start = () => {
    if (!mode) return;
    startGame(mode, selectedPlayers, dealerId);
    reset();
    router.replace("/game/bids");
  };

  return (
    <ScreenContainer
      footer={<Button label="Inizia la partita" trailing="→" onPress={start} disabled={!mode} />}
    >
      <ScreenIntro
        title="Scegli la modalità"
        description={`${selectedPlayers.length} giocatori · il mazziere è ${
          selectedPlayers.find((player) => player.id === dealerId)?.name
        }`}
      />

      <View style={styles.list}>
        {MODE_OPTIONS.map((option) => {
          const selected = mode === option.value;
          const sequence = option.value === "personalizzata"
            ? []
            : getFixedSequence(option.value, selectedPlayers.length);
          return (
            <Pressable
              key={option.value}
              onPress={() => setMode(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
            >
              <View style={styles.optionHeader}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={[styles.turnCount, selected && styles.turnCountSelected]}>
                  {option.value === "personalizzata" ? "6+ TURNI" : `${sequence.length} TURNI`}
                </Text>
              </View>
              <Text style={styles.optionDescription}>{option.description}</Text>
              {sequence.length > 0 && (
                <View style={styles.chips}>
                  {sequence.map((cards, index) => (
                    <View key={`${option.value}-${index}`} style={styles.chip}>
                      <Text style={styles.chipText}>{cards}</Text>
                    </View>
                  ))}
                </View>
              )}
              {option.value === "personalizzata" && selected && (
                <View style={styles.customPanel}>
                  <Text style={styles.customTitle}>DECIDI DAL VIVO</Text>
                  <Text style={styles.customText}>
                    Prima di ogni turno l’app ti chiederà quante carte avete distribuito e impedirà sequenze che
                    finirebbero prima del sesto turno.
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  option: {
    padding: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  optionSelected: { borderColor: theme.colors.primary },
  optionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionTitle: { flex: 1, color: theme.colors.text, fontFamily: theme.font.family.extraBold, fontSize: 15.5 },
  turnCount: { color: theme.colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 10, letterSpacing: 0.7 },
  turnCountSelected: { color: theme.colors.primary },
  optionDescription: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12.5, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.inkSoft,
  },
  chipText: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 11 },
  customPanel: { padding: 13, borderRadius: 12, backgroundColor: theme.colors.text, gap: 4 },
  customTitle: {
    color: theme.colors.yellow,
    fontFamily: theme.font.family.bold,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  customText: {
    color: "rgba(248,248,245,.72)",
    fontFamily: theme.font.family.medium,
    fontSize: 11.5,
    lineHeight: 17,
  },
  pressed: { opacity: 0.74 },
});
