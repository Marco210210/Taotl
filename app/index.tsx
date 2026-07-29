import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { getFixedSequence } from "@/game/modes";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useGame } from "@/state/GameContext";
import { STORAGE_KEYS } from "@/state/storageKeys";
import { theme, type ThemeColors } from "@/theme";

export default function HomeScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { account, loading: accountLoading } = useAccount();
  const { game, isHydrated, ranked, resetGame } = useGame();
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const menuItems = [
    { label: t("home.history"), route: "/history" as const, icon: require("../assets/design/suit-heart.png") },
    { label: t("home.profiles"), route: "/profile" as const, icon: require("../assets/design/suit-diamond.png") },
    { label: t("home.rules"), route: "/rules" as const, icon: require("../assets/design/suit-club.png") },
    { label: t("home.settings"), route: "/settings" as const, icon: require("../assets/design/suit-spear.png") },
  ];

  const hasActiveGame = !!game && game.status !== "finished";
  const hasFinishedGame = !!game && game.status === "finished";
  const currentRound = game ? game.rounds.length + (game.status === "finished" ? 0 : 1) : 0;
  const totalRounds =
    game && game.mode !== "personalizzata" ? getFixedSequence(game.mode, game.players.length).length : null;
  const leaderEntry = ranked[0];
  const leader = game?.players.find((player) => player.id === leaderEntry?.playerId) ?? game?.players[0];

  useEffect(() => {
    let active = true;
    if (accountLoading) return () => {
      active = false;
    };
    if (account) {
      setShowAccountPrompt(false);
      return () => {
        active = false;
      };
    }
    AsyncStorage.getItem(STORAGE_KEYS.accountPromptSeen)
      .then((seen) => {
        if (active && seen !== "yes") setShowAccountPrompt(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [account, accountLoading]);

  const rememberAccountPrompt = async () => {
    setShowAccountPrompt(false);
    await AsyncStorage.setItem(STORAGE_KEYS.accountPromptSeen, "yes").catch(() => {});
  };

  const openAccount = () => {
    void rememberAccountPrompt();
    router.push({ pathname: "/account", params: { from: "home" } });
  };

  const resumeGame = () => {
    if (!game) return;
    if (game.status === "scoring") router.push("/game/scoring");
    else router.push("/game/bids");
  };

  const deleteActiveGame = () => {
    if (!game || game.status === "finished") return;
    Alert.alert(
      t("home.deleteActiveTitle"),
      t("home.deleteActiveBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("home.deleteGame"), style: "destructive", onPress: resetGame },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Modal
        animationType="fade"
        transparent
        visible={showAccountPrompt}
        onRequestClose={() => void rememberAccountPrompt()}
      >
        <View style={styles.promptOverlay}>
          <Card style={styles.promptCard}>
            <Text style={styles.promptEyebrow}>{t("account.promptRecommended")}</Text>
            <Text style={styles.promptTitle}>{t("account.promptTitle")}</Text>
            <Text style={styles.promptBody}>{t("account.promptBody")}</Text>
            <Button
              label={t("account.promptCreate")}
              variant="success"
              onPress={openAccount}
            />
            <Button
              label={t("account.promptGuest")}
              variant="ghost"
              onPress={() => void rememberAccountPrompt()}
            />
          </Card>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <BrandMark />
          <Text style={styles.heroCopy}>{t("home.tagline")}</Text>
        </View>

        <View style={styles.content}>
          {isHydrated && hasActiveGame && game && (
            <Pressable onPress={resumeGame} style={({ pressed }) => [styles.activeCard, pressed && styles.pressed]}>
              <View style={styles.activeTop}>
                <Text style={styles.activeLabel}>{t("home.activeGame")}</Text>
                <Text style={styles.roundMeta}>
                  {t("home.round")} {currentRound}
                  {totalRounds ? `/${totalRounds}` : ""}
                </Text>
              </View>
              <View style={styles.leaderRow}>
                <View>
                  <Text style={styles.leaderName}>{leader?.name ?? `${game.players.length} ${t("home.players")}`}</Text>
                  <Text style={styles.activeMeta}>
                    {game.players.length} {t("home.players")} · {t("home.mode")} {t(`mode.${game.mode}`)}
                  </Text>
                </View>
                <Text style={styles.leaderScore}>{leaderEntry?.total ?? 0}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: totalRounds ? `${Math.min(100, (game.rounds.length / totalRounds) * 100)}%` : "18%" },
                  ]}
                />
              </View>
              <Text style={styles.resumeHint}>{t("home.resume")}</Text>
            </Pressable>
          )}

          {isHydrated && hasFinishedGame && (
            <Pressable
              onPress={() => router.push("/game/end")}
              style={({ pressed }) => [styles.activeCard, pressed && styles.pressed]}
            >
              <View style={styles.activeTop}>
                <Text style={styles.activeLabel}>{t("home.lastGame")}</Text>
                <Text style={styles.roundMeta}>{t("home.finished")}</Text>
              </View>
              <Text style={styles.leaderName}>{t("home.finalResult")}</Text>
            </Pressable>
          )}

          <Button
            label={t("home.newGame")}
            subtitle={t("home.newGameSubtitle")}
            trailing="→"
            onPress={() => router.push("/setup/players")}
          />

          <View style={styles.grid}>
            {menuItems.map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.navigate(item.route)}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                <Image source={item.icon} resizeMode="contain" style={styles.tileIcon} />
                <Text style={styles.tileLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => router.navigate("/leaderboard")}
            style={({ pressed }) => [styles.leaderboardCard, pressed && styles.pressed]}
          >
            <Image
              source={require("../assets/design/suit-mask.png")}
              resizeMode="contain"
              style={styles.leaderboardIcon}
            />
            <Text style={styles.leaderboardLabel}>{t("home.leaderboard").replace("\n", " ")}</Text>
            <Text style={styles.leaderboardArrow}>›</Text>
          </Pressable>

          {account?.isAdmin && (
            <Pressable
              onPress={() => router.navigate("/admin")}
              style={({ pressed }) => [styles.adminCard, pressed && styles.pressed]}
            >
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>A</Text>
              </View>
              <View style={styles.adminInfo}>
                <Text style={styles.adminLabel}>{t("admin.homeShortcut")}</Text>
                <Text style={styles.adminMeta}>@{account.handle}</Text>
              </View>
              <Text style={styles.leaderboardArrow}>›</Text>
            </Pressable>
          )}

          <Pressable onPress={() => router.navigate("/roster")} style={styles.rosterLink}>
            <Text style={styles.rosterText}>{t("home.manageRoster")}</Text>
            <Text style={styles.rosterArrow}>›</Text>
          </Pressable>

          {hasActiveGame && (
            <Pressable onPress={deleteActiveGame} style={styles.deleteLink}>
              <Text style={styles.deleteText}>{t("home.deleteActive")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.successHero },
    page: { flexGrow: 1, backgroundColor: colors.background },
    hero: {
      paddingHorizontal: 22,
      paddingTop: 28,
      paddingBottom: 26,
      backgroundColor: colors.successHero,
      gap: 14,
    },
    heroCopy: {
      color: "rgba(248,248,245,.72)",
      fontFamily: theme.font.family.medium,
      fontSize: 12,
    },
    content: {
      width: "100%",
      maxWidth: 620,
      alignSelf: "center",
      padding: 18,
      gap: 14,
    },
    activeCard: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      gap: 11,
    },
    activeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    activeLabel: {
      color: colors.primary,
      fontFamily: theme.font.family.bold,
      fontSize: 10,
      letterSpacing: 1.5,
    },
    roundMeta: { color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 11 },
    leaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
    leaderName: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 15 },
    activeMeta: { marginTop: 2, color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11 },
    leaderScore: {
      color: colors.text,
      fontFamily: theme.font.family.extraBold,
      fontSize: 22,
      fontVariant: ["tabular-nums"],
    },
    progressTrack: { height: 5, borderRadius: 99, overflow: "hidden", backgroundColor: colors.inkSoft },
    progressFill: { height: "100%", borderRadius: 99, backgroundColor: colors.success },
    resumeHint: { color: colors.success, fontFamily: theme.font.family.bold, fontSize: 11 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    tile: {
      width: "48%",
      flexGrow: 1,
      minHeight: 108,
      padding: 15,
      borderRadius: 14,
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    tileIcon: { width: 25, height: 25 },
    tileLabel: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 13.5, lineHeight: 17 },
    leaderboardCard: {
      minHeight: 64,
      paddingHorizontal: 16,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    leaderboardIcon: { width: 26, height: 26 },
    leaderboardLabel: { flex: 1, color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 15 },
    leaderboardArrow: { color: colors.text, fontFamily: theme.font.family.regular, fontSize: 26 },
    adminCard: {
      minHeight: 68,
      paddingHorizontal: 14,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.firstPlace,
      borderWidth: 1,
      borderColor: colors.firstPlaceBorder,
    },
    adminBadge: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.yellow,
    },
    adminBadgeText: { color: "#17181D", fontFamily: theme.font.family.extraBold, fontSize: 16 },
    adminInfo: { flex: 1 },
    adminLabel: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 14 },
    adminMeta: { color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 10.5 },
    rosterLink: {
      minHeight: 50,
      paddingHorizontal: 15,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.inkSoft,
    },
    rosterText: { flex: 1, color: colors.text, fontFamily: theme.font.family.semibold, fontSize: 12.5 },
    rosterArrow: { color: colors.text, fontFamily: theme.font.family.regular, fontSize: 24 },
    deleteLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    deleteText: { color: colors.danger, fontFamily: theme.font.family.semibold, fontSize: 12 },
    pressed: { opacity: 0.72 },
    promptOverlay: {
      flex: 1,
      justifyContent: "center",
      padding: 22,
      backgroundColor: "rgba(0, 0, 0, 0.58)",
    },
    promptCard: {
      width: "100%",
      maxWidth: 440,
      alignSelf: "center",
      padding: 20,
      gap: 12,
    },
    promptEyebrow: {
      color: colors.success,
      fontFamily: theme.font.family.extraBold,
      fontSize: 10,
      letterSpacing: 1.3,
    },
    promptTitle: {
      color: colors.text,
      fontFamily: theme.font.family.extraBold,
      fontSize: 22,
      lineHeight: 27,
    },
    promptBody: {
      color: colors.textMuted,
      fontFamily: theme.font.family.medium,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 2,
    },
  });
}
