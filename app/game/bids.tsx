import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { NumberStepper } from "@/components/NumberStepper";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { maxFirstTurnCards, validatePersonalizzataCards } from "@/game/modes";
import type { ActiveGame, Bid, Player, RoundInfo } from "@/game/types";
import { validateBid } from "@/game/validation";
import { useGame } from "@/state/GameContext";
import { theme } from "@/theme";

export default function BidsScreen() {
  const { game, currentRoundInfo, previousCardsDealt, setPendingCards, confirmBids } = useGame();

  useEffect(() => {
    if (!game) {
      router.replace("/");
      return;
    }
    if (game.status === "scoring") {
      router.replace("/game/scoring");
    }
    if (game.status === "finished") {
      router.replace("/game/end");
    }
  }, [game]);

  if (!game) return null;

  if (game.status === "awaiting-cards") {
    return <CardsStep game={game} previousCardsDealt={previousCardsDealt} onConfirm={setPendingCards} />;
  }

  if (game.status === "bidding" && currentRoundInfo) {
    return <BiddingStep players={game.players} roundInfo={currentRoundInfo} onConfirm={confirmBids} />;
  }

  return null;
}

function CardsStep({
  game,
  previousCardsDealt,
  onConfirm,
}: {
  game: ActiveGame;
  previousCardsDealt: number | null;
  onConfirm: (cardsDealt: number) => void;
}) {
  const numPlayers = game.players.length;
  const roundIndex = game.rounds.length + 1;
  const defaultMax = previousCardsDealt !== null ? previousCardsDealt - 1 : maxFirstTurnCards(numPlayers);
  const [value, setValue] = useState(Math.max(1, defaultMax));
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const err = validatePersonalizzataCards({ candidate: value, previousCardsDealt, numPlayers, roundIndex });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onConfirm(value);
  };

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Turno {roundIndex}</Text>
        <Text style={styles.helper}>
          {previousCardsDealt !== null
            ? `Turno precedente: ${previousCardsDealt} carte. Quante carte sono state distribuite questo turno?`
            : `Quante carte sono state distribuite? (massimo ${maxFirstTurnCards(numPlayers)} con ${numPlayers} giocatori)`}
        </Text>
      </View>
      <Card style={styles.stepperCard}>
        <NumberStepper value={value} min={1} max={Math.max(1, defaultMax)} onChange={setValue} />
      </Card>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Conferma carte" onPress={handleConfirm} />
    </ScreenContainer>
  );
}

function BiddingStep({
  players,
  roundInfo,
  onConfirm,
}: {
  players: Player[];
  roundInfo: RoundInfo;
  onConfirm: (bids: Bid[]) => void;
}) {
  const [bidsSoFar, setBidsSoFar] = useState<Bid[]>([]);
  const [value, setValue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const currentPlayerId = roundInfo.biddingOrder[bidsSoFar.length] as string | undefined;
  const currentPlayer = currentPlayerId ? playerById.get(currentPlayerId) : null;
  const isDealer = bidsSoFar.length === roundInfo.biddingOrder.length - 1;
  const otherBidsSum = bidsSoFar.reduce((sum, b) => sum + b.bid, 0);

  useEffect(() => {
    setValue(0);
    setError(null);
  }, [currentPlayerId]);

  const handleConfirmBid = () => {
    if (!currentPlayerId) return;
    const err = validateBid({ value, cardsInHand: roundInfo.cardsDealt, isDealer, otherBidsSum });
    if (err) {
      setError(err);
      return;
    }
    const next = [...bidsSoFar, { playerId: currentPlayerId, bid: value }];
    setBidsSoFar(next);
    if (next.length === roundInfo.biddingOrder.length) {
      onConfirm(next);
    }
  };

  const handleUndo = () => setBidsSoFar((prev) => prev.slice(0, -1));

  return (
    <ScreenContainer>
      <View>
        <Text style={styles.heading}>Turno {roundInfo.index}</Text>
        <Text style={styles.helper}>
          {roundInfo.cardsDealt} carte · Presa {roundInfo.presaValue} pt · Rispetto {roundInfo.rispettoValue} pt
        </Text>
      </View>

      <Button label="Vedi classifica" variant="ghost" onPress={() => router.push("/game/standings")} />

      {bidsSoFar.length > 0 && (
        <Card>
          <Text style={styles.cardLabel}>Chiamate</Text>
          {bidsSoFar.map((b) => (
            <View key={b.playerId} style={styles.bidRow}>
              <Text style={styles.bidName}>{playerById.get(b.playerId)?.name}</Text>
              <Text style={styles.bidValue}>{b.bid}</Text>
            </View>
          ))}
          <Button label="Correggi ultima chiamata" variant="ghost" onPress={handleUndo} />
        </Card>
      )}

      {currentPlayer && (
        <Card style={styles.currentCard}>
          <View style={styles.currentHeader}>
            <PlayerAvatar name={currentPlayer.name} photoUri={currentPlayer.photoUri} size={56} />
            <View>
              <Text style={styles.currentName}>{currentPlayer.name}</Text>
              {isDealer && <Text style={styles.dealerTag}>Mazziere · ultimo a chiamare</Text>}
            </View>
          </View>
          <NumberStepper value={value} min={0} max={roundInfo.cardsDealt} onChange={setValue} />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Conferma chiamata" onPress={handleConfirmBid} />
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  helper: { fontSize: theme.font.small, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  stepperCard: { alignItems: "center" },
  error: { color: theme.colors.danger, fontSize: theme.font.small, fontWeight: "600" },
  cardLabel: { fontSize: theme.font.small, color: theme.colors.textMuted, fontWeight: "700", textTransform: "uppercase" },
  bidRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  bidName: { color: theme.colors.text, fontSize: theme.font.body },
  bidValue: { color: theme.colors.primary, fontSize: theme.font.body, fontWeight: "800" },
  currentCard: { alignItems: "center" },
  currentHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1.5), alignSelf: "flex-start" },
  currentName: { fontSize: theme.font.heading, fontWeight: "700", color: theme.colors.text },
  dealerTag: { fontSize: theme.font.small, color: theme.colors.primary, fontWeight: "700" },
});
