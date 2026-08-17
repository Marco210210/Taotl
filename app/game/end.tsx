import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cacheFinishedGame, syncFinishedGame } from "@/api/games";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useAccount } from "@/state/AccountContext";
import { useGame } from "@/state/GameContext";
import { theme, type ThemeColors } from "@/theme";

type SyncStatus = "syncing" | "synced" | "verified" | "verification-failed" | "offline" | "not-shared";

export default function GameEndScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { game, ranked, resetGame, undoLastRound } = useGame();
  const { account, token, room, clearRoom } = useAccount();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const isTie = !!game && game.saveToAlbo && ranked.length > 1 && ranked[0]?.total === ranked[1]?.total;
  const [tieDecided, setTieDecided] = useState(false);
  const [tieBreakWinnerId, setTieBreakWinnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!game) return;
    // Se c'è un pareggio in testa, si aspetta che l'utente lo risolva (o
    // scelga di lasciarlo pari) prima di sincronizzare: il vincitore dello
    // spareggio va incluso nel payload della sync, non aggiunto dopo.
    if (isTie && !tieDecided) return;
    let cancelled = false;
    if (!game.saveToAlbo) {
      cacheFinishedGame(game).then(() => {
        if (!cancelled) setSyncStatus("not-shared");
      });
      return () => {
        cancelled = true;
      };
    }
    const isRoomHost = room?.participants.some(
      (participant) => participant.userId === account?.id && participant.isHost,
    );
    const verifiedRoom =
      token && room && isRoomHost && game.verifiedRoomId === room.id
        ? { token, roomId: room.id }
        : undefined;
    syncFinishedGame(game, verifiedRoom, tieBreakWinnerId).then((result) => {
      if (cancelled) return;
      setVerifiedCount(result.verifiedCount);
      setUnmatchedCount(result.unmatchedCount);
      if (!result.synced) {
        setSyncStatus("offline");
      } else if (result.verification === "verified") {
        setSyncStatus("verified");
        void clearRoom();
      } else if (result.verification === "failed") {
        setSyncStatus("verification-failed");
      } else {
        setSyncStatus("synced");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [game, isTie, tieDecided, tieBreakWinnerId]);

  if (!game) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("end.none")}</Text>
          <Button label={t("standings.home")} onPress={() => router.replace("/")} />
        </View>
      </SafeAreaView>
    );
  }

  const playerById = new Map(game.players.map((player) => [player.id, player]));
  const winner = playerById.get(ranked[0]?.playerId);

  const home = () => {
    resetGame();
    router.replace("/");
  };

  const confirmUndo = () => {
    setShowUndoConfirm(false);
    undoLastRound();
    router.replace("/game/scoring");
  };

  const resolveTie = (winnerId: string | null) => {
    setTieBreakWinnerId(winnerId);
    setTieDecided(true);
  };

  if (isTie && !tieDecided) {
    const topTotal = ranked[0].total;
    const tiedEntries = ranked.filter((entry) => entry.total === topTotal);
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.seal}>
            <BrandMark compact inverse />
          </View>
          <Text style={styles.kicker}>{t("end.tieKicker")}</Text>
          <Text style={styles.winner}>{t("end.tieTitle")}</Text>
          <Text style={styles.summary}>{t("end.tieDescription")}</Text>

          <View style={styles.ranking}>
            {tiedEntries.map((entry) => {
              const player = playerById.get(entry.playerId);
              if (!player) return null;
              return (
                <Pressable
                  key={entry.playerId}
                  onPress={() => resolveTie(entry.playerId)}
                  style={({ pressed }) => [styles.row, pressed && styles.tieRowPressed]}
                >
                  <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
                  <Text style={styles.name}>{player.name}</Text>
                  <Text style={styles.total}>{entry.total}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button label={t("end.tieLeaveTied")} variant="ghost" onPress={() => resolveTie(null)} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <ConfirmDialog
        visible={showUndoConfirm}
        title={t("standings.undoTitle")}
        description={t("standings.undoDescription")}
        confirmLabel={t("standings.undoConfirm")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={confirmUndo}
        onCancel={() => setShowUndoConfirm(false)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.seal}>
          <BrandMark compact inverse />
        </View>
        <Text style={styles.kicker}>{t("end.closed")}</Text>
        <Text style={styles.winner}>{winner?.name ?? t("end.finished")}</Text>
        <Text style={styles.summary}>
          {t("end.winsWith")} {ranked[0]?.total ?? 0} {t("end.points")} · {game.rounds.length} {t("end.rounds")} · {game.players.length} {t("home.players")}
        </Text>
        <Text style={styles.sync}>
          {syncStatus === "syncing" && t("end.saving")}
          {syncStatus === "synced" && t("end.savedOnline")}
          {syncStatus === "verified" && (
            <>
              {t("end.savedVerified")} {verifiedCount}.
              {unmatchedCount > 0 ? ` ${unmatchedCount} ${t("end.unmatchedAccounts")}` : ""}
            </>
          )}
          {syncStatus === "verification-failed" && t("end.savedVerificationFailed")}
          {syncStatus === "offline" && t("end.savedOffline")}
          {syncStatus === "not-shared" && t("end.savedNotShared")}
        </Text>

        <View style={styles.ranking}>
          {ranked.map((entry, index) => {
            const player = playerById.get(entry.playerId);
            if (!player) return null;
            return (
              <View key={entry.playerId} style={styles.row}>
                <Text style={[styles.position, index === 0 && styles.first]}>{index + 1}</Text>
                <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
                <Text style={styles.name}>{player.name}</Text>
                <Text style={styles.total}>{entry.total}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Button label={t("end.review")} variant="ghost" onPress={() => router.push("/game/standings")} />
          <Button label={t("end.saveHome")} variant="yellow" onPress={home} />
        </View>

        {game.rounds.length > 0 && (
          <Pressable onPress={() => setShowUndoConfirm(true)} style={styles.undoLink}>
            <Text style={styles.undoText}>{t("standings.undoLastRound")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.text },
    content: {
      width: "100%",
      maxWidth: 620,
      alignSelf: "center",
      paddingHorizontal: 18,
      paddingTop: 34,
      paddingBottom: 24,
      alignItems: "center",
    },
    seal: {
      width: 46,
      height: 46,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: colors.success,
    },
    kicker: {
      marginTop: 18,
      color: colors.yellow,
      fontFamily: theme.font.family.bold,
      fontSize: 10,
      letterSpacing: 2.2,
    },
    winner: {
      marginTop: 7,
      color: colors.background,
      fontFamily: theme.font.family.display,
      fontSize: 40,
      lineHeight: 46,
      textAlign: "center",
    },
    summary: {
      color: colors.backgroundMuted,
      fontFamily: theme.font.family.semibold,
      fontSize: 12.5,
      textAlign: "center",
    },
    sync: {
      marginTop: 6,
      color: colors.backgroundFaint,
      fontFamily: theme.font.family.medium,
      fontSize: 10.5,
      lineHeight: 15,
      textAlign: "center",
    },
    ranking: { alignSelf: "stretch", marginTop: 25, gap: 8 },
    row: {
      minHeight: 62,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 13,
      backgroundColor: colors.backgroundSoft,
    },
    position: {
      width: 18,
      color: colors.backgroundMuted,
      fontFamily: theme.font.family.extraBold,
      fontSize: 14,
    },
    first: { color: colors.yellow },
    name: { flex: 1, color: colors.background, fontFamily: theme.font.family.bold, fontSize: 14 },
    total: {
      color: colors.background,
      fontFamily: theme.font.family.extraBold,
      fontSize: 20,
      fontVariant: ["tabular-nums"],
    },
    actions: { alignSelf: "stretch", marginTop: 22, gap: 8 },
    tieRowPressed: { opacity: 0.72 },
    undoLink: { marginTop: 4, minHeight: 44, alignItems: "center", justifyContent: "center" },
    undoText: { color: colors.backgroundMuted, fontFamily: theme.font.family.semibold, fontSize: 11.5 },
    empty: { flex: 1, justifyContent: "center", padding: 18, gap: 16 },
    emptyText: { color: colors.background, fontFamily: theme.font.family.semibold, textAlign: "center" },
  });
}
