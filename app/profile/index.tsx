import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";

import { fetchHistory } from "@/api/games";
import { fetchLeaderboard, type LeaderboardEntryDTO } from "@/api/leaderboard";
import { fetchRoster } from "@/api/players";
import type { GameHistorySummaryDTO } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlayerStatsView } from "@/components/PlayerStatsView";
import { ScreenContainer } from "@/components/ScreenContainer";
import type { Player } from "@/game/types";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function MyProfileScreen() {
  const { locale, t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { account } = useAccount();
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameHistorySummaryDTO[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([fetchRoster(), fetchHistory(), fetchLeaderboard()])
        .then(([roster, history, entries]) => {
          if (!active) return;
          setPlayers(roster.players);
          setGames(history.games);
          setLeaderboard(entries);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const linkedPlayer = account?.linkedPlayerId
    ? (players.find((player) => player.id === account.linkedPlayerId) ?? null)
    : null;
  const officialStats = linkedPlayer
    ? leaderboard.find((entry) => entry.playerId === linkedPlayer.id)
    : undefined;

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary as string} />
        <Text style={styles.helper}>{t("profile.loading")}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Card style={styles.accountCard}>
        {account ? (
          <>
            <Text style={styles.accountEyebrow}>{t("profile.verifiedAccount")}</Text>
            <Text style={styles.accountName}>{account.displayName}</Text>
            <Text style={styles.accountHandle}>@{account.handle}</Text>
            <Button
              label={t("profile.openAccount")}
              variant="ghost"
              onPress={() => router.push({ pathname: "/account", params: { from: "profile" } })}
            />
            {account.isAdmin && (
              <Button
                label={t("admin.homeShortcut")}
                variant="yellow"
                onPress={() => router.push({ pathname: "/admin", params: { from: "profile" } })}
              />
            )}
          </>
        ) : (
          <>
            <Text style={styles.accountName}>{t("profile.createAccount")}</Text>
            <Text style={styles.accountDescription}>{t("profile.createAccountDescription")}</Text>
            <Button
              label={t("profile.createAccount")}
              variant="success"
              onPress={() => router.push({ pathname: "/account", params: { from: "profile" } })}
            />
          </>
        )}
      </Card>

      <Button
        label={t("leaderboard.title")}
        variant="ghost"
        onPress={() => router.push({ pathname: "/leaderboard", params: { from: "profile" } })}
      />

      {account && !linkedPlayer && (
        <Card>
          <Text style={styles.waitingText}>{t("profile.waitingLink")}</Text>
        </Card>
      )}

      {linkedPlayer && (
        <PlayerStatsView
          player={linkedPlayer}
          games={games}
          officialStats={officialStats}
          locale={locale}
          t={t}
          fromPath="profile"
        />
      )}
    </ScreenContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    helper: {
      fontSize: theme.font.small,
      color: colors.textMuted,
      fontFamily: theme.font.family.medium,
      marginTop: theme.spacing(0.5),
    },
    accountCard: { alignItems: "center", paddingVertical: 18 },
    accountEyebrow: {
      color: colors.success,
      fontSize: 10,
      fontFamily: theme.font.family.extraBold,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    accountName: { color: colors.text, fontSize: 18, fontFamily: theme.font.family.extraBold, textAlign: "center" },
    accountHandle: { color: colors.textMuted, fontSize: 12, fontFamily: theme.font.family.bold },
    accountDescription: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 17,
      fontFamily: theme.font.family.medium,
      textAlign: "center",
    },
    waitingText: {
      color: colors.textMuted,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: theme.font.family.medium,
      textAlign: "center",
    },
  });
}
