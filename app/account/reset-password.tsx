import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; sentAt?: string }>();
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { confirmReset, requestReset } = useAccount();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const initialSentAt = Number(typeof params.sentAt === "string" ? params.sentAt : 0);
  const [resendAvailableAt, setResendAvailableAt] = useState(
    Number.isFinite(initialSentAt) && initialSentAt > 0 ? initialSentAt + 30_000 : 0,
  );
  const [now, setNow] = useState(Date.now());

  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail);
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  useEffect(() => {
    if (resendAvailableAt <= Date.now()) return;
    const interval = setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= resendAvailableAt) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendAvailableAt]);

  const isPasswordValid = (value: string) =>
    value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);

  const submit = async () => {
    setMessage(null);
    if (!isEmailValid) {
      setMessage(t("account.invalidEmail"));
      return;
    }
    if (!isPasswordValid(password)) {
      setMessage(t("account.invalidPassword"));
      return;
    }
    setLoading(true);
    try {
      await confirmReset(normalizedEmail, code, password);
      router.replace("/profile");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : null);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!isEmailValid || resendSeconds > 0) return;
    setMessage(null);
    setResending(true);
    try {
      await requestReset(normalizedEmail);
      const nextAvailableAt = Date.now() + 30_000;
      setNow(Date.now());
      setResendAvailableAt(nextAvailableAt);
      setMessage(t("resetPassword.resent"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : null);
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination="/account/forgot-password" /> }} />
      <ScreenContainer>
        <ScreenIntro title={t("resetPassword.title")} description={t("resetPassword.description")} />
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
          {!!params.sentAt && isEmailValid && (
            <Text style={styles.hint}>{t("resetPassword.sentTo")} {normalizedEmail}</Text>
          )}
          <Text style={styles.label}>{t("resetPassword.code")}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            keyboardType="number-pad"
            maxLength={8}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 8))}
            placeholder={t("resetPassword.codePlaceholder")}
            placeholderTextColor={colors.textMuted as string}
            style={styles.input}
          />
          <Text style={styles.hint}>{t("resetPassword.codeHint")}</Text>
          <Button
            label={resendSeconds > 0
              ? `${t("resetPassword.resendIn")} ${resendSeconds} s`
              : t("resetPassword.resend")}
            onPress={resend}
            loading={resending}
            disabled={!isEmailValid || resendSeconds > 0}
            variant="ghost"
          />
          <Text style={styles.label}>{t("resetPassword.newPassword")}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder={t("account.passwordPlaceholder")}
            placeholderTextColor={colors.textMuted as string}
            style={styles.input}
          />
          <Text style={styles.hint}>{t("account.passwordHint")}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <Button
            label={t("resetPassword.submit")}
            onPress={submit}
            loading={loading}
            disabled={!isEmailValid || code.length !== 8 || !password}
            variant="secondary"
          />
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
    hint: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10.5, lineHeight: 16 },
    message: { color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 12, lineHeight: 17 },
  });
}
