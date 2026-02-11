import { logError } from "../../../logger.js";
import { getSetting, setSetting } from "../../../persistence.js";
import { runProgrammingLoop } from "../../../services/session/programming.js";
import {
  completeInstruction,
  connect,
  getSession,
  stopSession,
} from "../../../services/session/session-manager.js";
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

const connectQuery: QueryResolvers["connect"] = (_parent, { channelKey }) => {
  return connect(channelKey);
};

const startModuleMutation: MutationResolvers["startModule"] = (
  _parent,
  { channelKey },
) => {
  const session = getSession(channelKey);
  if (session) return true; // already running

  void runProgrammingLoop(channelKey).catch((err) => {
    logError(
      "startModule",
      "programming loop failed:",
      err instanceof Error ? err.message : String(err),
    );
  });

  return true;
};

const completeInstructionMutation: MutationResolvers["completeInstruction"] = (
  _parent,
  { channelKey, moduleId, instructionId },
) => {
  return completeInstruction(channelKey, moduleId, instructionId);
};

const stopSessionMutation: MutationResolvers["stopSession"] = (
  _parent,
  { channelKey },
) => {
  stopSession(channelKey);
  return true;
};

const liveQuery: QueryResolvers["live"] = () => {
  return getSetting("live") === "true";
};

const setLiveMutation: MutationResolvers["setLive"] = (_parent, { live }) => {
  setSetting("live", String(live));
  return live;
};

export const channelResolvers = {
  Query: {
    getSession: getSessionQuery,
    connect: connectQuery,
    live: liveQuery,
  },
  Mutation: {
    startModule: startModuleMutation,
    completeInstruction: completeInstructionMutation,
    stopSession: stopSessionMutation,
    setLive: setLiveMutation,
  },
};
