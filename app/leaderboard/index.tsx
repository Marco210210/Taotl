import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fetchLeaderboard, fetchLeaderboards } from "@/api/leaderboard";
import type { LeaderboardDTO, LeaderboardEntryDTO } from "@/api/leaderboard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { LeaderboardSelector } from "@/components/LeaderboardSelector";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function LeaderboardScreen() {
  const { from, leaderboardId } = useLocalSearchParams<{ from?: string; leaderboardId?: string }>();
  const backDestination = from === "profile" ? "/profile" : from === "admin" ? "/admin" : "/";
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { account, token } = useAccount();
  const [entries, setEntries] = useState<LeaderboardEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardDTO[]>([]);
  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      if (!token) {
        setError("Accedi con il tuo Taotl ID per vedere le classifiche.");
        setLoading(false);
        return () => { active = false; };
      }
      fetchLeaderboards(token)
        .then(async (allLeaderboards) => {
          if (!active) return;
          const accountIds = account?.leaderboards?.map((item) => item.id) ?? [];
          const visible = allLeaderboards.filter((item) => accountIds.includes(item.id));
          const fallbackVisible = visible.length > 0 ? visible : allLeaderboards.slice(0, 1);
          const requestedId = selectedLeaderboardId ?? leaderboardId;
          const nextId = requestedId && fallbackVisible.some((item) => item.id === requestedId)
            ? requestedId
            : fallbackVisible.find((item) => item.id === account?.defaultLeaderboardId)?.id
              ?? fallbackVisible[0]?.id
              ?? null;
          setLeaderboards(fallbackVisible);
          setSelectedLeaderboardId(nextId);
          setEntries(nextId ? await fetchLeaderboard(token, nextId) : []);
        })
        .catch((reason) => {
          if (active) setError(reason instanceof Error ? reason.message : t("leaderboard.unavailable"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [account?.defaultLeaderboardId, account?.leaderboards, leaderboardId, selectedLeaderboardId, t, token]),
  );

  const selectLeaderboard = useCallback((ids: string[]) => {
    const nextId = ids[0];
    if (!nextId || nextId === selectedLeaderboardId) return;
    setSelectedLeaderboardId(nextId);
  }, [selectedLeaderboardId]);

  const selectedLeaderboard = leaderboards.find((item) => item.id === selectedLeaderboardId);

  return (
    <>
    <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
    <ScreenContainer>
      <ScreenIntro
        title={selectedLeaderboard?.name ?? t("leaderboard.title")}
        description={t("leaderboard.description")}
      />

      {!!token && <Button label="Crea una nuova classifica" variant="secondary" onPress={() => router.push("/leaderboard/manage")} />}

      {leaderboards.length > 1 && (
        <LeaderboardSelector
          leaderboards={leaderboards}
          selectedIds={selectedLeaderboardId ? [selectedLeaderboardId] : []}
          onChange={selectLeaderboard}
        />
      )}

      {account?.isAdmin && (
        <Button
          label={t("leaderboard.addGame")}
          variant="success"
          onPress={() => router.push({
            pathname: "/leaderboard/add-game",
            params: { leaderboardId: selectedLeaderboardId ?? "lb_general" },
          })}
        />
      )}

      {selectedLeaderboard?.canManage && (
        <Button label="Gestisci membri e inviti" variant="secondary" onPress={() => router.push({ pathname: "/leaderboard/manage", params: { leaderboardId: selectedLeaderboard.id, name: selectedLeaderboard.name } })} />
      )}

      {loading && <Text style={styles.helper}>{t("common.loading")}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && entries.length === 0 && (
        <Text style={styles.helper}>{t("leaderboard.empty")}</Text>
      )}

      <View style={styles.list}>
        {entries.map((entry, index) => (
          <Pressable
            key={entry.playerId}
            onPress={() => router.push({
              pathname: "/leaderboard/player/[id]",
              params: {
                id: entry.playerId,
                from: from === "profile" ? "profile-leaderboard" : "leaderboard",
                leaderboardId: selectedLeaderboardId ?? "lb_general",
              },
            })}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={styles.row}>
              <Text style={styles.position}>{index + 1}</Text>
              <View style={styles.info}>
                <Text style={styles.name}>{entry.name}</Text>
                <Text style={styles.meta}>
                  {entry.gamesPlayed} {t("leaderboard.games")}
                </Text>
              </View>
              <Text style={styles.wins}>{entry.wins}</Text>
              <Text style={styles.winsLabel}>{t("leaderboard.wins")}</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      {account?.isAdmin && (
        <Pressable
          onPress={() => router.push("/leaderboard/link-account")}
          style={({ pressed }) => [styles.manageLink, pressed && styles.pressed]}
        >
          <Text style={styles.manageText}>{t("leaderboard.linkAccount")}</Text>
          <Text style={styles.manageArrow}>›</Text>
        </Pressable>
      )}
    </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
    error: { fontSize: theme.font.small, color: colors.danger, fontFamily: theme.font.family.semibold },
    list: { gap: theme.spacing(1) },
    row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
    position: {
      width: 26,
      color: colors.textMuted,
      fontFamily: theme.font.family.extraBold,
      fontSize: theme.font.body,
    },
    info: { flex: 1 },
    name: { color: colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
    meta: { color: colors.textMuted, fontSize: theme.font.small, fontFamily: theme.font.family.medium },
    wins: {
      color: colors.success,
      fontSize: theme.font.heading,
      fontFamily: theme.font.family.extraBold,
      fontVariant: ["tabular-nums"],
    },
    winsLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontFamily: theme.font.family.semibold,
      textTransform: "uppercase",
    },
    manageLink: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
    manageText: { flex: 1, color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 12 },
    manageArrow: { color: colors.text, fontSize: 22 },
    pressed: { opacity: 0.72 },
  });
}
