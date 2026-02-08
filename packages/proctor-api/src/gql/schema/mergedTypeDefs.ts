import { mergeTypeDefs } from "@graphql-tools/merge";
import { baseTypeDefs } from "./base.js";
import { channelTypeDefs } from "./Channel/typeDefs.js";
import { gameStateTypeDefs } from "./GameState/typeDefs.js";
import { renderCompleteTypeDefs } from "./RenderComplete/typeDefs.js";
import { renderInstructionTypeDefs } from "./RenderInstruction/typeDefs.js";

export const allTypeDefs = [
  baseTypeDefs,
  channelTypeDefs,
  renderInstructionTypeDefs,
  gameStateTypeDefs,
  renderCompleteTypeDefs,
];

export const mergedTypeDefs = mergeTypeDefs(allTypeDefs);
