import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme } from "@/theme";

export function NumberStepper({
  value,
  min,
  max,
  onChange,
  disabled,
  disabledValues = [],
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  disabledValues?: number[];
}) {
  const { resolvedLanguage, vibrationEnabled } = useAppSettings();
  const disabledSet = new Set(disabledValues);
  const previousValue = findAllowedValue(value, -1, min, max, disabledSet);
  const nextValue = findAllowedValue(value, 1, min, max, disabledSet);
  const canDecrement = !disabled && previousValue !== null;
  const canIncrement = !disabled && nextValue !== null;
  const changeValue = (next: number) => {
    if (vibrationEnabled) void Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => canDecrement && previousValue !== null && changeValue(previousValue)}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel={resolvedLanguage === "en" ? "Decrease" : "Diminuisci"}
        accessibilityState={{ disabled: !canDecrement }}
        style={[styles.btn, !canDecrement && styles.btnDisabled]}
      >
        <Text style={styles.btnLabel}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        onPress={() => canIncrement && nextValue !== null && changeValue(nextValue)}
        disabled={!canIncrement}
        accessibilityRole="button"
        accessibilityLabel={resolvedLanguage === "en" ? "Increase" : "Aumenta"}
        accessibilityState={{ disabled: !canIncrement }}
        style={[styles.btn, !canIncrement && styles.btnDisabled]}
      >
        <Text style={styles.btnLabel}>+</Text>
      </Pressable>
    </View>
  );
}

function findAllowedValue(
  current: number,
  direction: -1 | 1,
  min: number,
  max: number,
  disabledValues: Set<number>,
): number | null {
  for (let candidate = current + direction; candidate >= min && candidate <= max; candidate += direction) {
    if (!disabledValues.has(candidate)) return candidate;
  }
  return null;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(2) },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: theme.colors.inkSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.35 },
  btnLabel: { color: theme.colors.text, fontSize: 24, fontFamily: theme.font.family.semibold },
  value: {
    color: theme.colors.text,
    fontSize: 24,
    fontFamily: theme.font.family.extraBold,
    minWidth: 38,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});
