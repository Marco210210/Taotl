import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GameProvider } from "@/state/GameContext";
import { SetupProvider } from "@/state/SetupContext";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GameProvider>
          <SetupProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: theme.colors.surface },
                headerTintColor: theme.colors.text,
                headerTitleStyle: { fontWeight: "700" },
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="index" options={{ title: "Taotl" }} />
              <Stack.Screen name="setup/players" options={{ title: "Giocatori" }} />
              <Stack.Screen name="setup/mode" options={{ title: "Modalità" }} />
              <Stack.Screen name="setup/dealer" options={{ title: "Mazziere" }} />
              <Stack.Screen name="game/bids" options={{ title: "Chiamate", headerBackVisible: false }} />
              <Stack.Screen name="game/scoring" options={{ title: "Punteggio turno", headerBackVisible: false }} />
              <Stack.Screen name="game/standings" options={{ title: "Classifica" }} />
              <Stack.Screen name="game/end" options={{ title: "Fine partita", headerBackVisible: false }} />
              <Stack.Screen name="roster/index" options={{ title: "Rubrica giocatori" }} />
              <Stack.Screen name="roster/edit" options={{ title: "Giocatore" }} />
              <Stack.Screen name="history/index" options={{ title: "Storico partite" }} />
            </Stack>
          </SetupProvider>
        </GameProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
