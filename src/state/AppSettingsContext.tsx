import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { Alert, Platform, useColorScheme } from "react-native";

import { translations, type AppLanguage, type TranslationKey } from "@/i18n/translations";
import { theme } from "@/theme";
import { writeStoredThemePreference } from "@/themePreference";

import { STORAGE_KEYS } from "./storageKeys";

export type ThemePreference = "system" | "light" | "dark";
export type LanguagePreference = "system" | AppLanguage;

interface StoredSettings {
  theme: ThemePreference;
  language: LanguagePreference;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
}

interface AppSettingsContextValue extends StoredSettings {
  hydrated: boolean;
  resolvedTheme: "light" | "dark";
  resolvedLanguage: AppLanguage;
  locale: "it-IT" | "en-US";
  setTheme: (value: ThemePreference) => void;
  setLanguage: (value: LanguagePreference) => void;
  setVibrationEnabled: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  t: (key: TranslationKey) => string;
}

const DEFAULT_SETTINGS: StoredSettings = {
  theme: "system",
  language: "system",
  vibrationEnabled: true,
  notificationsEnabled: true,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function deviceLanguage(): AppLanguage {
  return getLocales()[0]?.languageCode === "en" ? "en" : "it";
}

export function AppSettingsProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.appSettings)
      .then((raw) => {
        if (!raw) return;
        const stored = JSON.parse(raw) as Partial<StoredSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const resolvedLanguage = settings.language === "system" ? deviceLanguage() : settings.language;

  // I colori del tema (src/theme.ts) vengono decisi una sola volta all'avvio
  // dell'app, non ad ogni render: per applicarli serve ricaricare il bundle
  // JS. Lo facciamo qui in automatico ogni volta che il tema che DOVREBBE
  // essere attivo (needsDark) non corrisponde a quello con cui l'app è
  // effettivamente partita (theme.isDark) — sia perché l'utente ha appena
  // cambiato l'impostazione, sia perché all'avvio a freddo il telefono era in
  // un tema di sistema diverso da una preferenza esplicita già salvata. La
  // preferenza va scritta su SecureStore PRIMA del reload (in modo sincrono)
  // così src/theme.ts la trova subito al riavvio del bundle. Updates.isEnabled
  // è false dentro Expo Go: lì reloadAsync() rifiuta SEMPRE la promise (Expo
  // Go non supporta il reload "in place"), quindi in quel caso ci limitiamo
  // ad avvisare che serve chiudere e riaprire l'app — la scelta è comunque
  // già salvata e verrà applicata al prossimo avvio.
  const appliedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    writeStoredThemePreference(settings.theme);
    const needsDark = settings.theme === "system" ? systemScheme === "dark" : settings.theme === "dark";
    if (appliedRef.current === needsDark) return;
    appliedRef.current = needsDark;
    if (needsDark === theme.isDark) return;
    if (Platform.OS === "web") return;
    if (!Updates.isEnabled) {
      Alert.alert(
        translations[resolvedLanguage]["settings.themeRestartTitle"],
        translations[resolvedLanguage]["settings.themeRestartBody"],
      );
      return;
    }
    Updates.reloadAsync().catch(() => {});
  }, [hydrated, settings.theme, systemScheme, resolvedLanguage]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.appSettings, JSON.stringify(settings)).catch(() => {});
  }, [hydrated, settings]);

  const update = useCallback(<K extends keyof StoredSettings>(key: K, value: StoredSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const resolvedTheme = settings.theme === "system"
    ? (systemScheme === "dark" ? "dark" : "light")
    : settings.theme;

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      ...settings,
      hydrated,
      resolvedLanguage,
      resolvedTheme,
      locale: resolvedLanguage === "en" ? "en-US" : "it-IT",
      setTheme: (next) => update("theme", next),
      setLanguage: (next) => update("language", next),
      setVibrationEnabled: (next) => update("vibrationEnabled", next),
      setNotificationsEnabled: (next) => update("notificationsEnabled", next),
      t: (key) => translations[resolvedLanguage][key],
    }),
    [hydrated, resolvedLanguage, resolvedTheme, settings, update],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error("useAppSettings must be used inside AppSettingsProvider.");
  return context;
}
