import type { AgentTurnContext } from "./agent-runner.js";

function formatCard(card: { rank: string; suit: string }): string {
  const suitSymbol: Record<string, string> = {
    spades: "\u2660",
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
  };
  return `${card.rank}${suitSymbol[card.suit] ?? card.suit}`;
}

function formatCards(cards: Array<{ rank: string; suit: string }>): string {
  return cards.map(formatCard).join(" ");
}

export function formatDealHands(
  handNumber: number,
  myHand: Array<{ rank: string; suit: string }>,
  players: Array<{
    id: string;
    name: string;
    chips: number;
    status: string;
  }>,
  pot: number,
): string {
  const playerLines = players
    .map((p) => `  ${p.name}: ${p.chips} chips`)
    .join("\n");

  return `Hand #${handNumber} has been dealt.
Your hole cards: ${formatCards(myHand)}
Players:
${playerLines}
Pot: ${pot}`;
}

export function formatYourTurn(
  playerId: string,
  context: AgentTurnContext,
): string {
  const communityLine =
    context.communityCards.length > 0
      ? `Community cards: ${formatCards(context.communityCards)}\n`
      : "";

  const myHandLine = `Your hole cards: ${formatCards(context.myHand)}`;

  const totalPot = context.pots.reduce((sum, p) => sum + p.size, 0);

  const me = context.players.find((p) => p.id === playerId);
  const myChips = me ? me.chips : 0;
  const myBet = me ? me.bet : 0;

  const actionsLines = context.validActions
    .map((a) => {
      if (a.min != null && a.max != null) {
        return `  - ${a.type} (min: ${a.min}, max: ${a.max})`;
      }
      if (a.amount != null) {
        return `  - ${a.type} ${a.amount}`;
      }
      return `  - ${a.type}`;
    })
    .join("\n");

  return `It's your turn.
Phase: ${context.phase}
${communityLine}${myHandLine}
Pot: ${totalPot}
Your chips: ${myChips} (current bet: ${myBet})
Valid actions:
${actionsLines}

Call submit_action with your decision.`;
}

export function formatOpponentAction(
  playerName: string,
  action: string,
  amount?: number,
): string {
  const actionLower = action.toLowerCase();
  if (amount != null && amount > 0) {
    if (actionLower === "raise") return `${playerName} raises to ${amount}.`;
    if (actionLower === "bet") return `${playerName} bets ${amount}.`;
    if (actionLower === "call") return `${playerName} calls ${amount}.`;
    return `${playerName} ${actionLower}s ${amount}.`;
  }
  if (actionLower === "fold") return `${playerName} folds.`;
  if (actionLower === "check") return `${playerName} checks.`;
  if (actionLower === "call") return `${playerName} calls.`;
  return `${playerName} ${actionLower}s.`;
}

export function formatDealCommunity(
  phase: string,
  cards: Array<{ rank: string; suit: string }>,
): string {
  return `${phase}: ${formatCards(cards)}`;
}

export function formatHandResult(
  handNumber: number,
  winners: Array<{ playerId: string; amount: number }>,
  players: Array<{ id: string; name: string; chips: number }>,
): string {
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const winnerLines = winners
    .map((w) => {
      const name = playerMap.get(w.playerId)?.name ?? w.playerId;
      return `  Winner: ${name} — wins ${w.amount}`;
    })
    .join("\n");

  const chipLines = players
    .map((p) => `  ${p.name}: ${p.chips} chips`)
    .join("\n");

  return `Hand #${handNumber} result:
${winnerLines}
${chipLines}`;
}
