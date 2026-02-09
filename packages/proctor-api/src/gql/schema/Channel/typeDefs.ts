export const channelTypeDefs = /* GraphQL */ `
  input AgentConfig {
    playerId: ID!
    name: String!
    modelId: String!
    modelName: String!
    provider: String!
    avatarUrl: String
    ttsVoice: String
    temperature: Float
  }

  input SessionConfig {
    players: [AgentConfig!]!
    startingChips: Int!
    smallBlind: Int!
    bigBlind: Int!
    handsPerGame: Int
  }

  type SessionPlayer {
    id: ID!
    name: String!
    chips: Int!
    modelId: String!
    modelName: String!
    provider: String!
  }

  enum SessionStatus {
    RUNNING
    STOPPED
    FINISHED
  }

  type Session {
    channelKey: String!
    gameId: ID
    status: SessionStatus!
    handNumber: Int!
    players: [SessionPlayer!]!
  }

  extend type Query {
    getSession(channelKey: String!): Session
  }

  extend type Mutation {
    startSession(channelKey: String!, config: SessionConfig!): Session!
    runSession(channelKey: String!): Boolean!
    stopSession(channelKey: String!): Boolean!
  }
`;
