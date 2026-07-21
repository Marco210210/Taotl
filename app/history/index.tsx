import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fetchHistory } from "@/api/games";
import type { GameHistorySummaryDTO } from "@/api/types";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
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

  useEffect(() => {
    fetchHistory().then((result) => {
      setGames(result.games);
      setFromCache(result.fromCache);
      setLoading(false);
    });
  }, []);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Storico partite</Text>
      {fromCache && (
        <Text style={styles.helper}>
          Non connesso al server: mostro solo le partite salvate su questo telefono in attesa di sincronizzazione.
        </Text>
      )}
      {loading && <Text style={styles.helper}>Carico lo storico…</Text>}
      {!loading && games.length === 0 && <Text style={styles.helper}>Nessuna partita salvata.</Text>}

      {games.map((g) => (
        <Card key={g.id}>
          <Text style={styles.cardTitle}>
            {MODE_LABELS[g.mode] ?? g.mode} · {g.numPlayers} giocatori
          </Text>
          <Text style={styles.helper}>{new Date(g.startedAt).toLocaleDateString("it-IT")}</Text>
          <View style={styles.standings}>
            {g.standings.map((s, index) => (
              <View key={s.playerId} style={styles.row}>
                <Text style={styles.position}>{index + 1}</Text>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={[styles.total, s.total < 0 && styles.totalNegative]}>{s.total}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted },
  cardTitle: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  standings: { marginTop: theme.spacing(1) },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1), paddingVertical: 3 },
  position: { width: 18, color: theme.colors.textMuted, fontWeight: "700", fontSize: theme.font.small },
  name: { flex: 1, color: theme.colors.text, fontSize: theme.font.small, fontWeight: "600" },
  total: { fontSize: theme.font.small, fontWeight: "800", color: theme.colors.success },
  totalNegative: { color: theme.colors.danger },
});
