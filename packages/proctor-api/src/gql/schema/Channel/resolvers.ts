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

const connectQuery: QueryResolvers["connect"] = async (
  _parent,
  { channelKey },
) => {
  return connect(channelKey);
};

const startModuleMutation: MutationResolvers["startModule"] = async (
  _parent,
  { channelKey },
) => {
  await setSetting("live", "true");

  // Idempotent — runProgrammingLoop returns immediately if already active
  void runProgrammingLoop(channelKey).catch((err) => {
    logError(
      "startModule",
      "programming loop failed:",
      err instanceof Error ? err.message : String(err),
    );
  });

  return true;
};

const completeInstructionMutation: MutationResolvers["completeInstruction"] =
  async (_parent, { channelKey, moduleId, instructionId }) => {
    return completeInstruction(channelKey, moduleId, instructionId);
  };

const stopSessionMutation: MutationResolvers["stopSession"] = (
  _parent,
  { channelKey },
) => {
  stopSession(channelKey);
  return true;
};

const liveQuery: QueryResolvers["live"] = async () => {
  return (await getSetting("live")) === "true";
};

const setLiveMutation: MutationResolvers["setLive"] = async (
  _parent,
  { live },
) => {
  await setSetting("live", String(live));
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
