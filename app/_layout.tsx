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
import { Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GameProvider } from "@/state/GameContext";
import { SetupProvider } from "@/state/SetupContext";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { installGlobalErrorReporting } from "@/monitoring/errorReporter";
import { AccountProvider } from "@/state/AccountContext";
import { AppSettingsProvider, useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

void SplashScreen.preventAutoHideAsync();
installGlobalErrorReporting();

// I layout sono tarati sul font di sistema di default: con l'accessibilità
// del telefono impostata su testo molto grande, righe e bottoni si
// sovrappongono. Un tetto al fattore di scala evita la rottura del layout
// pur lasciando un margine di ingrandimento reale.
(Text as unknown as { defaultProps?: Record<string, unknown> }).defaultProps = {
  ...(Text as unknown as { defaultProps?: Record<string, unknown> }).defaultProps,
  maxFontSizeMultiplier: 1.15,
};
(TextInput as unknown as { defaultProps?: Record<string, unknown> }).defaultProps = {
  ...(TextInput as unknown as { defaultProps?: Record<string, unknown> }).defaultProps,
  maxFontSizeMultiplier: 1.15,
};

// L'error boundary è il componente più esterno apposta: un errore durante il
// caricamento dei font (prima ancora che l'app abbia qualcosa da mostrare)
// non verrebbe intercettato se l'error boundary fosse più in profondità.
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <FontGate />
    </ErrorBoundary>
  );
}

function FontGate() {
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
    <AppSettingsProvider>
      <AppNavigation />
    </AppSettingsProvider>
  );
}

function AppNavigation() {
  const { resolvedTheme, t, colors } = useAppSettings();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background as string }}>
      <SafeAreaProvider style={{ backgroundColor: colors.background as string }}>
        <AccountProvider>
          <GameProvider>
            <SetupProvider>
            <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
            <Stack
              screenOptions={{
                // Nel tema scuro `surface` è volutamente semitrasparente. Un
                // header nativo semitrasparente viene composto sul bianco di
                // sistema e crea la fascia chiara visibile su iOS. Per la barra
                // di navigazione serve invece uno sfondo sempre opaco.
                headerStyle: { backgroundColor: colors.background as string },
                headerTintColor: colors.text as string,
                headerTitleStyle: { fontFamily: theme.font.family.bold, fontSize: 15 },
                headerShadowVisible: false,
                headerBackTitle: t("common.back"),
                contentStyle: { backgroundColor: colors.background as string },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen
                name="setup/players"
                options={{
                  title: t("nav.players"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/" />,
                }}
              />
              <Stack.Screen
                name="setup/mode"
                options={{
                  title: t("nav.mode"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/setup/dealer" />,
                }}
              />
              <Stack.Screen
                name="setup/dealer"
                options={{
                  title: t("nav.dealer"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/setup/players" />,
                }}
              />
              <Stack.Screen name="game/bids" options={{ title: t("nav.bids"), headerBackVisible: false }} />
              <Stack.Screen
                name="game/dealer"
                options={{
                  title: t("nav.fixDealer"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/game/bids" />,
                }}
              />
              <Stack.Screen name="game/scoring" options={{ title: t("nav.scoring"), headerBackVisible: false }} />
              <Stack.Screen
                name="game/standings"
                options={{
                  title: t("nav.standings"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/game/bids" />,
                }}
              />
              <Stack.Screen name="game/end" options={{ headerShown: false }} />
              <Stack.Screen
                name="roster/index"
                options={{
                  title: t("nav.roster"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/" />,
                }}
              />
              <Stack.Screen
                name="roster/edit"
                options={{
                  title: t("nav.player"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/roster" />,
                }}
              />
              <Stack.Screen
                name="profile/index"
                options={{
                  title: t("nav.profile"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/" />,
                }}
              />
              <Stack.Screen
                name="leaderboard/index"
                options={{
                  title: t("nav.leaderboard"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/" />,
                }}
              />
              <Stack.Screen
                name="leaderboard/add-game"
                options={{
                  title: t("nav.leaderboard"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/leaderboard" />,
                }}
              />
              <Stack.Screen
                name="leaderboard/link-account"
                options={{
                  title: t("nav.leaderboard"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/leaderboard" />,
                }}
              />
              <Stack.Screen
                name="leaderboard/player/[id]"
                options={{
                  title: t("nav.profile"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/leaderboard" />,
                }}
              />
              <Stack.Screen
                name="history/index"
                options={{
                  title: t("nav.history"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/" />,
                }}
              />
              <Stack.Screen
                name="history/[id]"
                options={{
                  title: t("nav.gameDetail"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/history" />,
                }}
              />
              <Stack.Screen
                name="rules/index"
                options={{
                  title: t("nav.rules"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/" />,
                }}
              />
              <Stack.Screen
                name="settings/index"
                options={{
                  title: t("nav.settings"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/" />,
                }}
              />
              <Stack.Screen
                name="account/index"
                options={{
                  title: t("nav.account"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="account/forgot-password"
                options={{
                  title: t("forgotPassword.title"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/account" />,
                }}
              />
              <Stack.Screen
                name="account/reset-password"
                options={{
                  title: t("resetPassword.title"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/account/forgot-password" />,
                }}
              />
              <Stack.Screen
                name="admin/index"
                options={{
                  title: t("nav.admin"),
                  headerBackVisible: false,
                  gestureEnabled: false,
                  headerLeft: () => <LinearBackButton destination="/" />,
                }}
              />
            </Stack>
            </SetupProvider>
          </GameProvider>
        </AccountProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
