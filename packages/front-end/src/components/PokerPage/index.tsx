import type { Card, Player, Pot } from "../../types";
import styles from "./PokerPage.module.css";
import { PokerTable } from "./PokerTable";
import { SEAT_COLORS } from "./PokerTable/layout";
import { SidePanel } from "./SidePanel";

export function PokerPage({
  players,
  communityCards,
  pots,
  speakingPlayerId,
  analysisText,
  isApiError,
  handNumber,
  button,
  smallBlind,
  bigBlind,
}: {
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  speakingPlayerId: string | null;
  analysisText: string | null;
  isApiError: boolean;
  handNumber: number;
  button: number | null;
  smallBlind: number;
  bigBlind: number;
}) {
  const speakingIdx = speakingPlayerId
    ? players.findIndex((p) => p.id === speakingPlayerId)
    : -1;
  const speakingPlayer = speakingIdx >= 0 ? players[speakingIdx] : null;
  const speakingColor = speakingPlayer
    ? SEAT_COLORS[speakingPlayer.seatIndex]
    : undefined;

  return (
    <div className={styles.wrapper}>
      <PokerTable
        players={players}
        communityCards={communityCards}
        pots={pots}
        speakingPlayerId={speakingPlayerId}
        handNumber={handNumber}
        button={button}
      />
      <SidePanel
        speakingPlayer={speakingPlayer}
        speakingColor={speakingColor}
        analysisText={analysisText}
        isApiError={isApiError}
      />
      <div className={styles.infoBar}>
        Hand {handNumber} &middot; Blinds {smallBlind}/{bigBlind}
      </div>
    </div>
  );
}
