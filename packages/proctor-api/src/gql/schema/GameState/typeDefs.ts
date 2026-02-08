export const gameStateTypeDefs = /* GraphQL */ `
  type ProctorGameState {
    channelKey: String!
    gameId: ID
    handNumber: Int!
    phase: String
    players: [PlayerInfo!]!
    communityCards: [CardInfo!]!
    pots: [PotInfo!]!
    lastInstruction: RenderInstruction
  }

  extend type Query {
    getChannelState(channelKey: String!): ProctorGameState!
  }
`;
