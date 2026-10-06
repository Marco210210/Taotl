import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FontGate } from "../../app/_layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/Button";
import { fetchMyAccount } from "@/api/auth";
import { AccountProvider, useAccount } from "@/state/AccountContext";
import { GameProvider } from "@/state/GameContext";
import { SetupProvider } from "@/state/SetupContext";
import { useAppSettings } from "@/state/AppSettingsContext";

export default function AdminLayout() {
  return <ErrorBoundary><FontGate languageOverride="it"><GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider><AccountProvider><GameProvider><SetupProvider>
      <AdminNavigation />
    </SetupProvider></GameProvider></AccountProvider></SafeAreaProvider>
  </GestureHandlerRootView></FontGate></ErrorBoundary>;
}

function AdminNavigation() {
  const { token, logout } = useAccount();
  const { colors } = useAppSettings();
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    let active = true;
    setVerifiedToken(null);
    setDenied(false);
    if (!token) return;
    fetchMyAccount(token).then((account) => {
      if (!active) return;
      if (account.isAdmin) setVerifiedToken(token);
      else setDenied(true);
    }).catch(() => { if (active) setDenied(true); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    if (token && verifiedToken === token) router.replace("/admin");
  }, [token, verifiedToken]);
  return <>
    <Stack screenOptions={{ title: "Amministrazione", headerBackTitle: "Indietro", headerBackVisible: false, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text,
      headerTitle: ({ children, tintColor }) => <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image source={require("../public/admin-icon-192.png")} accessibilityLabel="Taotl Admin" style={{ width: 40, height: 40, borderRadius: 8 }} />
        <Text numberOfLines={1} style={{ color: tintColor, fontWeight: "700", fontSize: 16, flexShrink: 1 }}>{children}</Text>
      </View>,
    }}>
      <Stack.Screen name="account/index" options={{ title: "Accesso amministratore" }} />
      <Stack.Screen name="account/forgot-password" options={{ title: "Recupera password" }} />
      <Stack.Screen name="account/reset-password" options={{ title: "Reimposta password" }} />
      <Stack.Protected guard={Boolean(token && verifiedToken === token)}>
        <Stack.Screen name="admin/index" options={{ title: "Pannello amministratore" }} />
        <Stack.Screen name="leaderboard/index" options={{ title: "Classifiche" }} />
        <Stack.Screen name="leaderboard/manage" options={{ title: "Gestione classifica" }} />
        <Stack.Screen name="leaderboard/add-game" options={{ title: "Inserisci partita" }} />
        <Stack.Screen name="leaderboard/link-account" options={{ title: "Collega account e giocatori" }} />
        <Stack.Screen name="leaderboard/player/[id]" options={{ title: "Profilo giocatore" }} />
        <Stack.Screen name="roster/index" options={{ title: "Rubrica giocatori" }} />
        <Stack.Screen name="roster/edit" options={{ title: "Modifica giocatore" }} />
        <Stack.Screen name="history/index" options={{ title: "Storico partite" }} />
        <Stack.Screen name="history/[id]" options={{ title: "Dettaglio partita" }} />
        <Stack.Screen name="profile/index" options={{ title: "Profilo" }} />
        <Stack.Screen name="rules/index" options={{ title: "Regole" }} />
        <Stack.Screen name="settings/index" options={{ title: "Impostazioni" }} />
        <Stack.Screen name="setup/players" options={{ title: "Giocatori" }} />
        <Stack.Screen name="setup/dealer" options={{ title: "Ordine e mazziere" }} />
        <Stack.Screen name="setup/mode" options={{ title: "Modalità" }} />
        <Stack.Screen name="game/bids" options={{ title: "Chiamate" }} />
        <Stack.Screen name="game/dealer" options={{ title: "Mazziere" }} />
        <Stack.Screen name="game/scoring" options={{ title: "Punteggi" }} />
        <Stack.Screen name="game/standings" options={{ title: "Classifica partita" }} />
        <Stack.Screen name="game/end" options={{ title: "Fine partita" }} />
        <Stack.Screen name="index" options={{ title: "Amministrazione", headerShown: false }} />
      </Stack.Protected>
    </Stack>
    {denied && <View style={{ padding: 16, backgroundColor: colors.background }}>
      <Text style={{ color: colors.text }}>Accesso amministratore non verificato. Accedi con un account autorizzato.</Text>
      <Button label="Esci" onPress={() => void logout()} />
    </View>}
  </>;
}
