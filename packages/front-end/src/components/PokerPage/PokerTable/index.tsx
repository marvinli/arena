import { useCommunityDealAnimation } from "../../../hooks/useCommunityDealAnimation";
import { useDealAnimation } from "../../../hooks/useDealAnimation";
import type { Card, Player, Pot } from "../../../types";
import { BRAND_COLORS } from "../ProviderIcon";
import { BetIndicator } from "./BetIndicator";
import { CommunityArea } from "./CommunityArea";
import { SEAT_COLORS, SEAT_POSITIONS } from "./layout";
import { PlayerSeat } from "./PlayerSeat";
import styles from "./PokerTable.module.css";

export function PokerTable({
  players,
  communityCards,
  pots,
  speakingPlayerId,
  handNumber,
  button,
}: {
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  speakingPlayerId: string | null;
  handNumber: number;
  button: number | null;
}) {
  const dealAnimation = useDealAnimation(handNumber, button, players);
  const communityAnim = useCommunityDealAnimation(communityCards);

  const hasWinner = players.some((p) => p.isWinner);

  // If any player is active or speaking, dim everyone else
  const highlightedId =
    speakingPlayerId ?? players.find((p) => p.isActive)?.id ?? null;

  return (
    <div className={styles.scene}>
      <CommunityArea
        communityCards={communityCards}
        pots={pots}
        communityAnim={communityAnim}
      />

      {/* Empty seat placeholders */}
      {SEAT_POSITIONS.map((seat, i) => {
        if (players.some((p) => p.seatIndex === i)) return null;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed seat positions never reorder
            key={`empty-${i}`}
            className={styles.emptySeat}
            style={{
              left: `${seat.x}%`,
              top: `${seat.y}%`,
            }}
          />
        );
      })}

      {players.map((player) => {
        const seat = SEAT_POSITIONS[player.seatIndex];
        if (!seat) return null;
        const seatColor =
          BRAND_COLORS[player.avatar] ?? SEAT_COLORS[player.seatIndex];

        return (
          <div key={player.id}>
            <div
              style={{
                position: "absolute",
                left: `${seat.x}%`,
                top: `${seat.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <PlayerSeat
                player={player}
                seatColor={seatColor}
                holeCardSecondClass={styles.holeCardSecond}
                isSpeaking={player.id === speakingPlayerId}
                isDimmed={highlightedId !== null && player.id !== highlightedId}
                hasWinner={hasWinner}
                visibleCards={
                  dealAnimation.get(player.seatIndex)?.visibleCards ?? 2
                }
                faceUp={dealAnimation.get(player.seatIndex)?.faceUp ?? true}
              />
            </div>
            {player.currentBet > 0 && (
              <BetIndicator
                amount={player.currentBet}
                isAllIn={player.isAllIn}
                seatColor={seatColor}
                seatX={seat.x}
                seatY={seat.y}
                seatIndex={player.seatIndex}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
