import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Card } from "./Card";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

function useOfflineState() {
  const enabled = !!document.querySelector('script[src="/offline-register.js"]');
  const supported = "serviceWorker" in navigator && window.isSecureContext;
  const [online, setOnline] = useState(navigator.onLine && document.documentElement.dataset.taotlOnline !== "false");
  const [status, setStatus] = useState(document.documentElement.dataset.taotlOfflineState ?? "preparing");
  useEffect(() => {
    if (!enabled || !supported) return;
    let active = true;
    const connection = () => setOnline(navigator.onLine && document.documentElement.dataset.taotlOnline !== "false");
    const changed = (event: Event) => setStatus((event as CustomEvent<string>).detail);
    const ready = () => setStatus("ready");
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("taotl:network-state", connection);
    window.addEventListener("taotl:offline-state", changed);
    navigator.serviceWorker.addEventListener("controllerchange", ready);
    void navigator.serviceWorker.getRegistration().then(registration => {
      if (active && registration?.active) ready();
    }).catch(() => {});
    return () => {
      active = false;
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("taotl:network-state", connection);
      window.removeEventListener("taotl:offline-state", changed);
      navigator.serviceWorker.removeEventListener("controllerchange", ready);
    };
  }, [enabled, supported]);
  return { enabled, supported, online, status };
}

export function OfflineBanner() {
  const { enabled, online } = useOfflineState();
  const { colors, resolvedLanguage } = useAppSettings();
  if (!enabled || online) return null;
  return (
    <View style={{ backgroundColor: colors.surfaceSolid, paddingVertical: 8, paddingHorizontal: 18 }}>
      <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={{ color: colors.text, fontFamily: theme.font.family.medium, fontSize: 12, textAlign: "center" }}>
        {resolvedLanguage === "en" ? "Offline · using data saved on this device" : "Offline · stai usando i dati salvati su questo dispositivo"}
      </Text>
    </View>
  );
}

export function OfflineSettings() {
  const { enabled, supported, status } = useOfflineState();
  const { colors, resolvedLanguage } = useAppSettings();
  if (!enabled) return null;
  const en = resolvedLanguage === "en";
  const message = !supported ? (en ? "Offline use is not supported in this browser." : "Uso offline non disponibile in questo browser.")
    : status === "ready" ? (en ? "Ready to use offline on this device" : "Disponibile offline su questo dispositivo")
      : status === "error" ? (en ? "Offline setup incomplete. Reload when connected." : "Preparazione offline incompleta. Ricarica con una connessione attiva.")
        : (en ? "Preparing for offline use…" : "Preparazione per l’uso offline…");
  return (
    <Card>
      <Text style={{ color: colors.text, fontFamily: theme.font.family.bold, fontSize: 14 }}>{en ? "Offline use" : "Uso offline"}</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontFamily: theme.font.family.medium, fontSize: 13 }}>{message}</Text>
      <Text style={{ color: colors.textMuted, fontFamily: theme.font.family.regular, fontSize: 12 }}>
        {en ? "Games, players and previously viewed history remain available. Signing in and updating shared data requires a connection."
          : "Partite, giocatori e storico già consultato restano disponibili. Per accedere e aggiornare i dati condivisi serve una connessione."}
      </Text>
    </Card>
  );
}
