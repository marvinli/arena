export interface Context {
  playerId: string | null;
}

export function requirePlayerId(ctx: Context): string {
  if (!ctx.playerId) {
    throw new Error("Missing X-Player-Id header");
  }
  return ctx.playerId;
}
