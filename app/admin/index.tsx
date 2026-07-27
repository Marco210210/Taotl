import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export default function AdminScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backDestination = from === "profile" ? "/profile" : "/";
  const { account } = useAccount();
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const header = <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination={backDestination} /> }} />;

  if (!account) {
    return (
      <>
      {header}
      <ScreenContainer>
        <ScreenIntro title={t("admin.title")} description={t("admin.loginRequired")} />
        <Button
          label={t("admin.openLogin")}
          onPress={() => router.push({ pathname: "/account", params: { from: "admin" } })}
        />
      </ScreenContainer>
      </>
    );
  }

  if (!account.isAdmin) {
    return (
      <>
      {header}
      <ScreenContainer>
        <ScreenIntro title={t("admin.title")} description={t("admin.denied")} />
        <Button label={t("common.back")} variant="secondary" onPress={() => router.dismissTo(backDestination)} />
      </ScreenContainer>
      </>
    );
  }

  return (
    <>
    {header}
    <ScreenContainer>
      <ScreenIntro title={t("admin.title")} description={t("admin.description")} />

      <Card style={styles.identityCard}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>A</Text>
        </View>
        <View style={styles.identityInfo}>
          <Text style={styles.eyebrow}>{t("admin.badge")}</Text>
          <Text style={styles.name}>{account.displayName}</Text>
          <Text style={styles.handle}>@{account.handle}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t("admin.activeAs")}</Text>
        <Text style={styles.value}>@{account.handle}</Text>
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>{t("admin.linkedProfile")}</Text>
        <Text style={styles.value}>
          {account.linkedPlayerId ? account.displayName : t("admin.notLinked")}
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          label={t("admin.linkAccounts")}
          variant="success"
          onPress={() => router.push({ pathname: "/leaderboard/link-account", params: { from: "admin" } })}
        />
        <Button
          label={t("admin.addGame")}
          onPress={() => router.push({ pathname: "/leaderboard/add-game", params: { from: "admin" } })}
        />
        <Button
          label={t("admin.managePlayers")}
          variant="secondary"
          onPress={() => router.push({ pathname: "/roster", params: { from: "admin" } })}
        />
        <Button
          label={t("admin.manageHistory")}
          variant="ghost"
          onPress={() => router.push({ pathname: "/history", params: { from: "admin" } })}
        />
      </View>
    </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    identityCard: {
      minHeight: 92,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.firstPlace,
      borderColor: colors.firstPlaceBorder,
    },
    badge: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.yellow,
    },
    badgeText: { color: "#17181D", fontFamily: theme.font.family.extraBold, fontSize: 22 },
    identityInfo: { flex: 1 },
    eyebrow: {
      color: colors.gold,
      fontFamily: theme.font.family.extraBold,
      fontSize: 9.5,
      letterSpacing: 1.2,
    },
    name: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 20 },
    handle: { color: colors.textMuted, fontFamily: theme.font.family.semibold, fontSize: 11.5 },
    sectionTitle: {
      color: colors.textMuted,
      fontFamily: theme.font.family.bold,
      fontSize: 9.5,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    value: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 14 },
    divider: { height: 1, marginVertical: 5, backgroundColor: colors.border },
    actions: { gap: 10 },
  });
}
