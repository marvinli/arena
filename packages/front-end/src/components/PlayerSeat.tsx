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

export function PlayerSeat({ player }: { player: Player }) {
  const seatClass = [
    styles.seat,
    player.isActive ? styles.active : "",
    player.isFolded ? styles.folded : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={seatClass}>
      <div className={styles.avatarArea}>
        <div className={styles.avatar}>
          {player.avatar ? (
            <img
              src={player.avatar}
              alt={player.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            getInitials(player.name)
          )}
        </div>
        {player.isDealer && <div className={styles.dealerButton}>D</div>}
      </div>
      <span className={styles.name}>{player.name}</span>
      <div className={styles.cards}>
        {player.isFolded ? null : player.cards ? (
          <>
            <PlayingCard card={player.cards[0]} />
            <PlayingCard card={player.cards[1]} />
          </>
        ) : (
          <>
            <PlayingCard card={null} />
            <PlayingCard card={null} />
          </>
        )}
      </div>
      <ChipStackDisplay amount={player.chips} />
    </div>
  );
}
