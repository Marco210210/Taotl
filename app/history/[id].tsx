import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { deleteFinishedGame, fetchGameHistoryDetail } from "@/api/games";
import type { GameHistoryDetailDTO } from "@/api/types";
import { Button } from "@/components/Button";
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

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [game, setGame] = useState<GameHistoryDetailDTO | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchGameHistoryDetail(id)
      .then((result) => {
        if (!active) return;
        setGame(result.game);
        setFromCache(result.fromCache);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Partita non disponibile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const playerById = useMemo(
    () => new Map(game?.players.map((player) => [player.id, player.name]) ?? []),
    [game],
  );

  const requestDelete = () => {
    if (!game) return;
    Alert.alert(
      "Eliminare questa partita?",
      "La partita e tutti i punteggi dei suoi turni verranno eliminati definitivamente dallo storico.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteFinishedGame(game.id);
              router.replace("/history");
            } catch (reason) {
              Alert.alert(
                "Eliminazione non riuscita",
                reason instanceof Error ? reason.message : "Controlla la connessione e riprova.",
              );
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.helper}>Carico tutti i turni…</Text>
      </ScreenContainer>
    );
  }

  if (!game || error) {
    return (
      <ScreenContainer style={styles.center}>
        <Text style={styles.error}>{error ?? "Partita non trovata."}</Text>
        <Button label="Torna allo storico" variant="secondary" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View>
        <ScreenIntro
          title={MODE_LABELS[game.mode] ?? game.mode}
          description={`${new Date(game.startedAt).toLocaleString("it-IT")} · ${game.numPlayers} giocatori`}
        />
        {fromCache && <Text style={styles.cacheNotice}>Dettaglio recuperato dalla copia di questo telefono.</Text>}
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Classifica finale</Text>
        {game.standings.map((standing, index) => (
          <View key={standing.playerId} style={styles.row}>
            <Text style={styles.position}>{index + 1}</Text>
            <Text style={styles.name}>{standing.name}</Text>
            <Text style={[styles.score, standing.total < 0 && styles.negative]}>{standing.total}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.sectionTitle}>Tutti i turni</Text>
      {game.rounds.map((round) => (
        <Card key={round.index}>
          <Text style={styles.roundTitle}>
            Turno {round.index} · {round.cardsDealt} carte
          </Text>
          <Text style={styles.helper}>
            Mazziere: {playerById.get(round.dealerId) ?? "—"} · Presa ±{round.presaValue} · Rispetto +{" "}
            {round.rispettoValue}
          </Text>
          {round.results.map((result) => (
            <View key={result.playerId} style={styles.resultRow}>
              <View style={styles.resultInfo}>
                <Text style={styles.name}>{result.name}</Text>
                <Text style={styles.helper}>
                  Chiamata {result.bid} ·{" "}
                  {result.respected ? "rispettata" : `non rispettata, scarto ${result.scarto}`}
                </Text>
              </View>
              <Text style={[styles.score, result.score < 0 && styles.negative]}>
                {result.score >= 0 ? "+" : ""}
                {result.score}
              </Text>
            </View>
          ))}
        </Card>
      ))}

      <Button label="Elimina partita" variant="danger" loading={deleting} onPress={requestDelete} />
      <Text style={styles.deleteNote}>La password amministratore verrà aggiunta in una fase successiva.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, fontFamily: theme.font.family.medium },
  error: {
    color: theme.colors.danger,
    fontSize: theme.font.body,
    fontFamily: theme.font.family.semibold,
    textAlign: "center",
  },
  cacheNotice: {
    color: theme.colors.warning,
    fontSize: theme.font.small,
    fontFamily: theme.font.family.semibold,
    marginTop: theme.spacing(0.5),
  },
  sectionTitle: { color: theme.colors.text, fontSize: 17, fontFamily: theme.font.family.extraBold },
  roundTitle: { color: theme.colors.primary, fontSize: theme.font.body, fontFamily: theme.font.family.extraBold },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1), paddingVertical: 5 },
  position: { width: 22, color: theme.colors.textMuted, fontFamily: theme.font.family.extraBold },
  name: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
  score: {
    color: theme.colors.success,
    fontSize: theme.font.body,
    fontFamily: theme.font.family.extraBold,
    fontVariant: ["tabular-nums"],
  },
  negative: { color: theme.colors.danger },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1),
    paddingVertical: theme.spacing(0.75),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  resultInfo: { flex: 1, gap: 2 },
  deleteNote: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    fontFamily: theme.font.family.medium,
    textAlign: "center",
  },
});
