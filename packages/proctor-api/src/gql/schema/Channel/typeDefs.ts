export const channelTypeDefs = /* GraphQL */ `
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

  type ChannelConnection {
    moduleId: String!
    moduleType: String!
    gameState: ProctorGameState
  }

  extend type Query {
    getSession(channelKey: String!): Session
    connect(channelKey: String!): ChannelConnection!
    live: Boolean!
  }

  extend type Mutation {
    startModule(channelKey: String!): Boolean!
    completeInstruction(channelKey: String!, moduleId: String!, instructionId: String!): Boolean!
    stopSession(channelKey: String!): Boolean!
    setLive(live: Boolean!): Boolean!
    resetDatabase: Boolean!
  }
`;
