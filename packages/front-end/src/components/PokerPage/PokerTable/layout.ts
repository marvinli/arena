// ── Bet indicator positioning constants ──────────────────
export const BET_MAX_STEP = 0.42;
export const BET_PULL_DISTANCE = 16;
export const TOP_ROW_SEATS: readonly number[] = [3, 4, 5, 6];
export const SIDE_SEATS: readonly number[] = [2, 7];
export const TOP_ROW_Y_NUDGE = 6;
export const SIDE_ROW_Y_NUDGE = -3;

/** Fallback seat colors when the player avatar isn't a known brand. */
export const SEAT_COLORS = [
  "#5eead4",
  "#fb923c",
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#facc15",
  "#34d399",
  "#f87171",
  "#818cf8",
];

/**
 * Seat positions as percentage coordinates on a 16 : 9 ellipse.
 * Index 0 = bottom-center, ascending clockwise (9 seats, 40° apart).
 */
export const SEAT_POSITIONS: { x: number; y: number }[] = [
  { x: 50, y: 92 },
  { x: 22, y: 82 },
  { x: 7, y: 56 },
  { x: 12, y: 28 },
  { x: 35, y: 9 },
  { x: 65, y: 9 },
  { x: 88, y: 28 },
  { x: 93, y: 56 },
  { x: 78, y: 82 },
];
