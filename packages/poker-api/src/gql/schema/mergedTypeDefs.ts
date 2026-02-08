import { mergeTypeDefs } from "@graphql-tools/merge";
import { baseTypeDefs } from "./base.js";
import { gameTypeDefs } from "./Game/typeDefs.js";
import { handTypeDefs } from "./Hand/typeDefs.js";
import { playerTypeDefs } from "./Player/typeDefs.js";

export const allTypeDefs = [
  baseTypeDefs,
  gameTypeDefs,
  playerTypeDefs,
  handTypeDefs,
];

export const mergedTypeDefs = mergeTypeDefs(allTypeDefs);
