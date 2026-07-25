import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { syncFinishedGame } from "@/api/games";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

type SyncStatus = "syncing" | "synced" | "offline";

export default function GameEndScreen() {
  const { t } = useAppSettings();
  const { game, ranked, resetGame } = useGame();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");

  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    syncFinishedGame(game).then((result) => {
      if (!cancelled) setSyncStatus(result.synced ? "synced" : "offline");
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
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
          {syncStatus === "offline" && t("end.savedOffline")}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.text },
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
    backgroundColor: theme.colors.success,
  },
  kicker: {
    marginTop: 18,
    color: theme.colors.yellow,
    fontFamily: theme.font.family.bold,
    fontSize: 10,
    letterSpacing: 2.2,
  },
  winner: {
    marginTop: 7,
    color: theme.colors.background,
    fontFamily: theme.font.family.display,
    fontSize: 40,
    lineHeight: 46,
    textAlign: "center",
  },
  summary: {
    color: "rgba(248,248,245,.62)",
    fontFamily: theme.font.family.semibold,
    fontSize: 12.5,
    textAlign: "center",
  },
  sync: {
    marginTop: 6,
    color: "rgba(248,248,245,.42)",
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
    backgroundColor: "rgba(248,248,245,.06)",
  },
  position: {
    width: 18,
    color: "rgba(248,248,245,.48)",
    fontFamily: theme.font.family.extraBold,
    fontSize: 14,
  },
  first: { color: theme.colors.yellow },
  name: { flex: 1, color: theme.colors.background, fontFamily: theme.font.family.bold, fontSize: 14 },
  total: {
    color: theme.colors.background,
    fontFamily: theme.font.family.extraBold,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
  },
  actions: { alignSelf: "stretch", marginTop: 22, gap: 8 },
  empty: { flex: 1, justifyContent: "center", padding: 18, gap: 16 },
  emptyText: { color: theme.colors.background, fontFamily: theme.font.family.semibold, textAlign: "center" },
});
