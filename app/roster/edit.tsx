import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useRoster } from "@/state/useRoster";
import { theme } from "@/theme";

export default function EditPlayerScreen() {
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
        "Permesso necessario",
        "Per scegliere una foto, consenti a Taotl di accedere alla libreria immagini.",
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
          throw new Error("Il profilo richiesto non è stato trovato.");
        }
        const created = await addPlayer(trimmed);
        playerId = created.id;
      }
      if (photoUri && photoUri !== existing?.photoUri) {
        await setPlayerPhoto(playerId, photoUri, photoType);
      }
      router.back();
    } catch (error) {
      Alert.alert(
        "Salvataggio non riuscito",
        error instanceof Error ? error.message : "Controlla la connessione e riprova.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      "Eliminare il profilo?",
      `${existing.name} sparirà dalla rubrica. Le partite già giocate resteranno nello storico.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await removePlayer(existing.id);
              router.back();
            } catch (error) {
              Alert.alert(
                "Eliminazione non riuscita",
                error instanceof Error ? error.message : "Controlla la connessione e riprova.",
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
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={styles.avatarHint}>Caricamento profilo…</Text>
      </ScreenContainer>
    );
  }

  if (id && !loading && !existing) {
    return (
      <ScreenContainer style={styles.content}>
        <Text style={styles.error}>Questo profilo non esiste più o non è raggiungibile.</Text>
        <Button label="Torna alla rubrica" onPress={() => router.back()} variant="secondary" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.content}>
      <Pressable onPress={pickImage} style={styles.avatarWrapper}>
        <PlayerAvatar name={name || "?"} photoUri={photoUri} size={96} />
        <Text style={styles.avatarHint}>Tocca per {photoUri ? "cambiare" : "aggiungere"} la foto</Text>
      </Pressable>

      <View>
        <Text style={styles.label}>Nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nome giocatore"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />
      </View>

      <Button label="Salva" onPress={handleSave} loading={saving} disabled={!name.trim()} />
      {existing && (
        <Button
          label="Elimina profilo"
          onPress={handleDelete}
          variant="danger"
          loading={deleting}
          disabled={saving}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "stretch" },
  loading: { alignItems: "center", justifyContent: "center" },
  avatarWrapper: { alignItems: "center", gap: theme.spacing(1) },
  avatarHint: { color: theme.colors.textMuted, fontSize: theme.font.small },
  error: { color: theme.colors.danger, fontSize: theme.font.body, textAlign: "center" },
  label: { color: theme.colors.textMuted, fontSize: theme.font.small, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: theme.font.body,
  },
});
