import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

export default function ForgotPasswordScreen() {
  const { t } = useAppSettings();
  const { requestReset } = useAccount();
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await requestReset(handle.trim().toLowerCase().replace(/^@/, ""), email.trim());
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination="/account" /> }} />
      <ScreenContainer>
        <ScreenIntro title={t("forgotPassword.title")} description={t("forgotPassword.description")} />
        <Card>
          <Text style={styles.label}>{t("account.handle")}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={handle}
            onChangeText={setHandle}
            placeholder={t("account.handlePlaceholder")}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>{t("account.email")}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder={t("account.emailPlaceholder")}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
          {!!message && <Text style={styles.message}>{message}</Text>}
          <Button
            label={t("forgotPassword.submit")}
            onPress={submit}
            loading={loading}
            disabled={!handle.trim() || !email.trim()}
            variant="secondary"
          />
          <Pressable onPress={() => router.push("/account/reset-password")} style={styles.link}>
            <Text style={styles.linkText}>{t("forgotPassword.haveCode")}</Text>
          </Pressable>
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
  message: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12, lineHeight: 17 },
  link: { minHeight: 40, justifyContent: "center", alignItems: "center" },
  linkText: { color: theme.colors.success, fontFamily: theme.font.family.bold, fontSize: 12 },
});
