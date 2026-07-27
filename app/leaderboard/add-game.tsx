import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { addManualGame } from "@/api/leaderboard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useRoster } from "@/state/useRoster";
import { theme, type ThemeColors } from "@/theme";

export default function AddManualGameScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAccount();
  const { players, loading: rosterLoading } = useRoster();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [playedAt, setPlayedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canSubmit = selectedIds.length >= 2 && !!winnerId && !saving;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (winnerId === id) setWinnerId(null);
        return prev.filter((entry) => entry !== id);
      }
      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    if (!token || !winnerId) return;
    if (playedAt.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(playedAt.trim())) {
      setError(t("leaderboard.invalidDate"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addManualGame(token, {
        players: selectedIds,
        winnerId,
        playedAt: playedAt.trim() || undefined,
      });
      router.back();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("leaderboard.addGameFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer
      footer={
        <Button
          label={t("leaderboard.saveGame")}
          onPress={handleSubmit}
          loading={saving}
          disabled={!canSubmit}
          variant="secondary"
        />
      }
    >
      <ScreenIntro title={t("leaderboard.addGame")} description={t("leaderboard.addGameDescription")} />

      <Text style={styles.sectionTitle}>{t("leaderboard.participants")}</Text>
      {rosterLoading && <Text style={styles.helper}>{t("common.loading")}</Text>}
      <View style={styles.list}>
        {players.map((player) => {
          const selected = selectedSet.has(player.id);
          return (
            <Pressable
              key={player.id}
              onPress={() => toggleSelected(player.id)}
              style={({ pressed }) => [
                styles.playerRow,
                selected && styles.playerRowSelected,
                pressed && styles.pressed,
              ]}
            >
              <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
              <Text style={styles.playerName}>{player.name}</Text>
              <View style={[styles.check, selected && styles.checkSelected]}>
                <Text style={[styles.checkText, selected && styles.checkTextSelected]}>{selected ? "✓" : ""}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedIds.length >= 2 && (
        <>
          <Text style={styles.sectionTitle}>{t("leaderboard.winner")}</Text>
          <View style={styles.list}>
            {players
              .filter((player) => selectedSet.has(player.id))
              .map((player) => {
                const isWinner = winnerId === player.id;
                return (
                  <Pressable
                    key={player.id}
                    onPress={() => setWinnerId(player.id)}
                    style={({ pressed }) => [
                      styles.playerRow,
                      isWinner && styles.winnerRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
                    <Text style={styles.playerName}>{player.name}</Text>
                    <View style={[styles.check, isWinner && styles.winnerCheckSelected]}>
                      <Text style={[styles.checkText, isWinner && styles.checkTextSelected]}>
                        {isWinner ? "🏆" : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>{t("leaderboard.playedAt")}</Text>
      <TextInput
        value={playedAt}
        onChangeText={setPlayedAt}
        placeholder={t("leaderboard.playedAtPlaceholder")}
        placeholderTextColor={colors.textMuted as string}
        style={styles.input}
      />
      <Text style={styles.helper}>{t("leaderboard.playedAtHint")}</Text>

      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScreenContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionTitle: { color: colors.text, fontSize: 15, fontFamily: theme.font.family.extraBold },
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
    error: { fontSize: theme.font.small, color: colors.danger, fontFamily: theme.font.family.semibold },
    list: { gap: 9 },
    playerRow: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    playerRowSelected: { borderColor: colors.success },
    winnerRowSelected: { borderColor: colors.primary },
    playerName: { flex: 1, color: colors.text, fontFamily: theme.font.family.bold, fontSize: 14.5 },
    check: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inkSoft,
    },
    checkSelected: { backgroundColor: colors.success },
    winnerCheckSelected: { backgroundColor: colors.primary },
    checkText: { color: colors.textMuted, fontFamily: theme.font.family.extraBold, fontSize: 13 },
    checkTextSelected: { color: colors.primaryText },
    input: {
      minHeight: 50,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.background,
      color: colors.text,
      paddingHorizontal: 14,
      fontFamily: theme.font.family.semibold,
      fontSize: 15,
    },
    pressed: { opacity: 0.72 },
  });
}
