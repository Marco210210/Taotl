import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useGame } from "@/state/GameContext";
import { theme, type ThemeColors } from "@/theme";

export default function CorrectDealerScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { game, currentRoundInfo, setCurrentDealer } = useGame();

  if (
    !game ||
    game.rounds.length > 0 ||
    (game.status !== "bidding" && game.status !== "awaiting-cards")
  ) {
    return (
      <ScreenContainer>
        <Text style={styles.helper}>
          {t("fixDealer.limit")}
        </Text>
        <Button label={t("fixDealer.back")} onPress={() => router.dismissTo("/game/bids")} />
      </ScreenContainer>
    );
  }

  const currentDealerId =
    currentRoundInfo?.dealerId ??
    game.players[(game.players.findIndex((player) => player.id === game.startDealerId) + game.rounds.length) % game.players.length]
      ?.id;

  const selectDealer = (dealerId: string) => {
    setCurrentDealer(dealerId);
    router.dismissTo("/game/bids");
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>{t("fixDealer.title")}</Text>
        <Text style={styles.helper}>
          {t("fixDealer.description")}
        </Text>
      </View>

      <View style={styles.list}>
        {game.players.map((player) => (
          <Pressable
            key={player.id}
            onPress={() => selectDealer(player.id)}
            style={[styles.row, currentDealerId === player.id && styles.rowSelected]}
          >
            <PlayerAvatar name={player.name} photoUri={player.photoUri} size={42} />
            <Text style={styles.name}>{player.name}</Text>
            {currentDealerId === player.id && <Text style={styles.tag}>{t("fixDealer.current")}</Text>}
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heading: { fontSize: theme.font.title, fontWeight: "800", color: colors.text },
    helper: { fontSize: theme.font.small, color: colors.textMuted, marginTop: theme.spacing(0.5) },
    list: { gap: theme.spacing(1) },
    row: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.25),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
    name: { flex: 1, color: colors.text, fontSize: theme.font.body, fontWeight: "700" },
    tag: { color: colors.primary, fontSize: theme.font.small, fontWeight: "800" },
  });
}
