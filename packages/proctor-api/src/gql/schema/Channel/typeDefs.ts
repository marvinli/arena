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

  extend type Query {
    getSession(channelKey: String!): Session
  }

  extend type Mutation {
    startSession(channelKey: String!): Session!
    runSession(channelKey: String!): Boolean!
    stopSession(channelKey: String!): Boolean!
  }
`;
