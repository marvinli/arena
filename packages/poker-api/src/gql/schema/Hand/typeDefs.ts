export const handTypeDefs = /* GraphQL */ `
  type ActionRecord {
    playerId: ID!
    action: String!
    amount: Int
  }

  type PhaseActions {
    phase: String!
    actions: [ActionRecord!]!
  }

  type HandWinner {
    playerId: ID!
    amount: Int!
    hand: String
  }

  type HandRecordPlayer {
    id: ID!
    name: String!
    startingChips: Int!
  }

  type HandRecord {
    handNumber: Int!
    players: [HandRecordPlayer!]!
    communityCards: [Card!]!
    actions: [PhaseActions!]!
    pots: [Pot!]!
    winners: [HandWinner!]!
  }

  extend type Query {
    getHistory(gameId: ID!, lastN: Int): [HandRecord!]!
  }
`;
