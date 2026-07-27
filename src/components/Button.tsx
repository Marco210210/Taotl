import * as Haptics from "expo-haptics";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

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
  const { vibrationEnabled } = useAppSettings();
  const isDisabled = disabled || loading;
  // primary/danger/success restano sfondi colorati e saturi in entrambi i
  // temi → testo di un colore chiaro fisso. secondary invece usa
  // theme.colors.text come sfondo, che SI INVERTE tra i due temi (ink scuro
  // in chiaro, crema chiaro in scuro) → il testo deve seguire l'inversione
  // (theme.colors.background), non restare fisso chiaro.
  const hasLightLabel = variant === "primary" || variant === "danger" || variant === "success";
  const isSecondary = variant === "secondary";

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
          color={hasLightLabel ? theme.colors.primaryText : isSecondary ? theme.colors.background : theme.colors.text}
        />
      ) : (
        <>
          <View pointerEvents="none" style={styles.textBlock}>
            <Text
              style={[
                styles.label,
                hasLightLabel ? styles.lightLabel : null,
                isSecondary ? styles.secondaryLabel : null,
              ]}
            >
              {label}
            </Text>
            {!!subtitle && (
              <Text
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

const styles = StyleSheet.create({
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
  label: { fontSize: 15, fontFamily: theme.font.family.extraBold, color: theme.colors.text, textAlign: "center" },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: theme.font.family.medium,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  trailing: { marginLeft: "auto", fontSize: 25, fontFamily: theme.font.family.regular, color: theme.colors.text },
  lightLabel: { color: theme.colors.primaryText },
  lightSubtitle: { color: "rgba(248, 248, 245, 0.78)" },
  secondaryLabel: { color: theme.colors.background },
  secondarySubtitle: { color: theme.colors.backgroundMuted },
  disabled: { opacity: 0.42 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.text },
  danger: { backgroundColor: theme.colors.danger },
  success: { backgroundColor: theme.colors.success },
  yellow: { backgroundColor: theme.colors.yellow },
  ghost: { backgroundColor: "transparent" },
});
