import { router } from "expo-router";
import { useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useSetup } from "@/state/SetupContext";
import { theme } from "@/theme";

export default function SetupDealerScreen() {
  const { selectedPlayers, dealerId, setDealerId, movePlayer } = useSetup();

  if (selectedPlayers.length === 0) {
    return (
      <ScreenContainer>
        <ScreenIntro title="Mancano i giocatori" description="Torna indietro e scegli prima chi partecipa." />
        <Button label="Scegli i giocatori" onPress={() => router.replace("/setup/players")} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      footer={
        <Button
          label="Scegli la modalità"
          trailing="→"
          variant="secondary"
          onPress={() => router.push("/setup/mode")}
          disabled={!dealerId}
        />
      }
    >
      <ScreenIntro
        title="Ordine e mazziere"
        description="Metti i giocatori nello stesso ordine in cui sono seduti. Poi tocca chi darà le carte al primo turno."
      />
      <Text style={styles.reorderHint}>Trascina ↕ oppure usa le frecce per cambiare posizione.</Text>

      <View style={styles.list}>
        {selectedPlayers.map((player, index) => (
          <DealerRow
            key={player.id}
            player={player}
            index={index}
            playerCount={selectedPlayers.length}
            selected={dealerId === player.id}
            onSelect={() => setDealerId(player.id)}
            onMove={movePlayer}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

function DealerRow({
  player,
  index,
  playerCount,
  selected,
  onSelect,
  onMove,
}: {
  player: ReturnType<typeof useSetup>["selectedPlayers"][number];
  index: number;
  playerCount: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => setDragging(true),
        onPanResponderRelease: (_, gesture) => {
          const offset = Math.round(gesture.dy / 62);
          const target = Math.max(0, Math.min(playerCount - 1, index + offset));
          setDragging(false);
          onMove(index, target);
        },
        onPanResponderTerminate: () => setDragging(false),
      }),
    [index, onMove, playerCount],
  );

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, dragging && styles.dragging, pressed && styles.pressed]}
    >
      <Text style={styles.position}>{index + 1}</Text>
      <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={36} />
      <Text style={styles.name}>{player.name}</Text>
      <View style={[styles.dealerPill, selected && styles.dealerPillSelected]}>
        <Text style={[styles.dealerText, selected && styles.dealerTextSelected]}>MAZZIERE</Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel={`Sposta ${player.name} su`}
          disabled={index === 0}
          onPress={() => onMove(index, index - 1)}
          style={[styles.arrow, index === 0 && styles.arrowDisabled]}
        >
          <Text pointerEvents="none" style={styles.arrowText}>▲</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Sposta ${player.name} giù`}
          disabled={index === playerCount - 1}
          onPress={() => onMove(index, index + 1)}
          style={[styles.arrow, index === playerCount - 1 && styles.arrowDisabled]}
        >
          <Text pointerEvents="none" style={styles.arrowText}>▼</Text>
        </Pressable>
      </View>
      <View {...panResponder.panHandlers} style={styles.dragHandle} accessibilityLabel={`Trascina ${player.name}`}>
        <Text pointerEvents="none" style={styles.dragText}>↕</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  reorderHint: { color: theme.colors.success, fontFamily: theme.font.family.semibold, fontSize: 11.5 },
  list: { gap: 8 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  rowSelected: { borderColor: theme.colors.yellow },
  position: { width: 16, color: theme.colors.textFaint, fontFamily: theme.font.family.extraBold, fontSize: 13 },
  name: { flex: 1, color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 14 },
  dealerPill: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: theme.colors.inkSoft,
  },
  dealerPillSelected: { backgroundColor: theme.colors.yellow },
  dealerText: { color: theme.colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 8.5, letterSpacing: 0.5 },
  dealerTextSelected: { color: theme.colors.text },
  controls: { gap: 3 },
  arrow: {
    width: 30,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.inkSoft,
  },
  arrowDisabled: { opacity: 0.24 },
  arrowText: { color: theme.colors.text, fontSize: 10 },
  dragHandle: {
    width: 36,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
  dragText: { color: theme.colors.textMuted, fontSize: 20 },
  dragging: { opacity: 0.58, borderColor: theme.colors.success },
  pressed: { opacity: 0.76 },
});
