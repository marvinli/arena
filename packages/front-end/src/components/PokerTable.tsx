import { useCommunityDealAnimation } from "../hooks/useCommunityDealAnimation";
import { useDealAnimation } from "../hooks/useDealAnimation";
import type { Card, Player, Pot } from "../types";
import { BetIndicator } from "./BetIndicator";
import { CommunityArea } from "./CommunityArea";
import { SEAT_COLORS, SEAT_POSITIONS } from "./layout";
import { PlayerSeat } from "./PlayerSeat";
import styles from "./PokerTable.module.css";
import { BRAND_COLORS } from "./ProviderIcon";
import { SidePanel } from "./SidePanel";

export function PokerTable({
  players,
  communityCards,
  pots,
  speakingPlayerId,
  analysisText,
  isApiError,
  handNumber,
  button,
}: {
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  speakingPlayerId: string | null;
  analysisText: string | null;
  isApiError: boolean;
  handNumber: number;
  button: number | null;
}) {
  const dealAnimation = useDealAnimation(handNumber, button, players);
  const communityAnim = useCommunityDealAnimation(communityCards);

  const speakingIdx = speakingPlayerId
    ? players.findIndex((p) => p.id === speakingPlayerId)
    : -1;
  const speakingPlayer = speakingIdx >= 0 ? players[speakingIdx] : null;
  const speakingColor = speakingPlayer
    ? (BRAND_COLORS[speakingPlayer.avatar] ?? SEAT_COLORS[speakingIdx])
    : undefined;

  // If any player is active or speaking, dim everyone else
  const highlightedId =
    speakingPlayerId ?? players.find((p) => p.isActive)?.id ?? null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.scene}>
        <CommunityArea
          communityCards={communityCards}
          pots={pots}
          communityAnim={communityAnim}
        />

        {/* Empty seat placeholders */}
        {SEAT_POSITIONS.slice(players.length).map((seat, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed empty seats never reorder
            key={`empty-${i}`}
            className={styles.emptySeat}
            style={{
              left: `${seat.x}%`,
              top: `${seat.y}%`,
            }}
          />
        ))}

        {players.map((player, i) => {
          const seat = SEAT_POSITIONS[i];
          if (!seat) return null;
          const seatColor = BRAND_COLORS[player.avatar] ?? SEAT_COLORS[i];

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
                  isDimmed={
                    highlightedId !== null && player.id !== highlightedId
                  }
                  visibleCards={dealAnimation.get(i)?.visibleCards ?? 2}
                  faceUp={dealAnimation.get(i)?.faceUp ?? true}
                />
              </div>
              {player.currentBet > 0 && (
                <BetIndicator
                  amount={player.currentBet}
                  isAllIn={player.isAllIn}
                  seatColor={seatColor}
                  seatX={seat.x}
                  seatY={seat.y}
                  seatIndex={i}
                />
              )}
            </div>
          );
        })}
      </div>
      <SidePanel
        speakingPlayer={speakingPlayer}
        speakingColor={speakingColor}
        analysisText={analysisText}
        isApiError={isApiError}
      />
    </div>
  );
}
