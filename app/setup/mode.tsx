import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { getFixedSequence } from "@/game/modes";
import type { GameMode } from "@/game/types";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useAccount } from "@/state/AccountContext";
import { useGame } from "@/state/GameContext";
import { useSetup } from "@/state/SetupContext";
import { theme, type ThemeColors } from "@/theme";

export default function SetupModeScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { mode, setMode, selectedPlayers, dealerId, reset } = useSetup();
  const { startGame } = useGame();
  const { room } = useAccount();

  if (selectedPlayers.length === 0 || !dealerId) {
    return (
      <ScreenContainer>
        <ScreenIntro title={t("mode.missingTitle")} description={t("mode.missingDescription")} />
        <Button label={t("mode.backDealer")} onPress={() => router.replace("/setup/dealer")} />
      </ScreenContainer>
    );
  }

  const start = () => {
    if (!mode) return;
    startGame(
      mode,
      selectedPlayers,
      dealerId,
      room?.id ?? null,
      false,
      "",
      "",
    );
    reset();
    router.replace("/game/bids");
  };

  return (
    <ScreenContainer
      footer={
        <Button
          label={t("mode.start")}
          trailing="→"
          onPress={start}
          disabled={!mode}
        />
      }
    >
      <ScreenIntro
        title={t("mode.title")}
        description={`${selectedPlayers.length} ${t("home.players")} · ${t("mode.dealerIs")} ${
          selectedPlayers.find((player) => player.id === dealerId)?.name
        }`}
      />

      <View style={styles.list}>
        {(["classica", "completa", "breve", "personalizzata"] as GameMode[]).map((value) => {
          const option = {
            value,
            title: t(`mode.${value}`),
            description: t(`mode.${value}Description`),
          };
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
                  {option.value === "personalizzata" ? `6+ ${t("mode.turns")}` : `${sequence.length} ${t("mode.turns")}`}
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
                  <Text style={styles.customTitle}>{t("mode.live")}</Text>
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { gap: 10 },
    option: {
      padding: 15,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 8,
    },
    optionSelected: { borderColor: colors.primary },
    optionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    optionTitle: { flex: 1, color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 15.5 },
    turnCount: { color: colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 10, letterSpacing: 0.7 },
    turnCountSelected: { color: colors.primary },
    optionDescription: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12.5, lineHeight: 18 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    chip: {
      minWidth: 26,
      height: 26,
      paddingHorizontal: 6,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inkSoft,
    },
    chipText: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 11 },
    customPanel: { padding: 13, borderRadius: 12, backgroundColor: colors.text, gap: 4 },
    customTitle: {
      color: colors.yellow,
      fontFamily: theme.font.family.bold,
      fontSize: 9.5,
      letterSpacing: 1.2,
    },
    customText: {
      color: colors.backgroundMuted,
      fontFamily: theme.font.family.medium,
      fontSize: 11.5,
      lineHeight: 17,
    },
    sectionTitle: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 15 },
    createRow: { gap: 8, marginTop: 4 },
    input: {
      minHeight: 48,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.background,
      color: colors.text,
      paddingHorizontal: 14,
      fontFamily: theme.font.family.semibold,
      fontSize: 14,
    },
    error: { color: colors.danger, fontFamily: theme.font.family.semibold, fontSize: 12 },
    pressed: { opacity: 0.74 },
  });
}
