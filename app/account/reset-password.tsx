import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

export default function ResetPasswordScreen() {
  const { t } = useAppSettings();
  const { confirmReset } = useAccount();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isPasswordValid = (value: string) =>
    value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);

  const submit = async () => {
    setMessage(null);
    if (!isPasswordValid(password)) {
      setMessage(t("account.invalidPassword"));
      return;
    }
    setLoading(true);
    try {
      await confirmReset(code.trim(), password);
      router.replace("/profile");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination="/account/forgot-password" /> }} />
      <ScreenContainer>
        <ScreenIntro title={t("resetPassword.title")} description={t("resetPassword.description")} />
        <Card>
          <Text style={styles.label}>{t("resetPassword.code")}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            placeholder={t("resetPassword.codePlaceholder")}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>{t("resetPassword.newPassword")}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder={t("account.passwordPlaceholder")}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.hint}>{t("account.passwordHint")}</Text>
          {!!message && <Text style={styles.error}>{message}</Text>}
          <Button
            label={t("resetPassword.submit")}
            onPress={submit}
            loading={loading}
            disabled={!code.trim() || !password}
            variant="secondary"
          />
        </Card>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 12, marginTop: 4 },
  input: {
    minHeight: 50,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    paddingHorizontal: 14,
    fontFamily: theme.font.family.semibold,
    fontSize: 15,
  },
  hint: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10.5, lineHeight: 16 },
  error: { color: theme.colors.danger, fontFamily: theme.font.family.semibold, fontSize: 12, lineHeight: 17 },
});
