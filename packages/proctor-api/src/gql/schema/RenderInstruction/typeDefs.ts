export const renderInstructionTypeDefs = /* GraphQL */ `
  enum InstructionType {
    GAME_START
    DEAL_HANDS
    DEAL_COMMUNITY
    PLAYER_TURN
    PLAYER_ANALYSIS
    PLAYER_ACTION
    HAND_RESULT
    LEADERBOARD
    GAME_OVER
  }

  type PlayerInfo {
    id: ID!
    name: String!
    chips: Int!
    bet: Int!
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

  type PlayerMeta {
    id: ID!
    ttsVoice: String
    avatarUrl: String
  }

  type GameStartPayload {
    gameId: ID!
    players: [PlayerInfo!]!
    playerMeta: [PlayerMeta!]!
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

  type PlayerTurnPayload {
    playerId: ID!
    playerName: String!
  }

  type PlayerAnalysisPayload {
    playerId: ID!
    playerName: String!
    analysis: String!
  }

  type PlayerActionPayload {
    playerId: ID!
    playerName: String!
    action: String!
    amount: Int
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
    playerTurn: PlayerTurnPayload
    playerAnalysis: PlayerAnalysisPayload
    playerAction: PlayerActionPayload
    handResult: HandResultPayload
    leaderboard: LeaderboardPayload
    gameOver: GameOverPayload
  }

  extend type Subscription {
    renderInstructions(channelKey: String!): RenderInstruction!
  }
`;
