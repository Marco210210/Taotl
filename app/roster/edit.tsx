import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useRoster } from "@/state/useRoster";
import { theme } from "@/theme";

export default function EditPlayerScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { players, addPlayer, renamePlayer, setPlayerPhoto } = useRoster();
  const existing = id ? players.find((p) => p.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(existing?.photoUri ?? null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
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
        const created = await addPlayer(trimmed);
        playerId = created.id;
      }
      if (photoUri && photoUri !== existing?.photoUri) {
        await setPlayerPhoto(playerId, photoUri);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "stretch" },
  avatarWrapper: { alignItems: "center", gap: theme.spacing(1) },
  avatarHint: { color: theme.colors.textMuted, fontSize: theme.font.small },
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
