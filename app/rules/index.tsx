import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TOTAL_CARDS } from "@/game/constants";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

const SUITS = [
  require("../../assets/design/suit-heart.png"),
  require("../../assets/design/suit-diamond.png"),
  require("../../assets/design/suit-club.png"),
  require("../../assets/design/suit-spear.png"),
  require("../../assets/design/suit-mask.png"),
];

export default function RulesScreen() {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <ScreenContainer>
      <View style={styles.formulaCard}>
        <Text style={styles.eyebrow}>{t("rules.how")}</Text>
        <Text style={styles.formula}>{t("rules.formula")}</Text>
        <Text style={styles.negativeFormula}>{t("rules.negativeFormula")}</Text>
        <Text style={styles.note}>{t("rules.formulaNote")}</Text>
      </View>

      <Card>
        <Text style={styles.title}>{t("rules.dealerTitle")}</Text>
        <Text style={styles.body}>{t("rules.dealerBody")}</Text>
      </Card>

      <Card>
        <Text style={styles.title}>{t("rules.resultTitle")}</Text>
        <Text style={styles.body}>{t("rules.resultBody")}</Text>
      </Card>

      <Card>
        <Text style={styles.title}>{t("rules.modesTitle")}</Text>
        <Text style={styles.body}>{t("rules.modesBody").replace("72", String(TOTAL_CARDS))}</Text>
      </Card>

      <View style={styles.suits}>
        {SUITS.map((source, index) => (
          <Image key={index} source={source} resizeMode="contain" style={styles.suit} />
        ))}
      </View>
    </ScreenContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    formulaCard: { padding: 18, borderRadius: 14, backgroundColor: colors.success, gap: 7 },
    eyebrow: {
      color: "rgba(248,248,245,.68)",
      fontFamily: theme.font.family.bold,
      fontSize: 9.5,
      letterSpacing: 1.4,
    },
    formula: {
      color: colors.primaryText,
      fontFamily: theme.font.family.display,
      fontSize: 24,
      lineHeight: 29,
    },
    negativeFormula: { color: colors.yellow, fontFamily: theme.font.family.display, fontSize: 21 },
    note: {
      marginTop: 3,
      color: "rgba(248,248,245,.72)",
      fontFamily: theme.font.family.medium,
      fontSize: 11.5,
      lineHeight: 17,
    },
    title: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 15 },
    body: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12, lineHeight: 18 },
    suits: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 },
    suit: { width: 32, height: 32 },
  });
}
