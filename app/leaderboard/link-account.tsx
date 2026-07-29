import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AdminAccountDTO } from "@/api/leaderboard";
import { fetchAdminAccounts, linkAccountToPlayer } from "@/api/leaderboard";
import { Button } from "@/components/Button";
import { LinearBackButton } from "@/components/LinearBackButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useRoster } from "@/state/useRoster";
import { theme, type ThemeColors } from "@/theme";

export default function LinkAccountScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backDestination = from === "admin" ? "/admin" : "/leaderboard";
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAccount();
  const { players, loading: rosterLoading } = useRoster();
  const [accounts, setAccounts] = useState<AdminAccountDTO[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableAccounts = useMemo(
    () => accounts.filter((candidate) => candidate.linkedPlayerId === null),
    [accounts],
  );
  const linkedPlayerIds = useMemo(
    () =>
      new Set(
        accounts
          .map((candidate) => candidate.linkedPlayerId)
          .filter((playerId): playerId is string => playerId !== null),
      ),
    [accounts],
  );
  const availablePlayers = useMemo(
    () => players.filter((player) => !linkedPlayerIds.has(player.id)),
    [linkedPlayerIds, players],
  );

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetchAdminAccounts(token)
      .then((result) => {
        if (active) setAccounts(result);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : t("leaderboard.linkAccountFailed"));
      })
      .finally(() => {
        if (active) setAccountsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, t]);

  const handleSubmit = async () => {
    if (!token || !selectedAccountId || !selectedPlayerId) return;
    setSaving(true);
    setError(null);
    try {
      await linkAccountToPlayer(token, { accountId: selectedAccountId, playerId: selectedPlayerId });
      router.dismissTo(backDestination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("leaderboard.linkAccountFailed"));
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
          label={t("leaderboard.saveLink")}
          onPress={handleSubmit}
          loading={saving}
          disabled={!selectedAccountId || !selectedPlayerId || saving}
          variant="secondary"
        />
      }
    >
      <ScreenIntro title={t("leaderboard.linkAccount")} description={t("leaderboard.linkAccountDescription")} />

      <Text style={styles.sectionTitle}>{t("leaderboard.chooseAccount")}</Text>
      {accountsLoading && <Text style={styles.helper}>{t("common.loading")}</Text>}
      {!accountsLoading && availableAccounts.length === 0 && (
        <Text style={styles.helper}>{t("leaderboard.noAccountsToLink")}</Text>
      )}
      <View style={styles.list}>
        {availableAccounts.map((acc) => {
          const selected = selectedAccountId === acc.id;
          return (
            <Pressable
              key={acc.id}
              onPress={() => setSelectedAccountId(acc.id)}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{acc.displayName}</Text>
                <Text style={styles.rowMeta}>@{acc.handle}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>{t("leaderboard.choosePlayer")}</Text>
      {rosterLoading && <Text style={styles.helper}>{t("common.loading")}</Text>}
      {!rosterLoading && availablePlayers.length === 0 && (
        <Text style={styles.helper}>{t("leaderboard.noPlayersToLink")}</Text>
      )}
      <View style={styles.list}>
        {availablePlayers.map((player) => {
          const selected = selectedPlayerId === player.id;
          return (
            <Pressable
              key={player.id}
              onPress={() => setSelectedPlayerId(player.id)}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
            >
              <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
              <Text style={styles.rowName}>{player.name}</Text>
            </Pressable>
          );
        })}
      </View>

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
    list: { gap: 9 },
    row: {
      minHeight: 52,
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
    rowSelected: { borderColor: colors.success },
    rowInfo: { flex: 1 },
    rowName: { flex: 1, color: colors.text, fontFamily: theme.font.family.bold, fontSize: 14.5 },
    rowMeta: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11 },
    pressed: { opacity: 0.72 },
  });
}
