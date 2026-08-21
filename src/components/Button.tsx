import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

type Variant = "primary" | "secondary" | "danger" | "success" | "yellow" | "ghost";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  fullWidth = true,
  subtitle,
  trailing,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  subtitle?: string;
  trailing?: string;
}) {
  const { vibrationEnabled, colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const variantStyles = useMemo(() => makeVariantStyles(colors), [colors]);
  const isDisabled = disabled || loading;
  // primary/danger/success restano sfondi colorati e saturi in entrambi i
  // temi → testo di un colore chiaro fisso. secondary invece usa
  // colors.text come sfondo, che SI INVERTE tra i due temi (ink scuro
  // in chiaro, crema chiaro in scuro) → il testo deve seguire l'inversione
  // (colors.background), non restare fisso chiaro.
  const hasLightLabel = variant === "primary" || variant === "danger" || variant === "success";
  const isSecondary = variant === "secondary";
  const isYellow = variant === "yellow";

  return (
    <TouchableOpacity
      onPress={() => {
        if (vibrationEnabled) void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      activeOpacity={0.74}
      style={[
        styles.base,
        fullWidth ? styles.fullWidth : null,
        variantStyles[variant],
        isDisabled ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          pointerEvents="none"
          color={hasLightLabel ? colors.primaryText : isSecondary ? colors.background : colors.text}
        />
      ) : (
        <>
          <View pointerEvents="none" style={styles.textBlock}>
            <Text
              maxFontSizeMultiplier={1.15}
              style={[
                styles.label,
                hasLightLabel ? styles.lightLabel : null,
                isSecondary ? styles.secondaryLabel : null,
                isYellow ? styles.yellowLabel : null,
              ]}
            >
              {label}
            </Text>
            {!!subtitle && (
              <Text
                maxFontSizeMultiplier={1.15}
                style={[
                  styles.subtitle,
                  hasLightLabel ? styles.lightSubtitle : null,
                  isSecondary ? styles.secondarySubtitle : null,
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {!!trailing && (
            <Text
              allowFontScaling={false}
              pointerEvents="none"
              style={[
                styles.trailing,
                hasLightLabel ? styles.lightLabel : null,
                isSecondary ? styles.secondaryLabel : null,
              ]}
            >
              {trailing}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    base: {
      minHeight: 54,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    fullWidth: { alignSelf: "stretch", width: "100%" },
    textBlock: { flexShrink: 1, alignItems: "center" },
    label: { fontSize: 15, fontFamily: theme.font.family.extraBold, color: colors.text, textAlign: "center" },
    subtitle: {
      marginTop: 2,
      fontSize: 11,
      fontFamily: theme.font.family.medium,
      color: colors.textMuted,
      textAlign: "center",
    },
    trailing: { marginLeft: "auto", fontSize: 25, fontFamily: theme.font.family.regular, color: colors.text },
    lightLabel: { color: colors.primaryText },
    lightSubtitle: { color: "rgba(248, 248, 245, 0.78)" },
    secondaryLabel: { color: colors.background },
    secondarySubtitle: { color: colors.backgroundMuted },
    yellowLabel: { color: "#17181D" },
    disabled: { opacity: 0.42 },
  });
}

function makeVariantStyles(colors: ThemeColors) {
  return StyleSheet.create({
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.text },
    danger: { backgroundColor: colors.danger },
    success: { backgroundColor: colors.success },
    yellow: { backgroundColor: colors.yellow },
    ghost: { backgroundColor: "transparent" },
  });
}
