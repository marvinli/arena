import type { Card, Player } from "../../types";
import { mapCard, mapPlayers } from "../mappers";
import type { GqlPlayerInfo } from "../types";

/** Filter out busted players and map to app-level Player[], preserving avatars from previous state. */
export function buildPlayers(
  rawPlayers: GqlPlayerInfo[],
  button: number | null,
  prevPlayers: Player[],
  overrides?: (p: Player) => Partial<Player>,
): Player[] {
  const active = rawPlayers.filter((p) => p.status !== "BUSTED");
  return mapPlayers(active, button, prevPlayers).map((p) => ({
    ...p,
    ...(overrides ? overrides(p) : {}),
  }));
}

/** Build a hole-cards map from an array of hand data. */
export function buildHoleCards(
  hands: { playerId: string; cards: { rank: string; suit: string }[] }[],
): Map<string, [Card, Card]> {
  const holeCards = new Map<string, [Card, Card]>();
  for (const hand of hands) {
    if (hand.cards.length >= 2) {
      holeCards.set(hand.playerId, [
        mapCard(hand.cards[0]),
        mapCard(hand.cards[1]),
      ]);
    }
  }
  return holeCards;
}
