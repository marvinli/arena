import type { PlayerMeta, PlayerMetaInfo } from "../graphql/generated";
import type { Card, Player, Pot } from "../types";
import type { GqlCardInfo, GqlPlayerInfo, GqlPotInfo } from "./types";

export function mapPots(gqlPots: GqlPotInfo[]): Pot[] {
  return gqlPots.map((p, i) => ({
    label: i === 0 ? "Main Pot" : `Side Pot ${i}`,
    amount: p.size,
  }));
}

export function mapCard(c: GqlCardInfo): Card {
  return { rank: c.rank, suit: c.suit as Card["suit"] };
}

export function mapPlayer(
  info: GqlPlayerInfo,
  button: number | null,
  existing?: Player,
): Player {
  return {
    id: info.id,
    name: existing?.name ?? info.name,
    chips: info.chips,
    avatar: existing?.avatar ?? "",
    persona: existing?.persona ?? null,
    seatIndex: info.seatIndex,
    cards: existing?.cards ?? null,
    isDealer: info.seatIndex === button,
    isFolded: info.status === "FOLDED",
    isActive: existing?.isActive ?? false,
    isAllIn: info.status === "ALL_IN",
    isWinner: false,
    winAmount: null,
    winHand: null,
    lastAction: existing?.lastAction ?? null,
    currentBet: info.bet,
  };
}

export function mapPlayers(
  infos: GqlPlayerInfo[],
  button: number | null,
  existingPlayers: Player[],
): Player[] {
  const existingMap = new Map(existingPlayers.map((p) => [p.id, p]));
  const sorted = [...infos].sort((a, b) => a.seatIndex - b.seatIndex);
  return sorted.map((info) =>
    mapPlayer(info, button, existingMap.get(info.id)),
  );
}

/** Build avatar, persona, and voice maps from player metadata. */
export function buildPlayerMetaMaps(
  playerMeta: Pick<
    PlayerMeta | PlayerMetaInfo,
    "id" | "avatarUrl" | "persona" | "ttsVoice"
  >[],
): {
  avatars: Map<string, string>;
  personas: Map<string, string | null>;
  voices: Map<string, string>;
} {
  const avatars = new Map<string, string>();
  const personas = new Map<string, string | null>();
  const voices = new Map<string, string>();
  for (const m of playerMeta) {
    avatars.set(m.id, m.avatarUrl ?? "");
    personas.set(m.id, m.persona ?? null);
    if (m.ttsVoice) voices.set(m.id, m.ttsVoice);
  }
  return { avatars, personas, voices };
}
