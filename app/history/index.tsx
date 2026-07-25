import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchHistory } from "@/api/games";
import type { GameHistorySummaryDTO } from "@/api/types";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { theme } from "@/theme";

const MODE_LABELS: Record<string, string> = {
  classica: "Classica",
  completa: "Completa",
  breve: "Breve",
  personalizzata: "Personalizzata",
};

export default function HistoryScreen() {
  const [games, setGames] = useState<GameHistorySummaryDTO[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      fetchHistory().then((result) => {
        if (!active) return;
        setGames(result.games);
        setFromCache(result.fromCache);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScreenContainer>
      <ScreenIntro title="Le tue partite" description="Tocca una partita per rivedere classifica e punti di ogni turno." />
      {fromCache && (
        <Text style={styles.helper}>
          Non connesso al server: mostro solo le partite salvate su questo telefono in attesa di sincronizzazione.
        </Text>
      )}
      {loading && <Text style={styles.helper}>Carico lo storico…</Text>}
      {!loading && games.length === 0 && <Text style={styles.helper}>Nessuna partita salvata.</Text>}

      {games.map((g) => (
        <Pressable
          key={g.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/history/[id]", params: { id: g.id } })}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.gameCard}>
            <View style={styles.titleRow}>
              <Text style={styles.date}>
                {new Date(g.startedAt).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }).toUpperCase()}
              </Text>
              <Text style={styles.meta}>{MODE_LABELS[g.mode] ?? g.mode} · {g.numPlayers} giocatori</Text>
            </View>
            <View style={styles.winnerRow}>
              <View style={styles.mark}>
                <Image source={require("../../assets/design/suit-mask.png")} resizeMode="contain" style={styles.markImage} />
              </View>
              <View style={styles.winnerInfo}>
                <Text style={styles.winnerLabel}>VINCITORE</Text>
                <Text style={styles.winnerName}>{g.standings[0]?.name ?? "—"}</Text>
                <Text style={styles.others}>
                  {g.standings.slice(1).map((standing) => standing.name).join(" · ") || "Partita a due"}
                </Text>
              </View>
              <Text style={styles.winnerScore}>{g.standings[0]?.total ?? 0}</Text>
            </View>
            <Text style={styles.openHint}>Apri tutti i turni ›</Text>
          </Card>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, fontFamily: theme.font.family.medium },
  gameCard: { padding: 15, gap: 11 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(1) },
  date: { color: theme.colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 9.5, letterSpacing: 1.2 },
  meta: { color: theme.colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 10.5 },
  winnerRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.success,
  },
  markImage: { width: 26, height: 26 },
  winnerInfo: { flex: 1 },
  winnerLabel: { color: theme.colors.primary, fontFamily: theme.font.family.bold, fontSize: 8.5, letterSpacing: 1 },
  winnerName: { color: theme.colors.text, fontFamily: theme.font.family.extraBold, fontSize: 15 },
  others: { marginTop: 1, color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10.5 },
  winnerScore: {
    color: theme.colors.text,
    fontFamily: theme.font.family.extraBold,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
  },
  openHint: { color: theme.colors.success, fontSize: 10.5, fontFamily: theme.font.family.bold, textAlign: "right" },
  pressed: { opacity: 0.72 },
});
