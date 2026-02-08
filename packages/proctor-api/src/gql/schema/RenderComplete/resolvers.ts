import { recordRenderComplete } from "../../../session-manager.js";
import type { MutationResolvers } from "../../resolverTypes.js";

const renderComplete: MutationResolvers["renderComplete"] = (
  _parent,
  { channelKey, instructionId },
) => {
  recordRenderComplete(channelKey, instructionId);
  return true;
};

export const renderCompleteResolvers = {
  Mutation: { renderComplete },
};
