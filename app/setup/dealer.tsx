import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useSetup } from "@/state/SetupContext";
import { theme, type ThemeColors } from "@/theme";

const ROW_SLOT_HEIGHT = 72;

export default function SetupDealerScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { selectedPlayers, dealerId, setDealerId, movePlayer } = useSetup();
  const [dragPreview, setDragPreview] = useState<{ from: number; to: number } | null>(null);
  const playerCount = selectedPlayers.length;

  // Memoizzate: sono dipendenze dirette del PanResponder creato dentro ogni
  // DealerRow. Se cambiassero identità ad ogni render (come prima), il
  // PanResponder verrebbe ricreato quasi ad ogni frame di onPanResponderMove
  // (che chiama updateDragPreview, che con setDragPreview ri-renderizza
  // questo componente) — è quello che causava gli scatti nel trascinamento.
  const updateDragPreview = useCallback((from: number, offsetY: number) => {
    const to = Math.max(
      0,
      Math.min(playerCount - 1, from + Math.round(offsetY / ROW_SLOT_HEIGHT)),
    );
    setDragPreview((current) => (
      current?.from === from && current.to === to ? current : { from, to }
    ));
    return to;
  }, [playerCount]);

  const finishDrag = useCallback((from: number, to: number) => {
    if (from !== to) movePlayer(from, to);
    setDragPreview(null);
  }, [movePlayer]);

  const cancelDrag = useCallback(() => setDragPreview(null), []);

  const previewIndexFor = (index: number) => {
    if (!dragPreview || index === dragPreview.from) return index;
    if (dragPreview.from < dragPreview.to && index > dragPreview.from && index <= dragPreview.to) {
      return index - 1;
    }
    if (dragPreview.from > dragPreview.to && index >= dragPreview.to && index < dragPreview.from) {
      return index + 1;
    }
    return index;
  };

  if (selectedPlayers.length === 0) {
    return (
      <ScreenContainer>
        <ScreenIntro title={t("dealer.missingTitle")} description={t("dealer.missingDescription")} />
        <Button label={t("dealer.choosePlayers")} onPress={() => router.replace("/setup/players")} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      footer={
        <Button
          label={t("dealer.chooseMode")}
          trailing="→"
          variant="secondary"
          onPress={() => router.push("/setup/mode")}
          disabled={!dealerId}
        />
      }
    >
      <ScreenIntro
        title={t("dealer.title")}
        description={t("dealer.description")}
      />
      <Text style={styles.reorderHint}>{t("dealer.reorderHint")}</Text>

      <View style={[styles.list, { height: selectedPlayers.length * ROW_SLOT_HEIGHT }]}>
        {selectedPlayers.map((player, index) => (
          <DealerRow
            key={player.id}
            player={player}
            index={index}
            playerCount={selectedPlayers.length}
            selected={dealerId === player.id}
            onSelect={() => setDealerId(player.id)}
            onMove={movePlayer}
            previewIndex={previewIndexFor(index)}
            onDragStart={() => setDragPreview({ from: index, to: index })}
            onDragMove={updateDragPreview}
            onDragEnd={finishDrag}
            onDragCancel={cancelDrag}
            labels={{
              badge: t("dealer.badge"),
              moveUp: t("dealer.moveUp"),
              moveDown: t("dealer.moveDown"),
              drag: t("dealer.drag"),
            }}
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
  previewIndex,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  labels,
}: {
  player: ReturnType<typeof useSetup>["selectedPlayers"][number];
  index: number;
  playerCount: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  previewIndex: number;
  onDragStart: () => void;
  onDragMove: (fromIndex: number, offsetY: number) => number;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragCancel: () => void;
  labels: { badge: string; moveUp: string; moveDown: string; drag: string };
}) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dragging, setDragging] = useState(false);
  const position = useRef(new Animated.Value(index * ROW_SLOT_HEIGHT)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const targetIndex = useRef(index);

  useEffect(() => {
    if (dragging) return;
    Animated.spring(position, {
      toValue: previewIndex * ROW_SLOT_HEIGHT,
      damping: 19,
      stiffness: 230,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [dragging, position, previewIndex]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Il tap continua a selezionare il mazziere; il trascinamento prende
        // il controllo solo dopo un movimento verticale intenzionale.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          targetIndex.current = index;
          position.stopAnimation();
          dragOffset.setValue(0);
          setDragging(true);
          onDragStart();
          Animated.spring(lift, {
            toValue: 1,
            damping: 16,
            stiffness: 260,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gesture) => {
          dragOffset.setValue(gesture.dy);
          targetIndex.current = onDragMove(index, gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          const target = Math.max(0, Math.min(playerCount - 1, targetIndex.current));
          Animated.parallel([
            Animated.spring(dragOffset, {
              toValue: (target - index) * ROW_SLOT_HEIGHT,
              damping: 18,
              stiffness: 250,
              mass: 0.7,
              useNativeDriver: true,
            }),
            Animated.spring(lift, {
              toValue: 0,
              damping: 18,
              stiffness: 250,
              useNativeDriver: true,
            }),
          ]).start(() => {
            position.setValue(target * ROW_SLOT_HEIGHT);
            dragOffset.setValue(0);
            setDragging(false);
            onDragEnd(index, target);
          });
        },
        // Evita che lo ScrollView esterno interrompa il gesto appena il dito
        // esce dalla maniglia: era la causa della riga che si evidenziava ma
        // rimaneva ferma nel suo posto.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(dragOffset, {
              toValue: 0,
              damping: 18,
              stiffness: 250,
              useNativeDriver: true,
            }),
            Animated.spring(lift, {
              toValue: 0,
              damping: 18,
              stiffness: 250,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setDragging(false);
            onDragCancel();
          });
        },
      }),
    [
      dragOffset,
      index,
      lift,
      onDragCancel,
      onDragEnd,
      onDragMove,
      onDragStart,
      playerCount,
      position,
    ],
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.animatedRow,
        dragging && styles.animatedRowDragging,
        {
          transform: [
            { translateY: Animated.add(position, dragOffset) },
            {
              scale: lift.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.025],
              }),
            },
          ],
          shadowOpacity: lift.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.2],
          }),
        },
      ]}
    >
      <Pressable
        onPress={onSelect}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.row,
          selected && styles.rowSelected,
          dragging && styles.dragging,
          pressed && !dragging && styles.pressed,
        ]}
      >
        <Text style={styles.position}>{index + 1}</Text>
        <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={36} />
        <Text style={styles.name}>{player.name}</Text>
        <View style={[styles.dealerPill, selected && styles.dealerPillSelected]}>
          <Text style={[styles.dealerText, selected && styles.dealerTextSelected]}>{labels.badge}</Text>
        </View>
        <View style={styles.controls}>
          <Pressable
            accessibilityLabel={`${labels.moveUp}: ${player.name}`}
            disabled={index === 0 || dragging}
            onPress={() => onMove(index, index - 1)}
            style={[styles.arrow, (index === 0 || dragging) && styles.arrowDisabled]}
          >
            <Text pointerEvents="none" style={styles.arrowText}>▲</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`${labels.moveDown}: ${player.name}`}
            disabled={index === playerCount - 1 || dragging}
            onPress={() => onMove(index, index + 1)}
            style={[styles.arrow, (index === playerCount - 1 || dragging) && styles.arrowDisabled]}
          >
            <Text pointerEvents="none" style={styles.arrowText}>▼</Text>
          </Pressable>
        </View>
        <View pointerEvents="none" style={styles.dragHandle} accessibilityLabel={`${labels.drag}: ${player.name}`}>
          <Text pointerEvents="none" style={styles.dragText}>⠿</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    reorderHint: { color: colors.success, fontFamily: theme.font.family.semibold, fontSize: 11.5 },
    list: { position: "relative" },
    animatedRow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 64,
      zIndex: 1,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 18,
      elevation: 1,
    },
    animatedRowDragging: { zIndex: 20, elevation: 12 },
    row: {
      height: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowSelected: { borderColor: colors.yellow },
    position: { width: 16, color: colors.textFaint, fontFamily: theme.font.family.extraBold, fontSize: 13 },
    name: { flex: 1, color: colors.text, fontFamily: theme.font.family.bold, fontSize: 14 },
    dealerPill: {
      paddingHorizontal: 7,
      paddingVertical: 5,
      borderRadius: 99,
      backgroundColor: colors.inkSoft,
    },
    dealerPillSelected: { backgroundColor: colors.yellow },
    dealerText: { color: colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 8.5, letterSpacing: 0.5 },
    dealerTextSelected: { color: colors.text },
    controls: { gap: 3 },
    arrow: {
      width: 30,
      height: 22,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inkSoft,
    },
    arrowDisabled: { opacity: 0.24 },
    arrowText: { color: colors.text, fontSize: 10 },
    dragHandle: {
      width: 36,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    dragText: { color: colors.textMuted, fontSize: 22, letterSpacing: -2 },
    dragging: { borderColor: colors.success, backgroundColor: colors.surface },
    pressed: { opacity: 0.76 },
  });
}
