import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/Button";
import { LinearBackButton } from "@/components/LinearBackButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { useRoster } from "@/state/useRoster";
import { theme, type ThemeColors } from "@/theme";


export default function EditPlayerScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { account, token } = useAccount();
  const { id, from, leaderboardId, leaderboardName } = useLocalSearchParams<{ id?: string; from?: string; leaderboardId?: string; leaderboardName?: string }>();
  const rosterDestination: Href =
    from === "manage" && leaderboardId
      ? { pathname: "/leaderboard/manage", params: { leaderboardId, ...(leaderboardName ? { name: leaderboardName } : {}) } }
      : from === "admin"
      ? { pathname: "/roster", params: { from: "admin", ...(leaderboardId ? { leaderboardId } : {}) } }
      : from === "setup"
        ? { pathname: "/roster", params: { from: "setup", ...(leaderboardId ? { leaderboardId } : {}) } }
        : "/roster";
  const { players, loading, addPlayer, renamePlayer, setPlayerPhoto } = useRoster(leaderboardId);
  const existing = id ? players.find((p) => p.id === id) : undefined;

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<string | undefined>();
  const [loadedPlayerId, setLoadedPlayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing && loadedPlayerId !== existing.id) {
      setName(existing.name);
      setPhotoUri(existing.photoUri ?? null);
      setLoadedPlayerId(existing.id);
    }
  }, [existing, loadedPlayerId]);

  const isLinked = existing?.linkedAccount === true;
  const canEdit = !token || existing?.canEdit === true;
  const canCreate = !token || account?.isAdmin || account?.leaderboards.some((board) => board.id === leaderboardId && board.canManage);
  const isNameLocked = !!existing && !canEdit;
  const [renameStep, setRenameStep] = useState<0 | 1 | 2>(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      // Il browser deve aprire il selettore nello stesso gesto dell'utente.
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t("player.permissionTitle"), t("player.permissionBody"));
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setPhotoType(result.assets[0].mimeType ?? "image/jpeg");
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("player.saveFailed"));
    }
  };

  const handleSave = async (confirmed = false) => {
    const trimmed = name.trim();
    if (!trimmed || saving || (existing ? !canEdit : !canCreate)) return;
    if (existing && isLinked && trimmed !== existing.name && !confirmed) {
      setRenameStep(1); return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      let playerId: string;
      if (existing) {
        playerId = existing.id;
        if (!isNameLocked && trimmed !== existing.name) {
          await renamePlayer(playerId, trimmed, isLinked ? { confirmLinkedRename: true, expectedName: existing.name } : undefined);
        }
      } else {
        if (id) {
          throw new Error(t("player.notFound"));
        }
        const created = await addPlayer(trimmed);
        playerId = created.id;
      }
      if (photoUri && photoUri !== existing?.photoUri) {
        await setPlayerPhoto(playerId, photoUri, photoType);
      }
      router.dismissTo(rosterDestination);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("player.saveFailed"));
      Alert.alert(
        t("player.saveFailed"),
        error instanceof Error ? error.message : t("history.retry"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!loading && (existing ? !canEdit : !id && !canCreate)) {
    return <ScreenContainer><Text>Solo il gestore della classifica o l’amministratore globale può modificare nome e foto.</Text><Button label="Indietro" onPress={() => router.dismissTo(rosterDestination)} /></ScreenContainer>;
  }

  if (id && loading && !existing) {
    return (
      <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={rosterDestination} /> }} />
      <ScreenContainer style={styles.loading}>
        <ActivityIndicator color={colors.primary as string} size="large" />
        <Text style={styles.avatarHint}>{t("player.loading")}</Text>
      </ScreenContainer>
      </>
    );
  }

  if (id && !loading && !existing) {
    return (
      <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={rosterDestination} /> }} />
      <ScreenContainer style={styles.content}>
        <Text style={styles.error}>{t("player.missing")}</Text>
        <Button label={t("player.backRoster")} onPress={() => router.dismissTo(rosterDestination)} variant="secondary" />
      </ScreenContainer>
      </>
    );
  }

  return (
    <>
    <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={rosterDestination} /> }} />
    <ConfirmDialog visible={renameStep !== 0}
      title={renameStep === 1 ? "Modificare il nome collegato?" : "Conferma definitiva"}
      description={renameStep === 1 ? `Stai rinominando “${existing?.name ?? ""}” in “${name.trim()}”. Il nuovo nome comparirà anche sull’account e nelle altre classifiche.` : "Confermi di aggiornare sia il giocatore sia il nome visualizzato dell’account? Il Taotl ID di accesso non cambia."}
      confirmLabel={renameStep === 1 ? "Continua" : "Conferma nuovo nome"} cancelLabel="Annulla"
      onCancel={() => setRenameStep(0)} onConfirm={() => {
        if (renameStep === 1) setRenameStep(2);
        else { setRenameStep(0); void handleSave(true); }
      }} />
    <ScreenContainer style={styles.content}>
      <Pressable onPress={pickImage} style={styles.avatarWrapper}>
        <PlayerAvatar name={name || "?"} photoUri={photoUri} size={96} />
        <Text style={styles.avatarHint}>
          {t("player.tapPhoto")} {photoUri ? t("player.change") : t("player.addPhoto")} {t("player.photo")}
        </Text>
      </Pressable>

      <View>
        <Text style={styles.label}>{t("player.name")}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          editable={!isNameLocked}
          placeholder={t("player.namePlaceholder")}
          placeholderTextColor={colors.textMuted as string}
          style={[styles.input, isNameLocked && styles.inputLocked]}
        />
        {isLinked && (
          <Text style={styles.fieldHint}>Il nome è condiviso con l’account collegato e con le altre classifiche. La modifica richiede due conferme.</Text>
        )}
      </View>

      {!!saveError && <Text style={styles.error}>{saveError}</Text>}
      <Button label={t("common.save")} onPress={() => void handleSave()} loading={saving} disabled={!name.trim() || (existing ? !canEdit : !canCreate)} />

    </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { alignItems: "stretch" },
    loading: { alignItems: "center", justifyContent: "center" },
    avatarWrapper: { alignItems: "center", gap: theme.spacing(1) },
    avatarHint: { color: colors.textMuted, fontSize: theme.font.small },
    error: { color: colors.danger, fontSize: theme.font.body, textAlign: "center" },
    label: { color: colors.textMuted, fontSize: theme.font.small, fontWeight: "700", marginBottom: 6 },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: 10,
      color: colors.text,
      fontSize: theme.font.body,
    },
    inputLocked: { color: colors.textMuted, opacity: 0.72 },
    fieldHint: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: 10.5,
      lineHeight: 15,
      fontFamily: theme.font.family.medium,
    },
    fieldError: {
      marginTop: 6,
      color: colors.danger,
      fontSize: 10.5,
      lineHeight: 15,
      fontFamily: theme.font.family.semibold,
    },
  });
}
