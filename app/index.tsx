import { router } from "expo-router";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/Button";
import { getFixedSequence } from "@/game/modes";
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

const MENU_ITEMS = [
  {
    label: "Storico\npartite",
    route: "/history" as const,
    icon: require("../assets/design/suit-heart.png"),
  },
  {
    label: "Profili e\nstatistiche",
    route: "/profile" as const,
    icon: require("../assets/design/suit-diamond.png"),
  },
  {
    label: "Regole e\npunteggi",
    route: "/rules" as const,
    icon: require("../assets/design/suit-club.png"),
  },
  {
    label: "Impostazioni",
    route: "/settings" as const,
    icon: require("../assets/design/suit-spear.png"),
  },
] as const;

export default function HomeScreen() {
  const { game, isHydrated, ranked, resetGame } = useGame();

  const hasActiveGame = !!game && game.status !== "finished";
  const hasFinishedGame = !!game && game.status === "finished";
  const currentRound = game ? game.rounds.length + (game.status === "finished" ? 0 : 1) : 0;
  const totalRounds =
    game && game.mode !== "personalizzata" ? getFixedSequence(game.mode, game.players.length).length : null;
  const leaderEntry = ranked[0];
  const leader = game?.players.find((player) => player.id === leaderEntry?.playerId) ?? game?.players[0];

  const resumeGame = () => {
    if (!game) return;
    if (game.status === "scoring") router.push("/game/scoring");
    else router.push("/game/bids");
  };

  const deleteActiveGame = () => {
    if (!game || game.status === "finished") return;
    Alert.alert(
      "Eliminare la partita in corso?",
      "I turni e i punteggi di questa partita verranno eliminati da questo telefono. L’operazione non si può annullare.",
      [
        { text: "Annulla", style: "cancel" },
        { text: "Elimina partita", style: "destructive", onPress: resetGame },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <BrandMark />
          <Text style={styles.heroCopy}>Conta i punti. Goditi la partita.</Text>
        </View>

        <View style={styles.content}>
          {isHydrated && hasActiveGame && game && (
            <Pressable onPress={resumeGame} style={({ pressed }) => [styles.activeCard, pressed && styles.pressed]}>
              <View style={styles.activeTop}>
                <Text style={styles.activeLabel}>PARTITA IN CORSO</Text>
                <Text style={styles.roundMeta}>
                  Turno {currentRound}
                  {totalRounds ? `/${totalRounds}` : ""}
                </Text>
              </View>
              <View style={styles.leaderRow}>
                <View>
                  <Text style={styles.leaderName}>{leader?.name ?? `${game.players.length} giocatori`}</Text>
                  <Text style={styles.activeMeta}>
                    {game.players.length} giocatori · modalità {game.mode}
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
              <Text style={styles.resumeHint}>Tocca per continuare →</Text>
            </Pressable>
          )}

          {isHydrated && hasFinishedGame && (
            <Pressable
              onPress={() => router.push("/game/end")}
              style={({ pressed }) => [styles.activeCard, pressed && styles.pressed]}
            >
              <View style={styles.activeTop}>
                <Text style={styles.activeLabel}>ULTIMA PARTITA</Text>
                <Text style={styles.roundMeta}>Conclusa</Text>
              </View>
              <Text style={styles.leaderName}>Vedi il risultato finale →</Text>
            </Pressable>
          )}

          <Button
            label="Nuova partita"
            subtitle="Scegli i giocatori e comincia"
            trailing="→"
            onPress={() => router.push("/setup/players")}
          />

          <View style={styles.grid}>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route)}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                <Image source={item.icon} resizeMode="contain" style={styles.tileIcon} />
                <Text style={styles.tileLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => router.push("/roster")} style={styles.rosterLink}>
            <Text style={styles.rosterText}>Gestisci la rubrica giocatori</Text>
            <Text style={styles.rosterArrow}>›</Text>
          </Pressable>

          {hasActiveGame && (
            <Pressable onPress={deleteActiveGame} style={styles.deleteLink}>
              <Text style={styles.deleteText}>Elimina la partita in corso</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.success },
  page: { flexGrow: 1, backgroundColor: theme.colors.background },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 26,
    backgroundColor: theme.colors.success,
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    gap: 11,
  },
  activeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeLabel: {
    color: theme.colors.primary,
    fontFamily: theme.font.family.bold,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  roundMeta: { color: theme.colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 11 },
  leaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  leaderName: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 15 },
  activeMeta: { marginTop: 2, color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11 },
  leaderScore: {
    color: theme.colors.text,
    fontFamily: theme.font.family.extraBold,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: { height: 5, borderRadius: 99, overflow: "hidden", backgroundColor: theme.colors.inkSoft },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: theme.colors.success },
  resumeHint: { color: theme.colors.success, fontFamily: theme.font.family.bold, fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "48%",
    flexGrow: 1,
    minHeight: 108,
    padding: 15,
    borderRadius: 14,
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  tileIcon: { width: 25, height: 25 },
  tileLabel: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 13.5, lineHeight: 17 },
  rosterLink: {
    minHeight: 50,
    paddingHorizontal: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.inkSoft,
  },
  rosterText: { flex: 1, color: theme.colors.text, fontFamily: theme.font.family.semibold, fontSize: 12.5 },
  rosterArrow: { color: theme.colors.text, fontFamily: theme.font.family.regular, fontSize: 24 },
  deleteLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  deleteText: { color: theme.colors.danger, fontFamily: theme.font.family.semibold, fontSize: 12 },
  pressed: { opacity: 0.72 },
});
