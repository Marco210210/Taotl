import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TOTAL_CARDS } from "@/game/constants";
import { theme } from "@/theme";

export default function SettingsScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.intro}>
        Qui trovi le impostazioni che influenzano le regole. Per questa prima versione restano bloccate sui valori
        ufficiali di Taotl, così non si cambia una partita per errore.
      </Text>

      <Card>
        <SettingRow title="Carte nel mazzo" description="Usate per calcolare la modalità Completa">
          <Text style={styles.value}>{TOTAL_CARDS}</Text>
        </SettingRow>
      </Card>

      <Card>
        <SettingRow title="Blocco chiamata vietata" description="Il mazziere non può pareggiare carte e chiamate">
          <StaticToggle />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow title="Punti attesi" description="Mostra subito quanto vale una chiamata rispettata">
          <StaticToggle />
        </SettingRow>
      </Card>

      <View style={styles.future}>
        <Text style={styles.futureTitle}>PROSSIMAMENTE</Text>
        <Text style={styles.futureText}>
          Account, sincronizzazione tra dispositivi, password amministratore e vibrazione degli stepper.
        </Text>
      </View>
    </ScreenContainer>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

function StaticToggle() {
  return (
    <View style={styles.toggle}>
      <View style={styles.knob} />
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12.5, lineHeight: 19 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  info: { flex: 1 },
  title: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 14 },
  description: { marginTop: 2, color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10.5 },
  value: {
    minWidth: 48,
    textAlign: "center",
    color: theme.colors.text,
    fontFamily: theme.font.family.extraBold,
    fontSize: 20,
  },
  divider: { height: 1, backgroundColor: theme.colors.border },
  toggle: {
    width: 50,
    height: 30,
    padding: 3,
    borderRadius: 99,
    alignItems: "flex-end",
    backgroundColor: theme.colors.success,
  },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.surface },
  future: { padding: 15, borderRadius: 13, backgroundColor: theme.colors.inkSoft, gap: 4 },
  futureTitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  futureText: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11.5, lineHeight: 17 },
});
