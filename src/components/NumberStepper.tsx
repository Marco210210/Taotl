import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme";

export function NumberStepper({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => canDecrement && onChange(value - 1)}
        disabled={!canDecrement}
        style={[styles.btn, !canDecrement && styles.btnDisabled]}
      >
        <Text style={styles.btnLabel}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        onPress={() => canIncrement && onChange(value + 1)}
        disabled={!canIncrement}
        style={[styles.btn, !canIncrement && styles.btnDisabled]}
      >
        <Text style={styles.btnLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(2) },
  btn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnDisabled: { opacity: 0.35 },
  btnLabel: { color: theme.colors.text, fontSize: 22, fontWeight: "700" },
  value: { color: theme.colors.text, fontSize: 28, fontWeight: "800", minWidth: 56, textAlign: "center" },
});
