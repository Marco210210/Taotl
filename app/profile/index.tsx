import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchHistory } from "@/api/games";
import { fetchRoster } from "@/api/players";
import type { GameHistorySummaryDTO } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import type { Player } from "@/game/types";
import { STORAGE_KEYS } from "@/state/storageKeys";
import { theme } from "@/theme";

export default function MyProfileScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameHistorySummaryDTO[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([fetchRoster(), fetchHistory(), AsyncStorage.getItem(STORAGE_KEYS.myPlayerId)])
        .then(([roster, history, storedId]) => {
          if (!active) return;
          setPlayers(roster.players);
          setGames(history.games);
          setMyPlayerId(storedId);
          setChoosing(!storedId);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const myPlayer = players.find((player) => player.id === myPlayerId) ?? null;
  const myGames = useMemo(
    () => (myPlayerId ? games.filter((game) => game.standings.some((entry) => entry.playerId === myPlayerId)) : []),
    [games, myPlayerId],
  );
  const stats = useMemo(() => {
    if (!myPlayerId) return { wins: 0, total: 0, average: 0 };
    let wins = 0;
    let total = 0;
    for (const game of myGames) {
      const mine = game.standings.find((entry) => entry.playerId === myPlayerId);
      if (!mine) continue;
      total += mine.total;
      const best = Math.max(...game.standings.map((entry) => entry.total));
      if (mine.total === best) wins += 1;
    }
    return { wins, total, average: myGames.length ? total / myGames.length : 0 };
  }, [myGames, myPlayerId]);

  const selectPlayer = async (player: Player) => {
    await AsyncStorage.setItem(STORAGE_KEYS.myPlayerId, player.id);
    setMyPlayerId(player.id);
    setChoosing(false);
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.helper}>Carico il tuo profilo…</Text>
      </ScreenContainer>
    );
  }

  if (choosing || !myPlayer) {
    return (
      <ScreenContainer>
        <ScreenIntro
          title="Chi sei?"
          description="Scegli il tuo giocatore. La scelta resta su questo dispositivo e serve a filtrare partite e statistiche personali."
        />
        {players.map((player) => (
          <Pressable key={player.id} onPress={() => selectPlayer(player)} style={styles.playerRow}>
            <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={46} />
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.selectHint}>Scegli ›</Text>
          </Pressable>
        ))}
        {players.length === 0 && (
          <Text style={styles.helper}>Prima aggiungi il tuo nome nella rubrica giocatori.</Text>
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Card style={styles.profileCard}>
        <PlayerAvatar name={myPlayer.name} photoUri={myPlayer.photoUri} colorKey={myPlayer.id} size={78} />
        <Text style={styles.profileName}>{myPlayer.name}</Text>
        <Text style={styles.localTag}>Profilo di questo dispositivo</Text>
        <Button label="Cambia giocatore" variant="ghost" onPress={() => setChoosing(true)} />
      </Card>

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{myGames.length}</Text>
          <Text style={styles.statLabel}>Partite</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.wins}</Text>
          <Text style={styles.statLabel}>Vittorie</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.average.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Media punti</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Le mie partite</Text>
      {myGames.map((game) => {
        const mine = game.standings.find((entry) => entry.playerId === myPlayer.id);
        const position = game.standings.findIndex((entry) => entry.playerId === myPlayer.id) + 1;
        return (
          <Pressable
            key={game.id}
            onPress={() => router.push({ pathname: "/history/[id]", params: { id: game.id } })}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card>
              <View style={styles.gameRow}>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle}>
                    {new Date(game.startedAt).toLocaleDateString("it-IT")} · {game.numPlayers} giocatori
                  </Text>
                  <Text style={styles.helper}>Posizione {position}ª</Text>
                </View>
                <Text style={[styles.gameScore, (mine?.total ?? 0) < 0 && styles.negative]}>
                  {mine?.total ?? 0}
                </Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {myGames.length === 0 && <Text style={styles.helper}>Non risultano ancora partite con questo profilo.</Text>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  helper: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.medium,
    marginTop: theme.spacing(0.5),
  },
  playerRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  playerName: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
  selectHint: { color: theme.colors.success, fontSize: theme.font.small, fontFamily: theme.font.family.extraBold },
  profileCard: { alignItems: "center", paddingVertical: 20 },
  profileName: { color: theme.colors.text, fontSize: theme.font.title, fontFamily: theme.font.family.extraBold },
  localTag: { color: theme.colors.textMuted, fontSize: theme.font.small, fontFamily: theme.font.family.medium },
  statsGrid: { flexDirection: "row", gap: theme.spacing(1) },
  statCard: { flex: 1, alignItems: "center", paddingHorizontal: theme.spacing(0.5) },
  statValue: { color: theme.colors.success, fontSize: theme.font.heading, fontFamily: theme.font.family.extraBold },
  statLabel: { color: theme.colors.textMuted, fontSize: 10, fontFamily: theme.font.family.semibold, textAlign: "center" },
  sectionTitle: { color: theme.colors.text, fontSize: theme.font.heading, fontFamily: theme.font.family.extraBold },
  pressed: { opacity: 0.72 },
  gameRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
  gameInfo: { flex: 1 },
  gameTitle: { color: theme.colors.text, fontSize: theme.font.body, fontFamily: theme.font.family.bold },
  gameScore: {
    color: theme.colors.success,
    fontSize: theme.font.heading,
    fontFamily: theme.font.family.extraBold,
    fontVariant: ["tabular-nums"],
  },
  negative: { color: theme.colors.danger },
});
