import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface State {
  error: Error | null;
}

// Senza questo, un errore JS non gestito durante il render chiude semplicemente
// l'app in produzione (Android/iOS non mostrano il "red box" di sviluppo), senza
// nessun indizio su cosa sia successo. Con questo, l'errore resta visibile a
// schermo (e quindi fotografabile) invece di sparire nel nulla.
//
// Questo componente sta SOPRA AppSettingsProvider nell'albero (vedi
// app/_layout.tsx), quindi il suo fallback non può usare useAppSettings()/il
// componente Button condiviso (chiamerebbe l'hook senza un provider sopra e
// farebbe crashare anche la schermata di errore): colori fissi e un
// Pressable semplice, di proposito.
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
            <Pressable
              onPress={() => this.setState({ error: null })}
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            >
              <Text style={styles.retryLabel}>Riprova</Text>
            </Pressable>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F5", paddingTop: 60 },
  content: { padding: 20, gap: 12 },
  title: { color: "#17181D", fontSize: 20, fontWeight: "800" },
  message: { color: "#CF3545", fontSize: 14, fontWeight: "600" },
  stack: { color: "rgba(23, 24, 29, 0.52)", fontSize: 11 },
  retryButton: {
    marginTop: 8,
    minHeight: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17181D",
  },
  retryButtonPressed: { opacity: 0.74 },
  retryLabel: { color: "#F8F8F5", fontSize: 15, fontWeight: "800" },
});
