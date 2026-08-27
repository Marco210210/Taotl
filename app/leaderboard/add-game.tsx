import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { addManualGame } from "@/api/leaderboard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useRoster } from "@/state/useRoster";
import { theme, type ThemeColors } from "@/theme";
import { appDateInputToIso, normalizeAppDateInput } from "@/utils/date";

export default function AddManualGameScreen() {
  const { from, leaderboardId } = useLocalSearchParams<{ from?: string; leaderboardId?: string }>();
  const backDestination = from === "admin" ? "/admin" : "/leaderboard";
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAccount();
  const { players, loading: rosterLoading } = useRoster();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winnerOnly, setWinnerOnly] = useState(false);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [playedAt, setPlayedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canSubmit = !!winnerId && (winnerOnly || selectedIds.length >= 2) && !saving;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (winnerId === id) setWinnerId(null);
        return prev.filter((entry) => entry !== id);
      }
      return [...prev, id];
    });
  };

  const setScore = (id: string, raw: string) => {
    setScores((prev) => ({ ...prev, [id]: raw.replace(/[^0-9-]/g, "") }));
  };

  const handleSubmit = async () => {
    if (!token || !winnerId) return;
    let playedAtIso: string | undefined;
    if (playedAt.trim()) {
      const parsedDate = appDateInputToIso(playedAt);
      if (!parsedDate) {
        setError(t("leaderboard.invalidDate"));
        return;
      }
      playedAtIso = parsedDate;
    }
    const scoresPayload = winnerOnly
      ? undefined
      : Object.entries(scores)
          .filter(([playerId, raw]) => selectedSet.has(playerId) && raw.trim() !== "")
          .map(([playerId, raw]) => ({ playerId, score: Number(raw) }))
          .filter((entry) => Number.isFinite(entry.score));
    setSaving(true);
    setError(null);
    try {
      await addManualGame(token, {
        players: winnerOnly ? [] : selectedIds,
        winnerId,
        winnerOnly,
        playedAt: playedAtIso,
        scores: scoresPayload && scoresPayload.length > 0 ? scoresPayload : undefined,
        leaderboardId: leaderboardId ?? "lb_general",
      });
      router.dismissTo(backDestination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("leaderboard.addGameFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
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

      <View style={styles.modePicker}>
        <Pressable
          onPress={() => {
            setWinnerOnly(false);
            if (winnerId && !selectedSet.has(winnerId)) setWinnerId(null);
          }}
          style={[styles.modeOption, !winnerOnly && styles.modeOptionSelected]}
        >
          <Text style={[styles.modeTitle, !winnerOnly && styles.modeTitleSelected]}>
            {t("leaderboard.fullGame")}
          </Text>
          <Text style={styles.modeDescription}>{t("leaderboard.fullGameDescription")}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setWinnerOnly(true);
            setSelectedIds([]);
          }}
          style={[styles.modeOption, winnerOnly && styles.modeOptionSelected]}
        >
          <Text style={[styles.modeTitle, winnerOnly && styles.modeTitleSelected]}>
            {t("leaderboard.winnerOnly")}
          </Text>
          <Text style={styles.modeDescription}>{t("leaderboard.winnerOnlyDescription")}</Text>
        </Pressable>
      </View>

      {!winnerOnly && (
        <>
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
        </>
      )}

      {(winnerOnly || selectedIds.length >= 2) && (
        <>
          <Text style={styles.sectionTitle}>{t("leaderboard.winner")}</Text>
          <View style={styles.list}>
            {players
              .filter((player) => winnerOnly || selectedSet.has(player.id))
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

      {!winnerOnly && selectedIds.length >= 2 && (
        <>
          <Text style={styles.sectionTitle}>{t("leaderboard.finalScores")}</Text>
          <Text style={styles.helper}>{t("leaderboard.finalScoresHint")}</Text>
          <View style={styles.list}>
            {players
              .filter((player) => selectedSet.has(player.id))
              .map((player) => (
                <View key={player.id} style={styles.playerRow}>
                  <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
                  <Text style={styles.playerName}>{player.name}</Text>
                  <TextInput
                    value={scores[player.id] ?? ""}
                    onChangeText={(value) => setScore(player.id, value)}
                    placeholder="—"
                    placeholderTextColor={colors.textMuted as string}
                    style={styles.scoreInput}
                  />
                </View>
              ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>{t("leaderboard.playedAt")}</Text>
      <TextInput
        value={playedAt}
        onChangeText={(value) => {
          setPlayedAt(normalizeAppDateInput(value));
          if (error === t("leaderboard.invalidDate")) setError(null);
        }}
        placeholder={t("leaderboard.playedAtPlaceholder")}
        placeholderTextColor={colors.textMuted as string}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
        style={[styles.input, error === t("leaderboard.invalidDate") && styles.inputError]}
      />
      <Text style={styles.helper}>{t("leaderboard.playedAtHint")}</Text>

      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionTitle: { color: colors.text, fontSize: 15, fontFamily: theme.font.family.extraBold },
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
    error: { fontSize: theme.font.small, color: colors.danger, fontFamily: theme.font.family.semibold },
    modePicker: { gap: 9 },
    modeOption: {
      padding: 14,
      gap: 3,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    modeOptionSelected: { borderColor: colors.success, backgroundColor: colors.positiveSoft },
    modeTitle: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 14 },
    modeTitleSelected: { color: colors.success },
    modeDescription: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10.5, lineHeight: 16 },
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
    scoreInput: {
      width: 62,
      minHeight: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.background,
      color: colors.text,
      textAlign: "center",
      paddingHorizontal: 8,
      fontFamily: theme.font.family.bold,
      fontSize: 14,
    },
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
    inputError: { borderColor: colors.danger, borderWidth: 1.5 },
    pressed: { opacity: 0.72 },
  });
}
