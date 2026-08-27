import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LeaderboardSelector } from "@/components/LeaderboardSelector";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/game/constants";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useAccount } from "@/state/AccountContext";
import { useSetup } from "@/state/SetupContext";
import { useRoster } from "@/state/useRoster";
import { theme, type ThemeColors } from "@/theme";

export default function SetupPlayersScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { account, room } = useAccount();
  const writableBoards = useMemo(() => account?.leaderboards.filter((item) => item.canSubmit) ?? [], [account?.leaderboards]);
  const { leaderboardId, setLeaderboard, selectedPlayers, togglePlayer } = useSetup();
  const selectedBoard = writableBoards.find((item) => item.id === leaderboardId) ?? null;
  const { players, loading, addPlayer } = useRoster(account ? leaderboardId : null, !account || !!leaderboardId);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!account || leaderboardId || writableBoards.length === 0) return;
    const preferred = writableBoards.find((item) => item.id === account.defaultLeaderboardId) ?? writableBoards[0];
    setLeaderboard(preferred.id, preferred.name);
  }, [account, leaderboardId, setLeaderboard, writableBoards]);

  const selectedIds = new Set(selectedPlayers.map((player) => player.id));
  const canAddMore = selectedPlayers.length < MAX_PLAYERS;
  const canContinue = selectedPlayers.length >= MIN_PLAYERS && selectedPlayers.length <= MAX_PLAYERS;

  const handleAddPlayer = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setAddError(null);
    try {
      const player = await addPlayer(name);
      if (canAddMore) togglePlayer(player);
      setNewName("");
    } catch (error) {
      setAddError(error instanceof Error ? error.message : t("players.addFailed"));
    } finally {
      setAdding(false);
    }
  };

  const footerLabel = canContinue
    ? `${t("players.continue")} · ${selectedPlayers.length}`
    : `${t("players.minimum")} ${MIN_PLAYERS} ${t("home.players")}`;

  return (
    <ScreenContainer
      footer={
        <Button
          label={footerLabel}
          trailing={canContinue ? "→" : undefined}
          variant="secondary"
          onPress={() => router.push("/setup/dealer")}
          disabled={!canContinue}
        />
      }
    >
      <ScreenIntro
        title={t("players.who")}
        description={t("players.description")}
      />

      {account && writableBoards.length > 0 && (
        <Card style={styles.boardCard}>
          <Text style={styles.boardTitle}>CLASSIFICA DELLA PARTITA</Text>
          <LeaderboardSelector
            leaderboards={writableBoards}
            selectedIds={leaderboardId ? [leaderboardId] : []}
            onChange={(ids) => {
              const board = writableBoards.find((item) => item.id === ids[0]);
              if (board) setLeaderboard(board.id, board.name);
            }}
          />
          <Text style={styles.verifiedBody}>Vedrai e userai soltanto i giocatori di questa classifica.</Text>
        </Card>
      )}

      {account && writableBoards.length === 0 && (
        <Card style={styles.boardCard}>
          <Text style={styles.boardTitle}>NESSUNA CLASSIFICA DISPONIBILE</Text>
          <Text style={styles.verifiedBody}>Crea una classifica o entra con un invito prima di iniziare una partita.</Text>
          <Button label="Gestisci classifiche" variant="secondary" onPress={() => router.push("/leaderboard/manage")} />
        </Card>
      )}

      <Card style={styles.verifiedCard}>
        <View style={styles.verifiedHeader}>
          <View style={[styles.verifiedDot, account && room && styles.verifiedDotActive]} />
          <Text style={styles.verifiedTitle}>{t("players.verifiedRoom")}</Text>
          {room && (
            <Text style={styles.verifiedCode}>{room.code}</Text>
          )}
        </View>
        <Text style={styles.verifiedBody}>
          {room
            ? `${room.participants.length} ${t("players.verifiedCount")}`
            : account
              ? t("account.tableDescription")
              : t("players.guestNote")}
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: "/account", params: { from: "setup" } })}
          style={({ pressed }) => [styles.verifiedLink, pressed && styles.pressed]}
        >
          <Text style={styles.verifiedLinkText}>
            {account ? t("players.openRoom") : t("players.verifyIdentity")}
          </Text>
          <Text style={styles.manageArrow}>›</Text>
        </Pressable>
      </Card>

      {(!account || selectedBoard?.canManage) && <View style={styles.addRow}>
        <TextInput
          value={newName}
          onChangeText={(value) => {
            setNewName(value);
            setAddError(null);
          }}
          placeholder={t("players.addPlaceholder")}
          placeholderTextColor={colors.textMuted as string}
          style={styles.input}
          onSubmitEditing={handleAddPlayer}
          returnKeyType="done"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("players.addAccessibility")}
          disabled={!newName.trim() || adding}
          onPress={handleAddPlayer}
          style={({ pressed }) => [styles.addButton, (!newName.trim() || adding) && styles.disabled, pressed && styles.pressed]}
        >
          <Text allowFontScaling={false} pointerEvents="none" style={styles.addButtonText}>{adding ? "…" : "+"}</Text>
        </Pressable>
      </View>}
      {!!addError && <Text style={styles.addError}>{addError}</Text>}

      <View style={styles.list}>
        {loading && <Text style={styles.helper}>{t("players.loading")}</Text>}
        {!loading && players.length === 0 && (
          <Text style={styles.empty}>{t("players.empty")}</Text>
        )}
        {players.map((player) => {
          const selected = selectedIds.has(player.id);
          const order = selectedPlayers.findIndex((entry) => entry.id === player.id);
          const disabled = !selected && !canAddMore;
          return (
            <Pressable
              key={player.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              onPress={() => !disabled && togglePlayer(player)}
              style={({ pressed }) => [
                styles.playerRow,
                selected && styles.playerRowSelected,
                disabled && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <PlayerAvatar name={player.name} photoUri={player.photoUri} colorKey={player.id} size={38} />
              <View style={styles.playerInfo}>
                <Text maxFontSizeMultiplier={1.15} style={styles.playerName}>{player.name}</Text>
                <Text maxFontSizeMultiplier={1.15} style={styles.playerMeta}>
                  {selected ? `${t("players.position")} ${order + 1}` : t("players.tapSelect")}
                </Text>
              </View>
              <View style={[styles.check, selected && styles.checkSelected]}>
                <Text pointerEvents="none" style={[styles.checkText, selected && styles.checkTextSelected]}>
                  {selected ? "✓" : ""}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {(!account || selectedBoard?.canManage) && <Pressable
        onPress={() => router.push({ pathname: "/roster", params: { from: "setup", leaderboardId: leaderboardId ?? undefined } })}
        style={styles.manageLink}
      >
        <Text style={styles.manageText}>{t("players.manage")}</Text>
        <Text style={styles.manageArrow}>›</Text>
      </Pressable>}
    </ScreenContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    verifiedCard: { gap: 8 },
    boardCard: { gap: 10 },
    boardTitle: { color: colors.textMuted, fontFamily: theme.font.family.extraBold, fontSize: 10, letterSpacing: 1.1 },
    verifiedHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    verifiedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.textFaint },
    verifiedDotActive: { backgroundColor: colors.success },
    verifiedTitle: {
      flex: 1,
      color: colors.text,
      fontFamily: theme.font.family.extraBold,
      fontSize: 10,
      letterSpacing: 1,
    },
    verifiedCode: {
      color: colors.success,
      fontFamily: theme.font.family.extraBold,
      fontSize: 13,
      letterSpacing: 2,
    },
    verifiedBody: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11, lineHeight: 17 },
    verifiedLink: { minHeight: 38, flexDirection: "row", alignItems: "center" },
    verifiedLinkText: { flex: 1, color: colors.success, fontFamily: theme.font.family.bold, fontSize: 11 },
    addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    input: {
      flex: 1,
      height: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: theme.font.family.semibold,
      fontSize: 14,
    },
    addButton: {
      width: 52,
      height: 52,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.text,
    },
    addButtonText: { color: colors.background, fontFamily: theme.font.family.regular, fontSize: 28 },
    addError: {
      marginTop: -4,
      padding: 11,
      borderRadius: 10,
      color: colors.danger,
      backgroundColor: colors.negativeSoft,
      fontFamily: theme.font.family.bold,
      fontSize: 11.5,
      lineHeight: 17,
    },
    list: { gap: 9 },
    playerRow: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    playerRowSelected: { borderColor: colors.success },
    playerInfo: { flex: 1, minWidth: 0 },
    playerName: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 14.5 },
    playerMeta: { marginTop: 2, color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11 },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inkSoft,
    },
    checkSelected: { backgroundColor: colors.success },
    checkText: { color: colors.textMuted, fontFamily: theme.font.family.extraBold, fontSize: 13 },
    checkTextSelected: { color: colors.primaryText },
    helper: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12 },
    empty: {
      padding: 16,
      borderRadius: 13,
      color: colors.textMuted,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      fontFamily: theme.font.family.medium,
      fontSize: 12,
      lineHeight: 18,
    },
    manageLink: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
    manageText: { flex: 1, color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 12 },
    manageArrow: { color: colors.text, fontSize: 22 },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.72 },
  });
}
