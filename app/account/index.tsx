import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

type AuthMode = "register" | "login";
type AuthField =
  | "handle"
  | "firstName"
  | "lastName"
  | "displayName"
  | "email"
  | "password"
  | "confirmPassword";
type FieldErrors = Partial<Record<AuthField, string>>;

const REGISTER_FIELD_ORDER: AuthField[] = [
  "handle",
  "firstName",
  "lastName",
  "displayName",
  "email",
  "password",
  "confirmPassword",
];
const LOGIN_FIELD_ORDER: AuthField[] = ["handle", "password"];

function sanitizeHandleInput(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[\s.-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .slice(0, 24);
}

export default function AccountScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backDestination =
    from === "setup"
      ? "/setup/players"
      : from === "admin"
        ? "/admin"
        : from === "home"
          ? "/"
          : "/profile";
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    account,
    room,
    loading,
    authError,
    register,
    login,
    logout,
    createRoom,
    joinRoom,
    refreshRoom,
    clearRoom,
  } = useAccount();
  const [mode, setMode] = useState<AuthMode>("register");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const handleRef = useRef<TextInput>(null);
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const displayNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const normalizedHandle = useMemo(() => sanitizeHandleInput(handle), [handle]);

  const isPasswordValid = (value: string) =>
    value.length >= 8 &&
    value.length <= 72 &&
    /[A-ZÀ-ÖØ-Þ]/.test(value) &&
    /[0-9]/.test(value);

  const focusField = (field: AuthField) => {
    const target =
      field === "handle"
        ? handleRef
        : field === "firstName"
          ? firstNameRef
          : field === "lastName"
            ? lastNameRef
            : field === "displayName"
              ? displayNameRef
              : field === "email"
                ? emailRef
                : field === "password"
                  ? passwordRef
                  : confirmPasswordRef;
    target.current?.focus();
  };

  const updateVisibleFieldError = (field: AuthField, nextError: string | null) => {
    setMessage(null);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      if (nextError) {
        next[field] = nextError;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const validateAuthFields = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!/^[a-z0-9_]{3,24}$/.test(normalizedHandle)) {
      errors.handle = t("account.invalidHandle");
    }
    if (mode === "register") {
      if (!firstName.trim()) errors.firstName = t("account.invalidFirstName");
      if (!lastName.trim()) errors.lastName = t("account.invalidLastName");
      if (!displayName.trim()) errors.displayName = t("account.invalidName");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        errors.email = t("account.invalidEmail");
      }
    }
    if (!isPasswordValid(password)) {
      errors.password = t("account.invalidPassword");
    }
    if (mode === "register" && (!confirmPassword || password !== confirmPassword)) {
      errors.confirmPassword = t("account.passwordMismatch");
    }

    return errors;
  };

  const submitAuth = async () => {
    setMessage(null);
    const nextErrors = validateAuthFields();
    setFieldErrors(nextErrors);
    const fieldOrder = mode === "register" ? REGISTER_FIELD_ORDER : LOGIN_FIELD_ORDER;
    const firstInvalidField = fieldOrder.find((field) => nextErrors[field]);
    if (firstInvalidField) {
      setTimeout(() => focusField(firstInvalidField), 0);
      return;
    }
    try {
      if (mode === "register") {
        await register({
          handle: normalizedHandle,
          displayName: displayName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
        });
      } else {
        await login(normalizedHandle, password);
      }
      setPassword("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : authError;
      const normalizedError = errorMessage?.toLocaleLowerCase("it") ?? "";
      const serverField =
        normalizedError.includes("email")
          ? "email"
          : normalizedError.includes("taotl id")
            ? "handle"
            : normalizedError.includes("password")
              ? "password"
              : null;

      if (serverField && errorMessage) {
        setFieldErrors((current) => ({ ...current, [serverField]: errorMessage }));
        setTimeout(() => focusField(serverField), 0);
      } else {
        setMessage(errorMessage);
      }
    }
  };

  const handleCreateRoom = async () => {
    setMessage(null);
    try {
      await createRoom();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : null);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    setMessage(null);
    try {
      await joinRoom(joinCode);
      setJoinCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : null);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => <LinearBackButton destination={backDestination} />,
        }}
      />
      <ScreenContainer>
        <ScreenIntro title={t("account.title")} description={t("account.description")} />

        {!account ? (
          <>
            <View style={styles.tabs}>
              {(["register", "login"] as const).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    setMode(value);
                    setMessage(null);
                    setFieldErrors({});
                  }}
                  style={[styles.tab, mode === value && styles.tabActive]}
                >
                  <Text style={[styles.tabText, mode === value && styles.tabTextActive]}>
                    {t(value === "register" ? "account.register" : "account.login")}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Card>
              <Text style={styles.label}>{t("account.handle")}</Text>
              <TextInput
                ref={handleRef}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={24}
                value={handle}
                onChangeText={(value) => {
                  const nextValue = sanitizeHandleInput(value);
                  setHandle(nextValue);
                  updateVisibleFieldError(
                    "handle",
                    /^[a-z0-9_]{3,24}$/.test(nextValue) ? null : t("account.invalidHandle"),
                  );
                }}
                placeholder={t("account.handlePlaceholder")}
                placeholderTextColor={colors.textMuted as string}
                style={[styles.input, fieldErrors.handle && styles.inputError]}
              />
              {fieldErrors.handle ? (
                <Text style={styles.fieldError}>{fieldErrors.handle}</Text>
              ) : (
                <Text style={styles.fieldHint}>{t("account.handleHint")}</Text>
              )}

              {mode === "register" && (
                <>
                  <Text style={styles.label}>{t("account.firstName")}</Text>
                  <TextInput
                    ref={firstNameRef}
                    maxLength={80}
                    value={firstName}
                    onChangeText={(value) => {
                      setFirstName(value);
                      updateVisibleFieldError("firstName", value.trim() ? null : t("account.invalidFirstName"));
                    }}
                    placeholder={t("account.firstNamePlaceholder")}
                    placeholderTextColor={colors.textMuted as string}
                    style={[styles.input, fieldErrors.firstName && styles.inputError]}
                  />
                  {!!fieldErrors.firstName && <Text style={styles.fieldError}>{fieldErrors.firstName}</Text>}

                  <Text style={styles.label}>{t("account.lastName")}</Text>
                  <TextInput
                    ref={lastNameRef}
                    maxLength={80}
                    value={lastName}
                    onChangeText={(value) => {
                      setLastName(value);
                      updateVisibleFieldError("lastName", value.trim() ? null : t("account.invalidLastName"));
                    }}
                    placeholder={t("account.lastNamePlaceholder")}
                    placeholderTextColor={colors.textMuted as string}
                    style={[styles.input, fieldErrors.lastName && styles.inputError]}
                  />
                  {!!fieldErrors.lastName && <Text style={styles.fieldError}>{fieldErrors.lastName}</Text>}

                  <Text style={styles.label}>{t("account.displayName")}</Text>
                  <TextInput
                    ref={displayNameRef}
                    maxLength={80}
                    value={displayName}
                    onChangeText={(value) => {
                      setDisplayName(value);
                      updateVisibleFieldError("displayName", value.trim() ? null : t("account.invalidName"));
                    }}
                    placeholder={t("account.displayNamePlaceholder")}
                    placeholderTextColor={colors.textMuted as string}
                    style={[styles.input, fieldErrors.displayName && styles.inputError]}
                  />
                  {!!fieldErrors.displayName && <Text style={styles.fieldError}>{fieldErrors.displayName}</Text>}

                  <Text style={styles.label}>{t("account.email")}</Text>
                  <TextInput
                    ref={emailRef}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    maxLength={160}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      updateVisibleFieldError(
                        "email",
                        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()) ? null : t("account.invalidEmail"),
                      );
                    }}
                    placeholder={t("account.emailPlaceholder")}
                    placeholderTextColor={colors.textMuted as string}
                    style={[styles.input, fieldErrors.email && styles.inputError]}
                  />
                  {!!fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}
                </>
              )}

              <Text style={styles.label}>{t("account.password")}</Text>
              <TextInput
                ref={passwordRef}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={72}
                secureTextEntry
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  updateVisibleFieldError(
                    "password",
                    isPasswordValid(value) ? null : t("account.invalidPassword"),
                  );
                  if (mode === "register") {
                    updateVisibleFieldError(
                      "confirmPassword",
                      value === confirmPassword ? null : t("account.passwordMismatch"),
                    );
                  }
                }}
                placeholder={t("account.passwordPlaceholder")}
                placeholderTextColor={colors.textMuted as string}
                style={[styles.input, fieldErrors.password && styles.inputError]}
              />
              {fieldErrors.password ? (
                <Text style={styles.fieldError}>{fieldErrors.password}</Text>
              ) : mode === "register" ? (
                <Text style={styles.fieldHint}>{t("account.passwordHint")}</Text>
              ) : null}
              {mode === "register" && (
                <>
                  <Text style={styles.label}>{t("account.confirmPassword")}</Text>
                  <TextInput
                    ref={confirmPasswordRef}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={72}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={(value) => {
                      setConfirmPassword(value);
                      updateVisibleFieldError(
                        "confirmPassword",
                        value === password ? null : t("account.passwordMismatch"),
                      );
                    }}
                    placeholder={t("account.confirmPasswordPlaceholder")}
                    placeholderTextColor={colors.textMuted as string}
                    style={[styles.input, fieldErrors.confirmPassword && styles.inputError]}
                  />
                  {!!fieldErrors.confirmPassword && (
                    <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
                  )}
                </>
              )}

              {mode === "login" && (
                <Pressable onPress={() => router.push("/account/forgot-password")} style={styles.forgotLink}>
                  <Text style={styles.forgotText}>{t("account.forgotPassword")}</Text>
                </Pressable>
              )}

              {!!message && <Text style={styles.error}>{message}</Text>}
              <Button
                label={t(mode === "register" ? "account.create" : "account.enter")}
                onPress={submitAuth}
                loading={loading}
                variant="secondary"
              />
              <Text style={styles.security}>{t("account.security")}</Text>
            </Card>
          </>
        ) : (
          <>
            <Card style={styles.identityCard}>
              <Text style={styles.eyebrow}>{t("account.verified")}</Text>
              <Text style={styles.name}>{account.displayName}</Text>
              <Text style={styles.handle}>@{account.handle}</Text>
              <Text style={styles.helper}>{t("account.signedInAs")} Taotl ID</Text>
              <Button label={t("account.logout")} variant="ghost" onPress={logout} loading={loading} />
            </Card>

            <Card>
              <Text style={styles.eyebrow}>{t("account.tableTitle")}</Text>
              <Text style={styles.body}>{t("account.tableDescription")}</Text>

              {!room ? (
                <>
                  <Button label={t("account.createRoom")} onPress={handleCreateRoom} loading={loading} variant="success" />
                  <View style={styles.divider} />
                  <Text style={styles.label}>{t("account.joinCode")}</Text>
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    value={joinCode}
                    onChangeText={(value) => setJoinCode(value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
                    placeholder={t("account.joinCodePlaceholder")}
                    placeholderTextColor={colors.textMuted as string}
                    style={[styles.input, styles.codeInput]}
                  />
                  <Button
                    label={t("account.joinRoom")}
                    onPress={handleJoinRoom}
                    disabled={joinCode.length !== 6}
                    loading={loading}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.codeLabel}>{t("account.roomCode")}</Text>
                  <Text selectable style={styles.code}>{room.code}</Text>
                  <Text style={styles.participantTitle}>{t("account.participants")}</Text>
                  {room.participants.map((participant) => (
                    <View key={participant.userId} style={styles.participant}>
                      <View style={styles.participantDot} />
                      <View style={styles.participantText}>
                        <Text style={styles.participantName}>{participant.displayName}</Text>
                        <Text style={styles.participantHandle}>@{participant.handle}</Text>
                      </View>
                      <Text style={styles.participantRole}>
                        {participant.userId === account.id
                          ? t("account.you")
                          : participant.isHost
                            ? t("account.host")
                            : "✓"}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.security}>{t("account.onlyVerified")}</Text>
                  <Button label={t("account.refresh")} onPress={refreshRoom} loading={loading} variant="ghost" />
                  <Button label={t("account.changeRoom")} onPress={clearRoom} loading={loading} variant="ghost" />
                </>
              )}
              {!!message && <Text style={styles.error}>{message}</Text>}
            </Card>
          </>
        )}
      </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    tabs: {
      flexDirection: "row",
      padding: 4,
      gap: 4,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceAlt,
    },
    tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 9 },
    tabActive: { backgroundColor: colors.surface },
    tabText: { color: colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 13 },
    tabTextActive: { color: colors.text },
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
    inputError: {
      borderWidth: 2,
      borderColor: colors.danger,
      backgroundColor: colors.negativeSoft,
    },
    fieldError: {
      marginTop: -4,
      color: colors.danger,
      fontFamily: theme.font.family.bold,
      fontSize: 11,
      lineHeight: 15,
    },
    fieldHint: {
      marginTop: -4,
      color: colors.textMuted,
      fontFamily: theme.font.family.medium,
      fontSize: 10.5,
      lineHeight: 15,
    },
    codeInput: { letterSpacing: 5, textAlign: "center", fontFamily: theme.font.family.extraBold, fontSize: 20 },
    forgotLink: { minHeight: 32, justifyContent: "center", alignItems: "flex-end" },
    forgotText: { color: colors.success, fontFamily: theme.font.family.bold, fontSize: 12 },
    error: { color: colors.danger, fontFamily: theme.font.family.semibold, fontSize: 12, lineHeight: 17 },
    security: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10.5, lineHeight: 16 },
    identityCard: { alignItems: "center", paddingVertical: 22 },
    eyebrow: { color: colors.success, fontFamily: theme.font.family.extraBold, fontSize: 10, letterSpacing: 1.2 },
    name: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 26 },
    handle: { color: colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 14 },
    helper: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11 },
    body: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12, lineHeight: 18 },
    divider: { height: 1, marginVertical: 8, backgroundColor: colors.border },
    codeLabel: {
      marginTop: 8,
      color: colors.textMuted,
      fontFamily: theme.font.family.extraBold,
      fontSize: 9,
      letterSpacing: 1.1,
      textAlign: "center",
    },
    code: {
      color: colors.text,
      fontFamily: theme.font.family.extraBold,
      fontSize: 36,
      letterSpacing: 8,
      textAlign: "center",
    },
    participantTitle: { marginTop: 10, color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 14 },
    participant: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    participantDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
    participantText: { flex: 1 },
    participantName: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 13 },
    participantHandle: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10 },
    participantRole: { color: colors.success, fontFamily: theme.font.family.extraBold, fontSize: 10 },
  });
}
