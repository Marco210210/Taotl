import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import type { GameMode } from "@/game/types";
import { useSetup } from "@/state/SetupContext";
import { theme } from "@/theme";

const MODE_OPTIONS: { value: GameMode; title: string; description: string }[] = [
  {
    value: "classica",
    title: "Classica",
    description: "6 turni, distribuzione carte fissa in base al numero di giocatori.",
  },
  {
    value: "completa",
    title: "Completa",
    description: "Si parte dal massimo di carte distribuibili e si scende di 1 ogni turno fino a 1.",
  },
  {
    value: "breve",
    title: "Breve",
    description: "Partita lampo a 6 turni fissi: 6, 5, 4, 3, 2, 1 carte, a prescindere dai giocatori.",
  },
  {
    value: "personalizzata",
    title: "Personalizzata",
    description: "Decidete voi quante carte ad ogni turno, dal vivo. Minimo 6 turni, si finisce sempre 3-2-1.",
  },
];

export default function SetupModeScreen() {
  const { mode, setMode, selectedPlayers } = useSetup();

  const handleSelect = (value: GameMode) => {
    setMode(value);
    router.push("/setup/dealer");
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Modalità</Text>
        <Text style={styles.helper}>{selectedPlayers.length} giocatori selezionati</Text>
      </View>

      <View style={styles.list}>
        {MODE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => handleSelect(option.value)}
            style={[styles.option, mode === option.value && styles.optionSelected]}
          >
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionDescription}>{option.description}</Text>
          </Pressable>
        ))}
      </View>

      {mode && <Button label="Continua" onPress={() => router.push("/setup/dealer")} />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  list: { gap: theme.spacing(1.5) },
  option: {
    padding: theme.spacing(2),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing(0.5),
  },
  optionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceAlt },
  optionTitle: { fontSize: theme.font.heading, fontWeight: "700", color: theme.colors.text },
  optionDescription: { fontSize: theme.font.small, color: theme.colors.textMuted },
});
