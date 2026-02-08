export const gameTypeDefs = /* GraphQL */ `
  type GameState {
    gameId: ID!
    phase: GamePhase!
    communityCards: [Card!]!
    players: [Player!]!
    pots: [Pot!]!
    currentPlayerId: ID
    handNumber: Int!
    button: Int
  }

  enum GamePhase {
    WAITING
    PREFLOP
    FLOP
    TURN
    RIVER
    SHOWDOWN
  }

  input PlayerInput {
    id: ID!
    name: String!
    chips: Int!
  }

  input CreateGameInput {
    players: [PlayerInput!]!
    smallBlind: Int!
    bigBlind: Int!
  }

  extend type Query {
    getGameState(gameId: ID!): GameState!
  }

  extend type Mutation {
    createGame(input: CreateGameInput!): GameState!
    startHand(gameId: ID!): GameState!
    advanceGame(gameId: ID!): GameState!
  }
`;
