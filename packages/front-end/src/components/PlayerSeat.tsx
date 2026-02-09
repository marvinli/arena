import type { Player } from "../types";
import { ChipStackDisplay } from "./ChipStack";
import styles from "./PlayerSeat.module.css";
import { PlayingCard } from "./PlayingCard";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PlayerSeat({
  player,
  seatColor,
  holeCardSecondClass,
}: {
  player: Player;
  seatColor: string;
  holeCardSecondClass?: string;
}) {
  const seatClass = [
    styles.seat,
    player.isActive ? styles.active : "",
    player.isFolded ? styles.folded : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showCards = !player.isFolded;

  const actionBadgeClass = player.lastAction
    ? `${styles.actionBadge} ${player.lastAction === "fold" ? styles.actionFold : ""}`
    : undefined;

  return (
    <div className={seatClass}>
      <div className={styles.topRow}>
        <div className={styles.avatarColumn}>
          <div className={styles.avatarArea}>
            {player.lastAction && actionBadgeClass && (
              <div className={actionBadgeClass}>
                {player.lastAction.toUpperCase()}
              </div>
            )}
            <div
              className={styles.avatarRing}
              style={{ "--seat-color": seatColor } as React.CSSProperties}
            >
              <div className={styles.avatar}>
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  getInitials(player.name)
                )}
              </div>
            </div>
          </div>
          <div className={styles.infoBadge}>
            <span className={styles.name}>{player.name}</span>
            <ChipStackDisplay amount={player.chips} />
          </div>
        </div>
        {showCards && (
          <div className={styles.cards}>
            {player.cards ? (
              <>
                <PlayingCard card={player.cards[0]} />
                <div className={holeCardSecondClass}>
                  <PlayingCard card={player.cards[1]} />
                </div>
              </>
            ) : (
              <>
                <PlayingCard card={null} />
                <div className={holeCardSecondClass}>
                  <PlayingCard card={null} />
                </div>
              </>
            )}
          </div>
        )}
        {player.isDealer && <div className={styles.dealerButton}>D</div>}
      </div>
    </div>
  );
}
