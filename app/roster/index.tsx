import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useRoster } from "@/state/useRoster";
import { theme } from "@/theme";

export default function RosterScreen() {
  const { players, loading, fromCache, reload } = useRoster();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.colors.primary} />}
      >
        <Text style={styles.heading}>Rubrica giocatori</Text>
        {fromCache && (
          <Text style={styles.helper}>
            Server non raggiungibile: mostro la copia salvata su questo telefono.
          </Text>
        )}

        <Button label="Aggiungi giocatore" onPress={() => router.push("/roster/edit")} />

        <View style={styles.list}>
          {players.map((player) => (
            <Pressable
              key={player.id}
              style={styles.row}
              onPress={() => router.push({ pathname: "/roster/edit", params: { id: player.id } })}
            >
              <PlayerAvatar name={player.name} photoUri={player.photoUri} size={44} />
              <Text style={styles.name}>{player.name}</Text>
            </Pressable>
          ))}
          {!loading && players.length === 0 && (
            <Text style={styles.helper}>Nessun giocatore ancora. Aggiungine uno qui sopra.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(2), gap: theme.spacing(2) },
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted },
  list: { gap: theme.spacing(1) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  name: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: "600" },
});
