import type {
  CardInfo,
  GetChannelStateQuery,
  PlayerInfo,
  PotInfo,
  RenderInstructionsSubscription,
} from "../graphql/generated";

export type GqlInstruction =
  RenderInstructionsSubscription["renderInstructions"] & {
    moduleId?: string;
  };
export type GqlChannelState = GetChannelStateQuery["getChannelState"];
export type GqlPlayerInfo = PlayerInfo;
export type GqlCardInfo = CardInfo;
export type GqlPotInfo = PotInfo;
