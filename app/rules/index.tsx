import { Image, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TOTAL_CARDS } from "@/game/constants";
import { theme } from "@/theme";

const SUITS = [
  require("../../assets/design/suit-heart.png"),
  require("../../assets/design/suit-diamond.png"),
  require("../../assets/design/suit-club.png"),
  require("../../assets/design/suit-spear.png"),
  require("../../assets/design/suit-mask.png"),
];

export default function RulesScreen() {
  return (
    <ScreenContainer>
      <View style={styles.formulaCard}>
        <Text style={styles.eyebrow}>COME SI CALCOLANO I PUNTI</Text>
        <Text style={styles.formula}>chiamata × 5N + 10N{`\n`}se rispetti</Text>
        <Text style={styles.negativeFormula}>− 5N × scarto se sbagli</Text>
        <Text style={styles.note}>N è il numero del turno: presa e rispetto aumentano mentre la partita avanza.</Text>
      </View>

      <Card>
        <Text style={styles.title}>Il vincolo del mazziere</Text>
        <Text style={styles.body}>
          Il mazziere parla per ultimo. Non può fare una chiamata che porti la somma totale esattamente al numero
          di carte distribuite. Taotl calcola quel valore e lo salta nello stepper.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Esito del turno</Text>
        <Text style={styles.body}>
          Se rispetti la chiamata ottieni il valore delle prese più il valore rispetto. Se sbagli perdi il valore
          di una presa per ogni presa di scarto. In ogni turno almeno un giocatore deve sbagliare.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Modalità</Text>
        <Text style={styles.body}>
          Classica usa sei turni stabiliti in base ai partecipanti. Completa parte dal massimo consentito dal
          mazzo da {TOTAL_CARDS} carte. Breve usa 6–5–4–3–2–1. Personalizzata permette di scegliere dal vivo, ma
          dura almeno sei turni e termina sempre con 3–2–1.
        </Text>
      </Card>

      <View style={styles.suits}>
        {SUITS.map((source, index) => (
          <Image key={index} source={source} resizeMode="contain" style={styles.suit} />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  formulaCard: { padding: 18, borderRadius: 14, backgroundColor: theme.colors.success, gap: 7 },
  eyebrow: {
    color: "rgba(248,248,245,.68)",
    fontFamily: theme.font.family.bold,
    fontSize: 9.5,
    letterSpacing: 1.4,
  },
  formula: {
    color: theme.colors.background,
    fontFamily: theme.font.family.display,
    fontSize: 24,
    lineHeight: 29,
  },
  negativeFormula: { color: theme.colors.yellow, fontFamily: theme.font.family.display, fontSize: 21 },
  note: {
    marginTop: 3,
    color: "rgba(248,248,245,.72)",
    fontFamily: theme.font.family.medium,
    fontSize: 11.5,
    lineHeight: 17,
  },
  title: { color: theme.colors.text, fontFamily: theme.font.family.extraBold, fontSize: 15 },
  body: { color: theme.colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 12, lineHeight: 18 },
  suits: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 },
  suit: { width: 32, height: 32 },
});
