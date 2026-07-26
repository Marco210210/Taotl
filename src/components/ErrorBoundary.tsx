import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { theme } from "@/theme";

interface State {
  error: Error | null;
}

// Senza questo, un errore JS non gestito durante il render chiude semplicemente
// l'app in produzione (Android/iOS non mostrano il "red box" di sviluppo), senza
// nessun indizio su cosa sia successo. Con questo, l'errore resta visibile a
// schermo (e quindi fotografabile) invece di sparire nel nulla.
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Errore non gestito:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Si è verificato un errore</Text>
            <Text style={styles.message}>{this.state.error.message}</Text>
            {!!this.state.error.stack && <Text style={styles.stack}>{this.state.error.stack}</Text>}
            <Button label="Riprova" onPress={() => this.setState({ error: null })} variant="secondary" />
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 60 },
  content: { padding: 20, gap: 12 },
  title: { color: theme.colors.text, fontSize: 20, fontFamily: theme.font.family.extraBold },
  message: { color: theme.colors.danger, fontSize: 14, fontFamily: theme.font.family.semibold },
  stack: { color: theme.colors.textMuted, fontSize: 11, fontFamily: theme.font.family.medium },
});
