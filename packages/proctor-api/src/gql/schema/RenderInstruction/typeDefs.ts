export const renderInstructionTypeDefs = /* GraphQL */ `
  enum InstructionType {
    GAME_START
    DEAL_HANDS
    DEAL_COMMUNITY
    PLAYER_ACTION
    HAND_RESULT
    LEADERBOARD
    GAME_OVER
  }

  type PlayerInfo {
    id: ID!
    name: String!
    chips: Int!
    status: String!
    seatIndex: Int!
  }

  type CardInfo {
    rank: String!
    suit: String!
  }

  type PotInfo {
    size: Int!
    eligiblePlayerIds: [ID!]!
  }

  type WinnerInfo {
    playerId: ID!
    amount: Int!
    hand: String
  }

  type GameStartPayload {
    gameId: ID!
    players: [PlayerInfo!]!
    smallBlind: Int!
    bigBlind: Int!
  }

  type PlayerHand {
    playerId: ID!
    cards: [CardInfo!]!
  }

  type DealHandsPayload {
    handNumber: Int!
    players: [PlayerInfo!]!
    hands: [PlayerHand!]!
    button: Int
    pots: [PotInfo!]!
  }

  type DealCommunityPayload {
    phase: String!
    communityCards: [CardInfo!]!
    pots: [PotInfo!]!
  }

  type PlayerActionPayload {
    playerId: ID!
    playerName: String!
    action: String!
    amount: Int
    analysis: String
    pots: [PotInfo!]!
    players: [PlayerInfo!]!
  }

  type HandResultPayload {
    winners: [WinnerInfo!]!
    pots: [PotInfo!]!
    players: [PlayerInfo!]!
    communityCards: [CardInfo!]!
  }

  type LeaderboardPayload {
    players: [PlayerInfo!]!
    handsPlayed: Int!
  }

  type GameOverPayload {
    winnerId: ID!
    winnerName: String!
    players: [PlayerInfo!]!
    handsPlayed: Int!
  }

  type RenderInstruction {
    instructionId: ID!
    type: InstructionType!
    timestamp: String!
    gameStart: GameStartPayload
    dealHands: DealHandsPayload
    dealCommunity: DealCommunityPayload
    playerAction: PlayerActionPayload
    handResult: HandResultPayload
    leaderboard: LeaderboardPayload
    gameOver: GameOverPayload
  }

  extend type Subscription {
    renderInstructions(channelKey: String!): RenderInstruction!
  }
`;
