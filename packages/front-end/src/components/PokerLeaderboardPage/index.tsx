import { useEffect, useState } from "react";
import { ENDCARD_DISPLAY_MS } from "../../session/timing";
import type { GameAward, Player } from "../../types";
import {
  BRAND_COLORS,
  KNOWN_PROVIDERS,
  ProviderIcon,
} from "../shared/ProviderIcon";
import styles from "./PokerLeaderboardPage.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];

const AWARD_ICONS: Record<string, string> = {
  "Most Aggressive": "🧨",
  "Most Passive": "🕊️",
  Tightest: "🔒",
  Loosest: "🎰",
  Yolo: "💥",
  "Biggest Pot Won": "💰",
  "Most Hands Won": "👑",
  "Analysis Paralysis": "⏳",
  "Just Do It": "⚡",
  "Bounty Hunter": "🎯",
};

const AWARD_COLORS: Record<string, string> = {
  "Most Aggressive": "#FF6B6B",
  "Most Passive": "#5EEAD4",
  Tightest: "#FBBF24",
  Loosest: "#A3E635",
  Yolo: "#FB923C",
  "Biggest Pot Won": "#FFD700",
  "Most Hands Won": "#C084FC",
  "Analysis Paralysis": "#60A5FA",
  "Just Do It": "#FACC15",
  "Bounty Hunter": "#F87171",
};

function PlayerAvatar({ player }: { player: Player }) {
  const brandColor = BRAND_COLORS[player.avatar] ?? "#3b3f54";
  const ringStyle = { "--brand-color": brandColor } as React.CSSProperties;

  return (
    <div className={styles.avatarRing} style={ringStyle}>
      <div className={styles.avatar}>
        {player.avatar && !KNOWN_PROVIDERS.has(player.avatar) ? (
          <img
            src={player.avatar}
            alt={player.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <ProviderIcon
            avatar={player.avatar}
            style={{ width: "60%", height: "60%" }}
          />
        )}
      </div>
    </div>
  );
}

export function PokerLeaderboardPage({
  players,
  handNumber,
  smallBlind,
  bigBlind,
  awards,
  isFinished,
}: {
  players: Player[];
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  awards: GameAward[];
  isFinished: boolean;
}) {
  const sorted = [...players].sort((a, b) => b.chips - a.chips);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const [countdown, setCountdown] = useState(
    Math.ceil(ENDCARD_DISPLAY_MS / 1000),
  );

  useEffect(() => {
    if (!isFinished) return;
    setCountdown(Math.ceil(ENDCARD_DISPLAY_MS / 1000));
    const id = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isFinished]);

  if (isFinished) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.gameOverLayout}>
          <div className={styles.leftColumn}>
            <ol className={styles.playerList}>
              {sorted.map((player, i) => (
                <li key={player.id} className={styles.playerRow}>
                  <span className={styles.medal}>
                    {i < 3 ? MEDALS[i] : null}
                  </span>
                  <PlayerAvatar player={player} />
                  <span className={styles.playerName}>{player.name}</span>
                </li>
              ))}
            </ol>
          </div>

          {awards.length > 0 && (
            <div className={styles.rightColumn}>
              {awards.map((award) => (
                <div key={award.title} className={styles.awardCard}>
                  <span className={styles.awardIcon}>
                    {AWARD_ICONS[award.title] ?? "🏆"}
                  </span>
                  <div className={styles.awardInfo}>
                    <span
                      className={styles.awardTitle}
                      style={{ color: AWARD_COLORS[award.title] }}
                    >
                      {award.title}
                    </span>
                    <span className={styles.awardPlayerName}>
                      {award.playerNames.join(" & ")}
                    </span>
                    <span className={styles.awardDescription}>
                      {award.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {countdown > 0 && (
          <div className={styles.countdown}>
            <svg className={styles.countdownRing} viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(56,189,248,0.2)" strokeWidth="2.5" />
              <circle
                cx="16" cy="16" r="14"
                fill="none"
                stroke="rgba(56,189,248,0.85)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 14}
                strokeDashoffset={2 * Math.PI * 14 * (1 - countdown / Math.ceil(ENDCARD_DISPLAY_MS / 1000))}
                style={{ transition: "stroke-dashoffset 1s linear", transform: "rotate(-90deg)", transformOrigin: "center" }}
              />
            </svg>
            <span>Next game starting in {countdown}</span>
          </div>
        )}
      </div>
    );
  }

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
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
