import { LlmAgentRunner } from "../../../services/games/poker/llm-agent-runner.js";
import { runSession } from "../../../services/games/poker/orchestrator/index.js";
import {
  createSession,
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

const runSessionMutation: MutationResolvers["runSession"] = (
  _parent,
  { channelKey },
) => {
  const session = getSession(channelKey);
  if (!session) throw new Error(`Session not found: ${channelKey}`);
  if (session.gameId) throw new Error(`Session already running: ${channelKey}`);

  void runSession(session, new LlmAgentRunner()).catch((err) => {
    console.error("[runSession] orchestrator failed:", err);
  });

  return true;
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
    runSession: runSessionMutation,
    stopSession: stopSessionMutation,
  },
};
