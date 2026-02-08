import {
  createSession,
  getSession,
  stopSession,
} from "../../../session-manager.js";
import type {
  MutationResolvers,
  QueryResolvers,
  SessionStatus,
} from "../../resolverTypes.js";

const getSessionQuery: QueryResolvers["getSession"] = (
  _parent,
  { channelKey },
) => {
  const session = getSession(channelKey);
  if (!session) return null;
  return {
    channelKey: session.channelKey,
    gameId: session.gameId,
    status: session.status as SessionStatus,
    handNumber: session.handNumber,
    players: session.players,
  };
};

const startSessionMutation: MutationResolvers["startSession"] = (
  _parent,
  { channelKey, config },
) => {
  const session = createSession(channelKey, config);
  return {
    channelKey: session.channelKey,
    gameId: session.gameId,
    status: session.status as SessionStatus,
    handNumber: session.handNumber,
    players: session.players,
  };
};

const stopSessionMutation: MutationResolvers["stopSession"] = (
  _parent,
  { channelKey },
) => {
  stopSession(channelKey);
  return true;
};

export const channelResolvers = {
  Query: { getSession: getSessionQuery },
  Mutation: {
    startSession: startSessionMutation,
    stopSession: stopSessionMutation,
  },
};
