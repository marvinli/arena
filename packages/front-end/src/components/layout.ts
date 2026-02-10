// ── Table layout constants ──────────────────────────────

export const SEAT_COLORS = [
  "#e05c5c",
  "#5cb8e0",
  "#e0a05c",
  "#5ce08a",
  "#c05ce0",
  "#e05ca0",
  "#5ce0d4",
  "#e0d45c",
  "#5c6ee0",
  "#e07c5c",
];

/**
 * 10-seat positions as percentages of the 16:9 container.
 * Evenly distributed around an ellipse, clockwise from bottom center.
 */
const SEAT_COUNT = 10;

export const SEAT_POSITIONS: { x: number; y: number }[] = Array.from(
  { length: SEAT_COUNT },
  (_, i) => {
    const angle = Math.PI / 2 + (i * 2 * Math.PI) / SEAT_COUNT;
    return {
      x: Math.round((50 + 36 * Math.cos(angle)) * 10) / 10,
      y: Math.round((50 + 38 * Math.sin(angle)) * 10) / 10,
    };
  },
);
