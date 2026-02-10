export const gameStateTypeDefs = /* GraphQL */ `
  type HandCardInfo {
    playerId: ID!
    cards: [CardInfo!]!
  }

  type PlayerMetaInfo {
    id: ID!
    ttsVoice: String
    avatarUrl: String
  }

  type ProctorGameState {
    channelKey: String!
    status: String
    gameId: ID
    handNumber: Int!
    phase: String
    button: Int
    smallBlind: Int!
    bigBlind: Int!
    players: [PlayerInfo!]!
    communityCards: [CardInfo!]!
    pots: [PotInfo!]!
    hands: [HandCardInfo!]!
    playerMeta: [PlayerMetaInfo!]!
    lastInstruction: RenderInstruction
  }

  extend type Query {
    getChannelState(channelKey: String!): ProctorGameState!
  }
`;
