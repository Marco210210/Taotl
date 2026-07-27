import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { players, loading, addPlayer, renamePlayer, setPlayerPhoto, removePlayer } = useRoster();
  const existing = id ? players.find((p) => p.id === id) : undefined;

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<string | undefined>();
  const [loadedPlayerId, setLoadedPlayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (existing && loadedPlayerId !== existing.id) {
      setName(existing.name);
      setPhotoUri(existing.photoUri ?? null);
      setLoadedPlayerId(existing.id);
    }
  }, [existing, loadedPlayerId]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("player.permissionTitle"),
        t("player.permissionBody"),
      );
      return;
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
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      let playerId: string;
      if (existing) {
        playerId = existing.id;
        if (trimmed !== existing.name) {
          await renamePlayer(playerId, trimmed);
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
      router.dismissTo("/roster");
    } catch (error) {
      Alert.alert(
        t("player.saveFailed"),
        error instanceof Error ? error.message : t("history.retry"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing || !token) return;
    Alert.alert(
      t("player.deleteTitle"),
      `${existing.name} ${t("player.deleteBody")}`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await removePlayer(existing.id, token);
              router.dismissTo("/roster");
            } catch (error) {
              Alert.alert(
                t("player.deleteFailed"),
                error instanceof Error ? error.message : t("history.retry"),
              );
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (id && loading && !existing) {
    return (
      <ScreenContainer style={styles.loading}>
        <ActivityIndicator color={colors.primary as string} size="large" />
        <Text style={styles.avatarHint}>{t("player.loading")}</Text>
      </ScreenContainer>
    );
  }

  if (id && !loading && !existing) {
    return (
      <ScreenContainer style={styles.content}>
        <Text style={styles.error}>{t("player.missing")}</Text>
        <Button label={t("player.backRoster")} onPress={() => router.dismissTo("/roster")} variant="secondary" />
      </ScreenContainer>
    );
  }

  return (
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
          placeholder={t("player.namePlaceholder")}
          placeholderTextColor={colors.textMuted as string}
          style={styles.input}
        />
      </View>

      <Button label={t("common.save")} onPress={handleSave} loading={saving} disabled={!name.trim()} />
      {existing && account?.isAdmin && (
        <Button
          label={t("player.deleteProfile")}
          onPress={handleDelete}
          variant="danger"
          loading={deleting}
          disabled={saving}
        />
      )}
    </ScreenContainer>
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
  });
}
