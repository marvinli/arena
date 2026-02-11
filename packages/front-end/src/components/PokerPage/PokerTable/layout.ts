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
  "#e879f9",
];

/**
 * Seat positions as percentage coordinates on a 16 : 9 ellipse.
 * Index 0 = bottom-center, ascending clockwise.
 */
export const SEAT_POSITIONS: { x: number; y: number }[] = [
  { x: 50, y: 92 },
  { x: 22, y: 82 },
  { x: 6, y: 60 },
  { x: 6, y: 33 },
  { x: 22, y: 14 },
  { x: 50, y: 6 },
  { x: 78, y: 14 },
  { x: 94, y: 33 },
  { x: 94, y: 60 },
  { x: 78, y: 82 },
];
