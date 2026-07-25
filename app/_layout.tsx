import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts as useManropeFonts,
} from "@expo-google-fonts/manrope";
import {
  InstrumentSerif_400Regular,
  useFonts as useInstrumentSerifFonts,
} from "@expo-google-fonts/instrument-serif";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GameProvider } from "@/state/GameContext";
import { SetupProvider } from "@/state/SetupContext";
import { theme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [manropeLoaded, manropeError] = useManropeFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [serifLoaded, serifError] = useInstrumentSerifFonts({ InstrumentSerif_400Regular });
  const ready = (manropeLoaded && serifLoaded) || !!manropeError || !!serifError;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GameProvider>
          <SetupProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: theme.colors.surface },
                headerTintColor: theme.colors.text,
                headerTitleStyle: { fontFamily: theme.font.family.bold, fontSize: 15 },
                headerShadowVisible: false,
                headerBackTitle: "Indietro",
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="setup/players" options={{ title: "Giocatori" }} />
              <Stack.Screen name="setup/mode" options={{ title: "Modalità" }} />
              <Stack.Screen name="setup/dealer" options={{ title: "Mazziere" }} />
              <Stack.Screen name="game/bids" options={{ title: "Chiamate", headerBackVisible: false }} />
              <Stack.Screen name="game/dealer" options={{ title: "Correggi primo mazziere" }} />
              <Stack.Screen name="game/scoring" options={{ title: "Punteggio turno", headerBackVisible: false }} />
              <Stack.Screen name="game/standings" options={{ title: "Classifica" }} />
              <Stack.Screen name="game/end" options={{ headerShown: false }} />
              <Stack.Screen name="roster/index" options={{ title: "Rubrica giocatori" }} />
              <Stack.Screen name="roster/edit" options={{ title: "Giocatore" }} />
              <Stack.Screen name="profile/index" options={{ title: "Il mio profilo" }} />
              <Stack.Screen name="history/index" options={{ title: "Storico partite" }} />
              <Stack.Screen name="history/[id]" options={{ title: "Dettaglio partita" }} />
              <Stack.Screen name="rules/index" options={{ title: "Regole e punteggi" }} />
              <Stack.Screen name="settings/index" options={{ title: "Impostazioni" }} />
            </Stack>
          </SetupProvider>
        </GameProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
