import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
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
  return <ErrorBoundary><FontGate><GestureHandlerRootView style={{ flex: 1 }}>
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
    <Stack screenOptions={{ title: "Taotl · Amministrazione", headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }}>
      <Stack.Screen name="account" />
      <Stack.Protected guard={Boolean(token && verifiedToken === token)}>
        <Stack.Screen name="admin" />
        <Stack.Screen name="game" />
        <Stack.Screen name="history" />
        <Stack.Screen name="index" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="roster" />
        <Stack.Screen name="rules" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="setup" />
      </Stack.Protected>
    </Stack>
    {denied && <View style={{ padding: 16, backgroundColor: colors.background }}>
      <Text style={{ color: colors.text }}>Accesso amministratore non verificato. Accedi con un account autorizzato.</Text>
      <Button label="Esci" onPress={() => void logout()} />
    </View>}
  </>;
}
