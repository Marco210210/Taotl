import { useMemo } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";

// Sostituisce Alert.alert nei popup di conferma/annulla: Alert.alert è
// nativo OS e i suoi bottoni non si possono restilizzare. Stesso schema
// Modal+Card+Button già usato per il prompt "crea account" in app/index.tsx.
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <Button label={confirmLabel} variant={destructive ? "danger" : "secondary"} onPress={onConfirm} />
          <Button label={cancelLabel} variant="ghost" onPress={onCancel} />
        </Card>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      padding: 22,
      backgroundColor: "rgba(0, 0, 0, 0.58)",
    },
    card: {
      width: "100%",
      maxWidth: 440,
      alignSelf: "center",
      padding: 20,
      gap: 12,
    },
    title: {
      color: colors.text,
      fontFamily: theme.font.family.extraBold,
      fontSize: 19,
      lineHeight: 24,
    },
    description: {
      color: colors.textMuted,
      fontFamily: theme.font.family.medium,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 2,
    },
  });
}
