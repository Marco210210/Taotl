import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function ForgotPasswordScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { requestReset } = useAccount();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    setMessage(null);
    try {
      await requestReset(normalizedEmail);
      router.replace({
        pathname: "/account/reset-password",
        params: { email: normalizedEmail, sentAt: String(Date.now()) },
      });
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
          <Text style={styles.label}>{t("account.email")}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder={t("account.emailPlaceholder")}
            placeholderTextColor={colors.textMuted as string}
            style={styles.input}
          />
          {!!message && <Text style={styles.message}>{message}</Text>}
          <Button
            label={t("forgotPassword.submit")}
            onPress={submit}
            loading={loading}
            disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())}
            variant="secondary"
          />
          <Pressable
            onPress={() => router.push({
              pathname: "/account/reset-password",
              params: email.trim() ? { email: email.trim().toLowerCase() } : {},
            })}
            style={styles.link}
          >
            <Text style={styles.linkText}>{t("forgotPassword.haveCode")}</Text>
          </Pressable>
        </Card>
      </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 12, marginTop: 4 },
    input: {
      minHeight: 50,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.background,
      color: colors.text,
      paddingHorizontal: 14,
      fontFamily: theme.font.family.semibold,
      fontSize: 15,
    },
    message: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12, lineHeight: 17 },
    link: { minHeight: 40, justifyContent: "center", alignItems: "center" },
    linkText: { color: colors.success, fontFamily: theme.font.family.bold, fontSize: 12 },
  });
}
