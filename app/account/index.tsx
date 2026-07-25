import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

type AuthMode = "register" | "login";

export default function AccountScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backDestination = from === "setup" ? "/setup/players" : "/profile";
  const { t } = useAppSettings();
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
  } = useAccount();
  const [mode, setMode] = useState<AuthMode>("register");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const normalizedHandle = useMemo(
    () => handle.trim().toLowerCase().replace(/^@/, ""),
    [handle],
  );

  const isPasswordValid = (value: string) =>
    value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);

  const submitAuth = async () => {
    setMessage(null);
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedHandle)) {
      setMessage(t("account.invalidHandle"));
      return;
    }
    if (!isPasswordValid(password)) {
      setMessage(t("account.invalidPassword"));
      return;
    }
    if (mode === "register" && !displayName.trim()) {
      setMessage(t("account.invalidName"));
      return;
    }
    if (mode === "register" && (!firstName.trim() || !lastName.trim())) {
      setMessage(t("account.invalidFullName"));
      return;
    }
    try {
      if (mode === "register") {
        await register({
          handle: normalizedHandle,
          displayName: displayName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
        });
      } else {
        await login(normalizedHandle, password);
      }
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : authError);
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
                autoCapitalize="none"
                autoCorrect={false}
                value={handle}
                onChangeText={setHandle}
                placeholder={t("account.handlePlaceholder")}
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />

              {mode === "register" && (
                <>
                  <Text style={styles.label}>{t("account.firstName")}</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder={t("account.firstNamePlaceholder")}
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.input}
                  />

                  <Text style={styles.label}>{t("account.lastName")}</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder={t("account.lastNamePlaceholder")}
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.input}
                  />

                  <Text style={styles.label}>{t("account.displayName")}</Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={t("account.displayNamePlaceholder")}
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.input}
                  />
                </>
              )}

              <Text style={styles.label}>{t("account.password")}</Text>
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
              {mode === "register" && <Text style={styles.security}>{t("account.passwordHint")}</Text>}

              {!!(message || authError) && <Text style={styles.error}>{message || authError}</Text>}
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
                    placeholderTextColor={theme.colors.textMuted}
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

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  tabActive: { backgroundColor: theme.colors.surface },
  tabText: { color: theme.colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 13 },
  tabTextActive: { color: theme.colors.text },
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
  codeInput: { letterSpacing: 5, textAlign: "center", fontFamily: theme.font.family.extraBold, fontSize: 20 },
  error: { color: theme.colors.danger, fontFamily: theme.font.family.semibold, fontSize: 12, lineHeight: 17 },
  security: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10.5, lineHeight: 16 },
  identityCard: { alignItems: "center", paddingVertical: 22 },
  eyebrow: { color: theme.colors.success, fontFamily: theme.font.family.extraBold, fontSize: 10, letterSpacing: 1.2 },
  name: { color: theme.colors.text, fontFamily: theme.font.family.extraBold, fontSize: 26 },
  handle: { color: theme.colors.textMuted, fontFamily: theme.font.family.bold, fontSize: 14 },
  helper: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11 },
  body: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12, lineHeight: 18 },
  divider: { height: 1, marginVertical: 8, backgroundColor: theme.colors.border },
  codeLabel: {
    marginTop: 8,
    color: theme.colors.textMuted,
    fontFamily: theme.font.family.extraBold,
    fontSize: 9,
    letterSpacing: 1.1,
    textAlign: "center",
  },
  code: {
    color: theme.colors.text,
    fontFamily: theme.font.family.extraBold,
    fontSize: 36,
    letterSpacing: 8,
    textAlign: "center",
  },
  participantTitle: { marginTop: 10, color: theme.colors.text, fontFamily: theme.font.family.extraBold, fontSize: 14 },
  participant: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  participantDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.success },
  participantText: { flex: 1 },
  participantName: { color: theme.colors.text, fontFamily: theme.font.family.bold, fontSize: 13 },
  participantHandle: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 10 },
  participantRole: { color: theme.colors.success, fontFamily: theme.font.family.extraBold, fontSize: 10 },
});
