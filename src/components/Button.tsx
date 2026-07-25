import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
  const isDisabled = disabled || loading;
  const hasLightLabel =
    variant === "primary" || variant === "secondary" || variant === "danger" || variant === "success";

  return (
    <TouchableOpacity
      onPress={onPress}
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
        <ActivityIndicator pointerEvents="none" color={hasLightLabel ? theme.colors.primaryText : theme.colors.text} />
      ) : (
        <>
          <View pointerEvents="none" style={styles.textBlock}>
            <Text style={[styles.label, hasLightLabel ? styles.lightLabel : null]}>{label}</Text>
            {!!subtitle && (
              <Text style={[styles.subtitle, hasLightLabel ? styles.lightSubtitle : null]}>{subtitle}</Text>
            )}
          </View>
          {!!trailing && (
            <Text pointerEvents="none" style={[styles.trailing, hasLightLabel ? styles.lightLabel : null]}>
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
