import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useSetup } from "@/state/SetupContext";
import { theme, type ThemeColors } from "@/theme";

const REGULAR_ROW_HEIGHT = 64;
const REGULAR_ROW_SLOT_HEIGHT = 72;
const COMPACT_ROW_HEIGHT = 84;
const COMPACT_ROW_SLOT_HEIGHT = 92;

export default function SetupDealerScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, fontScale } = useWindowDimensions();
  const useAccessibleRows = width < 360 || fontScale > 1.2;
  const rowHeight = useAccessibleRows ? COMPACT_ROW_HEIGHT : REGULAR_ROW_HEIGHT;
  const rowSlotHeight = useAccessibleRows ? COMPACT_ROW_SLOT_HEIGHT : REGULAR_ROW_SLOT_HEIGHT;
  const { selectedPlayers, dealerId, setDealerId, movePlayer } = useSetup();
  const [dragPreview, setDragPreview] = useState<{ from: number; to: number } | null>(null);
  const playerCount = selectedPlayers.length;

  // Tutte queste callback restano stabili mentre cambia l'anteprima. Il gesto
  // nativo non viene quindi ricreato a metà trascinamento.
  const startDrag = useCallback((from: number) => {
    setDragPreview({ from, to: from });
  }, []);

  const updateDragPreview = useCallback((from: number, offsetY: number) => {
    const to = Math.max(
      0,
      Math.min(playerCount - 1, from + Math.round(offsetY / rowSlotHeight)),
    );
    setDragPreview((current) => (
      current?.from === from && current.to === to ? current : { from, to }
    ));
    return to;
  }, [playerCount, rowSlotHeight]);

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
      scrollEnabled={!dragPreview}
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

      <View style={[styles.list, { height: selectedPlayers.length * rowSlotHeight }]}>
        {selectedPlayers.map((player, index) => (
          <DealerRow
            key={player.id}
            player={player}
            index={index}
            playerCount={selectedPlayers.length}
            rowHeight={rowHeight}
            rowSlotHeight={rowSlotHeight}
            useAccessibleLayout={useAccessibleRows}
            selected={dealerId === player.id}
            onSelect={() => setDealerId(player.id)}
            onMove={movePlayer}
            previewIndex={previewIndexFor(index)}
            onDragStart={startDrag}
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
  rowHeight,
  rowSlotHeight,
  useAccessibleLayout,
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
  rowHeight: number;
  rowSlotHeight: number;
  useAccessibleLayout: boolean;
  selected: boolean;
  onSelect: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  previewIndex: number;
  onDragStart: (fromIndex: number) => void;
  onDragMove: (fromIndex: number, offsetY: number) => number;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragCancel: () => void;
  labels: { badge: string; moveUp: string; moveDown: string; drag: string };
}) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dragging, setDragging] = useState(false);
  const position = useRef(new Animated.Value(index * rowSlotHeight)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const targetIndex = useRef(index);
  const dragFinished = useRef(false);

  useEffect(() => {
    if (dragging) return;
    Animated.spring(position, {
      toValue: previewIndex * rowSlotHeight,
      damping: 19,
      stiffness: 230,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [dragging, position, previewIndex, rowSlotHeight]);

  const finishAnimation = useCallback((target: number) => {
    Animated.parallel([
      Animated.spring(dragOffset, {
        toValue: (target - index) * rowSlotHeight,
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
      position.setValue(target * rowSlotHeight);
      dragOffset.setValue(0);
      setDragging(false);
      onDragEnd(index, target);
    });
  }, [dragOffset, index, lift, onDragEnd, position, rowSlotHeight]);

  const cancelAnimation = useCallback(() => {
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
  }, [dragOffset, lift, onDragCancel]);

  const panGesture = useMemo(
    () => Gesture.Pan()
      // Il riconoscimento è affidato al gestore nativo: lo ScrollView non può
      // più sottrarre il tocco alla maniglia durante lo spostamento.
      .activeOffsetY([-4, 4])
      .maxPointers(1)
      .runOnJS(true)
      .onStart(() => {
        dragFinished.current = false;
        targetIndex.current = index;
        position.stopAnimation();
        dragOffset.setValue(0);
        setDragging(true);
        onDragStart(index);
        Animated.spring(lift, {
          toValue: 1,
          damping: 16,
          stiffness: 260,
          useNativeDriver: true,
        }).start();
      })
      .onUpdate((event) => {
        dragOffset.setValue(event.translationY);
        targetIndex.current = onDragMove(index, event.translationY);
      })
      .onEnd((event) => {
        targetIndex.current = onDragMove(index, event.translationY);
        const target = Math.max(0, Math.min(playerCount - 1, targetIndex.current));
        dragFinished.current = true;
        finishAnimation(target);
      })
      .onFinalize((_event, success) => {
        if (!success && !dragFinished.current) cancelAnimation();
      }),
    [
      cancelAnimation,
      dragOffset,
      finishAnimation,
      index,
      lift,
      onDragMove,
      onDragStart,
      playerCount,
      position,
    ],
  );

  return (
    <Animated.View
      style={[
        styles.animatedRow,
        dragging && styles.animatedRowDragging,
        {
          height: rowHeight,
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
          useAccessibleLayout && styles.rowAccessible,
          selected && styles.rowSelected,
          dragging && styles.dragging,
          pressed && !dragging && styles.pressed,
        ]}
      >
        <Text maxFontSizeMultiplier={1.15} style={styles.position}>{index + 1}</Text>
        <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={36} />
        <Text maxFontSizeMultiplier={1.15} numberOfLines={2} style={styles.name}>{player.name}</Text>
        <View style={[styles.dealerPill, selected && styles.dealerPillSelected]}>
          <Text
            maxFontSizeMultiplier={1.1}
            numberOfLines={1}
            style={[styles.dealerText, selected && styles.dealerTextSelected]}
          >
            {labels.badge}
          </Text>
        </View>
        <View style={styles.controls}>
          <Pressable
            accessibilityLabel={`${labels.moveUp}: ${player.name}`}
            disabled={index === 0 || dragging}
            onPress={() => onMove(index, index - 1)}
            style={[styles.arrow, (index === 0 || dragging) && styles.arrowDisabled]}
          >
            <Text allowFontScaling={false} pointerEvents="none" style={styles.arrowText}>▲</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`${labels.moveDown}: ${player.name}`}
            disabled={index === playerCount - 1 || dragging}
            onPress={() => onMove(index, index + 1)}
            style={[styles.arrow, (index === playerCount - 1 || dragging) && styles.arrowDisabled]}
          >
            <Text allowFontScaling={false} pointerEvents="none" style={styles.arrowText}>▼</Text>
          </Pressable>
        </View>
        <GestureDetector gesture={panGesture}>
          <View
            accessible
            accessibilityLabel={`${labels.drag}: ${player.name}`}
            accessibilityRole="adjustable"
            collapsable={false}
            style={styles.dragHandle}
          >
            <Text allowFontScaling={false} pointerEvents="none" style={styles.dragText}>⠿</Text>
          </View>
        </GestureDetector>
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
      height: "100%",
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
    rowAccessible: { gap: 7, paddingHorizontal: 9, paddingVertical: 10 },
    rowSelected: { borderColor: colors.yellow },
    position: { width: 16, color: colors.textFaint, fontFamily: theme.font.family.extraBold, fontSize: 13 },
    name: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontFamily: theme.font.family.bold,
      fontSize: 14,
      lineHeight: 19,
    },
    dealerPill: {
      flexShrink: 1,
      maxWidth: 72,
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
