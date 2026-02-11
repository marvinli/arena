import { formatChips } from "../../chips";
import type { Player } from "../../types";
import styles from "./PokerLeaderboardPage.module.css";

export function PokerLeaderboardPage({
  players,
  handNumber,
  smallBlind,
  bigBlind,
}: {
  players: Player[];
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
}) {
  const sorted = [...players].sort((a, b) => b.chips - a.chips);

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <h2 className={styles.title}>Leaderboard</h2>
        <p className={styles.subtitle}>
          After hand {handNumber} &middot; Blinds {smallBlind}/{bigBlind}
        </p>
        <ol className={styles.list}>
          {sorted.map((player, i) => (
            <li key={player.id} className={styles.row}>
              <span className={styles.rank}>{i + 1}</span>
              <span className={styles.name}>{player.name}</span>
              <span className={styles.chips}>{formatChips(player.chips)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
