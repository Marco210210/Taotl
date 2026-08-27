import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

interface LeaderboardSelectorProps {
  leaderboards: ReadonlyArray<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}

export function LeaderboardSelector({
  leaderboards,
  selectedIds,
  onChange,
  multiple = false,
  disabled = false,
}: LeaderboardSelectorProps) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const select = (id: string) => {
    if (disabled) return;
    if (!multiple) {
      onChange([id]);
      return;
    }
    onChange(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  };

  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {leaderboards.map((leaderboard) => {
        const selected = selectedIds.includes(leaderboard.id);
        return (
          <Pressable
            key={leaderboard.id}
            disabled={disabled}
            onPress={() => select(leaderboard.id)}
            accessibilityRole={multiple ? "checkbox" : "radio"}
            accessibilityState={{ checked: selected, selected, disabled }}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.name, selected && styles.nameSelected]}>{leaderboard.name}</Text>
            <View style={[styles.marker, selected && styles.markerSelected]}>
              <Text style={styles.markerText}>{selected ? "✓" : ""}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { gap: 8 },
    option: {
      minHeight: 50,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: { borderColor: colors.success, backgroundColor: colors.positiveSoft },
    name: { flex: 1, color: colors.text, fontFamily: theme.font.family.bold, fontSize: 14 },
    nameSelected: { color: colors.success },
    marker: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
    },
    markerSelected: { borderColor: colors.success, backgroundColor: colors.success },
    markerText: { color: colors.surface, fontFamily: theme.font.family.extraBold, fontSize: 13 },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.55 },
  });
}
