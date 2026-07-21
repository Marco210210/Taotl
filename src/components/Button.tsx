import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { theme } from "@/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? theme.colors.primaryText : theme.colors.text} />
      ) : (
        <Text style={[styles.label, variant === "primary" ? styles.primaryLabel : null]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  label: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  primaryLabel: { color: theme.colors.primaryText },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  danger: { backgroundColor: theme.colors.danger },
  ghost: { backgroundColor: "transparent" },
});
