// ── Animation timing constants ─────────────────────────
// Single source of truth shared by renderQueue, useDealAnimation, useCommunityDealAnimation.

export const DEAL_INTERVAL_MS = 150;
export const FLIP_PAUSE_MS = 300;
export const FLIP_DURATION_MS = 400;
export const ANIM_BUFFER_MS = 100;

// Display time for states that need to be visible before the next instruction
export const SHOWDOWN_DISPLAY_MS = 5000;
export const LEADERBOARD_DISPLAY_MS = 3000;

// Pause after a player action so viewers can see the bet/call chips
export const POST_ACTION_PAUSE_MS = 1500;

// Pause before showing hand result so viewers can see the final board
export const PRE_SHOWDOWN_PAUSE_MS = 2000;

export function dealAnimDuration(playerCount: number): number {
  if (playerCount <= 0) return 0;
  return (
    playerCount * 2 * DEAL_INTERVAL_MS +
    FLIP_PAUSE_MS +
    FLIP_DURATION_MS +
    ANIM_BUFFER_MS
  );
}

export function communityAnimDuration(newCardCount: number): number {
  if (newCardCount <= 0) return 0;
  return (
    newCardCount * DEAL_INTERVAL_MS +
    FLIP_PAUSE_MS +
    FLIP_DURATION_MS +
    ANIM_BUFFER_MS
  );
}
