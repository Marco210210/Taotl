import { Stack, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";

import { fetchHistory } from "@/api/games";
import {
  fetchAdminAccounts,
  fetchLeaderboard,
  fetchManualGames,
  type AdminAccountDTO,
  type LeaderboardEntryDTO,
  type ManualGameDTO,
} from "@/api/leaderboard";
import { fetchRoster } from "@/api/players";
import type { GameHistorySummaryDTO } from "@/api/types";
import { PlayerStatsView } from "@/components/PlayerStatsView";
import { Button } from "@/components/Button";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import type { Player } from "@/game/types";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function LeaderboardPlayerScreen() {
  const { t, colors } = useAppSettings();
  const { account, token } = useAccount();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id, from, leaderboardId } = useLocalSearchParams<{ id: string; from?: string; leaderboardId?: string }>();
  const backDestination: Href =
    from === "profile-leaderboard"
      ? { pathname: "/leaderboard", params: { from: "profile", leaderboardId } }
      : { pathname: "/leaderboard", params: { leaderboardId } };
  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<GameHistorySummaryDTO[]>([]);
  const [manualGames, setManualGames] = useState<ManualGameDTO[]>([]);
  const [officialStats, setOfficialStats] = useState<LeaderboardEntryDTO | undefined>();
  const [linkedAccount, setLinkedAccount] = useState<AdminAccountDTO | null>(null);
  const [accountInfoUnavailable, setAccountInfoUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const accountLookup = account?.isAdmin && token
      ? fetchAdminAccounts(token)
          .then((accounts) => ({ accounts, failed: false }))
          .catch(() => ({ accounts: [] as AdminAccountDTO[], failed: true }))
      : Promise.resolve({ accounts: [] as AdminAccountDTO[], failed: false });

    Promise.all([
      fetchRoster(token),
      fetchHistory(token),
      token ? fetchLeaderboard(token, leaderboardId ?? account?.defaultLeaderboardId ?? "lb_general") : Promise.resolve([]),
      accountLookup,
      token ? fetchManualGames(token, id).catch(() => []) : Promise.resolve([]),
    ])
      .then(([roster, history, entries, accountResult, manual]) => {
        if (!active) return;
        setPlayer(roster.players.find((entry) => entry.id === id) ?? null);
        const selectedBoardId = leaderboardId ?? "lb_general";
        setGames(history.games.filter((game) => game.leaderboardId === selectedBoardId || (game.leaderboardId === undefined && selectedBoardId === "lb_general")));
        setManualGames(manual.filter((game) => game.leaderboardId === selectedBoardId || (game.leaderboardId === undefined && selectedBoardId === "lb_general")));
        setOfficialStats(entries.find((entry) => entry.playerId === id));
        setLinkedAccount(accountResult.accounts.find((entry) => entry.linkedPlayerId === id) ?? null);
        setAccountInfoUnavailable(accountResult.failed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account?.isAdmin, id, leaderboardId, token]);

  if (loading) {
    return (
      <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary as string} />
      </ScreenContainer>
      </>
    );
  }

  if (!player) {
    return (
      <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
      <ScreenContainer style={styles.center}>
        <Text style={styles.helper}>{t("player.missing")}</Text>
      </ScreenContainer>
      </>
    );
  }

  return (
    <>
    <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />
    <ScreenContainer>
      <PlayerStatsView
        player={player}
        games={games}
        manualGames={manualGames}
        officialStats={officialStats}
        t={t}
        fromPath="leaderboard"
        leaderboardOrigin={from}
        showAccountInfo={Boolean(account?.isAdmin)}
        accountInfo={linkedAccount}
        accountInfoUnavailable={accountInfoUnavailable}
      />
      {!!leaderboardId && (account?.isAdmin || account?.leaderboards.find((board) => board.id === leaderboardId)?.canManage) && (
        <Button label="Proponi collegamento a un Taotl ID" variant="secondary" onPress={() => router.push({ pathname: "/leaderboard/manage", params: { leaderboardId, playerId: id } })} />
      )}
    </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    helper: { fontSize: theme.font.small, color: colors.textMuted, fontFamily: theme.font.family.medium },
  });
}
