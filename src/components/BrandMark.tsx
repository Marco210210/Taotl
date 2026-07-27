import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

export function BrandMark({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  const { t, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tileColor = inverse ? colors.success : colors.primaryText;

  return (
    <View style={[styles.row, compact && styles.compactRow]}>
      <View style={[styles.tile, compact && styles.compactTile, { backgroundColor: tileColor }]}>
        <Image
          source={require("../../assets/design/suit-mask.png")}
          resizeMode="contain"
          style={[styles.mask, compact && styles.compactMask]}
        />
      </View>
      {!compact && (
        <View>
          <Text style={[styles.wordmark, inverse && styles.inverseText]}>TAOTL</Text>
          <Text style={[styles.kicker, inverse && styles.inverseKicker]}>{t("brand.scorekeeper")}</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 14 },
    compactRow: { gap: 0 },
    tile: {
      width: 54,
      height: 54,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    compactTile: { width: 46, height: 46, borderRadius: 13 },
    mask: { width: 38, height: 38 },
    compactMask: { width: 31, height: 31 },
    wordmark: {
      color: colors.primaryText,
      fontFamily: theme.font.family.display,
      fontSize: 34,
      lineHeight: 36,
      letterSpacing: 4.8,
    },
    kicker: {
      color: "rgba(248, 248, 245, .72)",
      fontFamily: theme.font.family.semibold,
      fontSize: 10,
      letterSpacing: 2.4,
    },
    inverseText: { color: colors.primaryText },
    inverseKicker: { color: "rgba(248, 248, 245, .64)" },
  });
}
