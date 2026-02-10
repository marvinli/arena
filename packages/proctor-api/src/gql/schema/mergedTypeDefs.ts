import { mergeTypeDefs } from "@graphql-tools/merge";
import { baseTypeDefs } from "./base.js";
import { channelTypeDefs } from "./Channel/typeDefs.js";
import { gameTypeDefs } from "./Game/typeDefs.js";
import { gameStateTypeDefs } from "./GameState/typeDefs.js";
import { handTypeDefs } from "./Hand/typeDefs.js";
import { playerTypeDefs } from "./Player/typeDefs.js";
import { renderInstructionTypeDefs } from "./RenderInstruction/typeDefs.js";

export const allTypeDefs = [
  baseTypeDefs,
  channelTypeDefs,
  renderInstructionTypeDefs,
  gameStateTypeDefs,
  gameTypeDefs,
  playerTypeDefs,
  handTypeDefs,
];

export const mergedTypeDefs = mergeTypeDefs(allTypeDefs);
