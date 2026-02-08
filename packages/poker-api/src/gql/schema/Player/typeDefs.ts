export const playerTypeDefs = /* GraphQL */ `
  type Player {
    id: ID!
    name: String!
    chips: Int!
    bet: Int!
    status: PlayerStatus!
    seatIndex: Int!
  }

  enum PlayerStatus {
    ACTIVE
    FOLDED
    ALL_IN
    BUSTED
  }

  type ValidAction {
    type: ActionType!
    amount: Int
    min: Int
    max: Int
  }

  enum ActionType {
    FOLD
    CHECK
    CALL
    BET
    RAISE
  }

  type MyTurnResponse {
    gameState: GameState!
    myHand: [Card!]!
    validActions: [ValidAction!]!
  }

  input SubmitActionInput {
    type: ActionType!
    amount: Int
  }

  extend type Query {
    getMyTurn(gameId: ID!): MyTurnResponse!
  }

  extend type Mutation {
    submitAction(gameId: ID!, action: SubmitActionInput!): GameState!
  }
`;
