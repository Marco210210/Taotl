import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import {
  useAppSettings,
  type LanguagePreference,
  type ThemePreference,
} from "@/state/AppSettingsContext";
import { theme } from "@/theme";

export default function SettingsScreen() {
  const {
    theme: themePreference,
    language,
    vibrationEnabled,
    notificationsEnabled,
    setTheme,
    setLanguage,
    setVibrationEnabled,
    setNotificationsEnabled,
    t,
  } = useAppSettings();

  return (
    <ScreenContainer>
      <Text style={styles.intro}>{t("settings.intro")}</Text>

      <Text style={styles.sectionLabel}>{t("settings.appearance")}</Text>
      <Card>
        <SettingTitle
          title={t("settings.theme")}
          description={t("settings.themeDescription")}
        />
        <SegmentedPicker<ThemePreference>
          value={themePreference}
          onChange={setTheme}
          options={[
            { value: "system", label: t("settings.themeSystem") },
            { value: "light", label: t("settings.themeLight") },
            { value: "dark", label: t("settings.themeDark") },
          ]}
        />

        <View style={styles.divider} />

        <SettingTitle
          title={t("settings.language")}
          description={t("settings.languageDescription")}
        />
        <SegmentedPicker<LanguagePreference>
          value={language}
          onChange={setLanguage}
          options={[
            { value: "system", label: t("settings.languageSystem") },
            { value: "it", label: t("settings.languageItalian") },
            { value: "en", label: t("settings.languageEnglish") },
          ]}
        />
      </Card>

      <Text style={styles.sectionLabel}>{t("settings.feedback")}</Text>
      <Card>
        <ToggleRow
          title={t("settings.vibration")}
          description={t("settings.vibrationDescription")}
          value={vibrationEnabled}
          onChange={setVibrationEnabled}
        />
        <View style={styles.divider} />
        <ToggleRow
          title={t("settings.notifications")}
          description={t("settings.notificationsDescription")}
          value={notificationsEnabled}
          onChange={setNotificationsEnabled}
        />
      </Card>

      <Text style={styles.note}>{t("settings.accountNote")}</Text>
    </ScreenContainer>
  );
}

function SettingTitle({ title, description }: { title: string; description: string }) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.borderStrong as string, true: theme.colors.success as string }}
        thumbColor={theme.colors.surface as string}
      />
    </View>
  );
}

function SegmentedPicker<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.medium,
    fontSize: 12.5,
    lineHeight: 19,
  },
  sectionLabel: {
    marginBottom: -8,
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: 9.5,
    letterSpacing: 1.3,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font.family.bold,
    fontSize: 14,
  },
  description: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.medium,
    fontSize: 10.5,
    lineHeight: 15,
  },
  divider: {
    height: 1,
    marginVertical: 4,
    backgroundColor: theme.colors.border,
  },
  segmented: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 11,
    backgroundColor: theme.colors.inkSoft,
  },
  segment: {
    minHeight: 38,
    flex: 1,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentSelected: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: 10.5,
    textAlign: "center",
  },
  segmentTextSelected: {
    color: theme.colors.text,
    fontFamily: theme.font.family.extraBold,
  },
  toggleRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  note: {
    paddingHorizontal: 8,
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.medium,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: "center",
  },
  pressed: { opacity: 0.7 },
});
