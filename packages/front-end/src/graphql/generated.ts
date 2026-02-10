export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type ActionRecord = {
  __typename?: 'ActionRecord';
  action: Scalars['String']['output'];
  amount: Maybe<Scalars['Int']['output']>;
  playerId: Scalars['ID']['output'];
};

export type ActionType =
  | 'BET'
  | 'CALL'
  | 'CHECK'
  | 'FOLD'
  | 'RAISE';

export type Card = {
  __typename?: 'Card';
  rank: Scalars['String']['output'];
  suit: Scalars['String']['output'];
};

export type CardInfo = {
  __typename?: 'CardInfo';
  rank: Scalars['String']['output'];
  suit: Scalars['String']['output'];
};

export type ChannelConnection = {
  __typename?: 'ChannelConnection';
  gameState: Maybe<ProctorGameState>;
  moduleId: Scalars['String']['output'];
  moduleType: Scalars['String']['output'];
};

export type CreateGameInput = {
  bigBlind: Scalars['Int']['input'];
  players: Array<PlayerInput>;
  smallBlind: Scalars['Int']['input'];
};

export type DealCommunityPayload = {
  __typename?: 'DealCommunityPayload';
  communityCards: Array<CardInfo>;
  phase: Scalars['String']['output'];
  pots: Array<PotInfo>;
};

export type DealHandsPayload = {
  __typename?: 'DealHandsPayload';
  button: Maybe<Scalars['Int']['output']>;
  handNumber: Scalars['Int']['output'];
  hands: Array<PlayerHand>;
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
};

export type GameOverPayload = {
  __typename?: 'GameOverPayload';
  handsPlayed: Scalars['Int']['output'];
  players: Array<PlayerInfo>;
  winnerId: Scalars['ID']['output'];
  winnerName: Scalars['String']['output'];
};

export type GamePhase =
  | 'FLOP'
  | 'PREFLOP'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'TURN'
  | 'WAITING';

export type GameStartPayload = {
  __typename?: 'GameStartPayload';
  bigBlind: Scalars['Int']['output'];
  gameId: Scalars['ID']['output'];
  playerMeta: Array<PlayerMeta>;
  players: Array<PlayerInfo>;
  smallBlind: Scalars['Int']['output'];
};

export type GameState = {
  __typename?: 'GameState';
  button: Maybe<Scalars['Int']['output']>;
  communityCards: Array<Card>;
  currentPlayerId: Maybe<Scalars['ID']['output']>;
  gameId: Scalars['ID']['output'];
  handNumber: Scalars['Int']['output'];
  phase: GamePhase;
  players: Array<Player>;
  pots: Array<Pot>;
};

export type HandCardInfo = {
  __typename?: 'HandCardInfo';
  cards: Array<CardInfo>;
  playerId: Scalars['ID']['output'];
};

export type HandRecord = {
  __typename?: 'HandRecord';
  actions: Array<PhaseActions>;
  communityCards: Array<Card>;
  handNumber: Scalars['Int']['output'];
  players: Array<HandRecordPlayer>;
  pots: Array<Pot>;
  winners: Array<HandWinner>;
};

export type HandRecordPlayer = {
  __typename?: 'HandRecordPlayer';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  startingChips: Scalars['Int']['output'];
};

export type HandResultPayload = {
  __typename?: 'HandResultPayload';
  communityCards: Array<CardInfo>;
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
  winners: Array<WinnerInfo>;
};

export type HandWinner = {
  __typename?: 'HandWinner';
  amount: Scalars['Int']['output'];
  hand: Maybe<Scalars['String']['output']>;
  playerId: Scalars['ID']['output'];
};

export type InstructionType =
  | 'DEAL_COMMUNITY'
  | 'DEAL_HANDS'
  | 'GAME_OVER'
  | 'GAME_START'
  | 'HAND_RESULT'
  | 'LEADERBOARD'
  | 'PLAYER_ACTION'
  | 'PLAYER_ANALYSIS'
  | 'PLAYER_TURN';

export type LeaderboardPayload = {
  __typename?: 'LeaderboardPayload';
  handsPlayed: Scalars['Int']['output'];
  players: Array<PlayerInfo>;
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty: Maybe<Scalars['String']['output']>;
  advanceGame: GameState;
  completeInstruction: Scalars['Boolean']['output'];
  createGame: GameState;
  startHand: GameState;
  startModule: Scalars['Boolean']['output'];
  stopSession: Scalars['Boolean']['output'];
  submitAction: GameState;
};


export type MutationAdvanceGameArgs = {
  gameId: Scalars['ID']['input'];
};


export type MutationCompleteInstructionArgs = {
  channelKey: Scalars['String']['input'];
  instructionId: Scalars['String']['input'];
  moduleId: Scalars['String']['input'];
};


export type MutationCreateGameArgs = {
  input: CreateGameInput;
};


export type MutationStartHandArgs = {
  gameId: Scalars['ID']['input'];
};


export type MutationStartModuleArgs = {
  channelKey: Scalars['String']['input'];
};


export type MutationStopSessionArgs = {
  channelKey: Scalars['String']['input'];
};


export type MutationSubmitActionArgs = {
  action: SubmitActionInput;
  gameId: Scalars['ID']['input'];
};

export type MyTurnResponse = {
  __typename?: 'MyTurnResponse';
  gameState: GameState;
  myHand: Array<Card>;
  validActions: Array<ValidAction>;
};

export type PhaseActions = {
  __typename?: 'PhaseActions';
  actions: Array<ActionRecord>;
  phase: Scalars['String']['output'];
};

export type Player = {
  __typename?: 'Player';
  bet: Scalars['Int']['output'];
  chips: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  seatIndex: Scalars['Int']['output'];
  status: PlayerStatus;
};

export type PlayerActionPayload = {
  __typename?: 'PlayerActionPayload';
  action: Scalars['String']['output'];
  amount: Maybe<Scalars['Int']['output']>;
  playerId: Scalars['ID']['output'];
  playerName: Scalars['String']['output'];
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
};

export type PlayerAnalysisPayload = {
  __typename?: 'PlayerAnalysisPayload';
  analysis: Scalars['String']['output'];
  isApiError: Scalars['Boolean']['output'];
  playerId: Scalars['ID']['output'];
  playerName: Scalars['String']['output'];
};

export type PlayerHand = {
  __typename?: 'PlayerHand';
  cards: Array<CardInfo>;
  playerId: Scalars['ID']['output'];
};

export type PlayerInfo = {
  __typename?: 'PlayerInfo';
  bet: Scalars['Int']['output'];
  chips: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  seatIndex: Scalars['Int']['output'];
  status: Scalars['String']['output'];
};

export type PlayerInput = {
  chips: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type PlayerMeta = {
  __typename?: 'PlayerMeta';
  avatarUrl: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  ttsVoice: Maybe<Scalars['String']['output']>;
};

export type PlayerMetaInfo = {
  __typename?: 'PlayerMetaInfo';
  avatarUrl: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  ttsVoice: Maybe<Scalars['String']['output']>;
};

export type PlayerStatus =
  | 'ACTIVE'
  | 'ALL_IN'
  | 'BUSTED'
  | 'FOLDED';

export type PlayerTurnPayload = {
  __typename?: 'PlayerTurnPayload';
  playerId: Scalars['ID']['output'];
  playerName: Scalars['String']['output'];
};

export type Pot = {
  __typename?: 'Pot';
  eligiblePlayerIds: Array<Scalars['ID']['output']>;
  size: Scalars['Int']['output'];
};

export type PotInfo = {
  __typename?: 'PotInfo';
  eligiblePlayerIds: Array<Scalars['ID']['output']>;
  size: Scalars['Int']['output'];
};

export type ProctorGameState = {
  __typename?: 'ProctorGameState';
  bigBlind: Scalars['Int']['output'];
  button: Maybe<Scalars['Int']['output']>;
  channelKey: Scalars['String']['output'];
  communityCards: Array<CardInfo>;
  gameId: Maybe<Scalars['ID']['output']>;
  handNumber: Scalars['Int']['output'];
  hands: Array<HandCardInfo>;
  lastInstruction: Maybe<RenderInstruction>;
  phase: Maybe<Scalars['String']['output']>;
  playerMeta: Array<PlayerMetaInfo>;
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
  smallBlind: Scalars['Int']['output'];
  status: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  _empty: Maybe<Scalars['String']['output']>;
  connect: ChannelConnection;
  getChannelState: ProctorGameState;
  getGameState: GameState;
  getHistory: Array<HandRecord>;
  getMyTurn: MyTurnResponse;
  getSession: Maybe<Session>;
};


export type QueryConnectArgs = {
  channelKey: Scalars['String']['input'];
};


export type QueryGetChannelStateArgs = {
  channelKey: Scalars['String']['input'];
};


export type QueryGetGameStateArgs = {
  gameId: Scalars['ID']['input'];
};


export type QueryGetHistoryArgs = {
  gameId: Scalars['ID']['input'];
  lastN: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetMyTurnArgs = {
  gameId: Scalars['ID']['input'];
};


export type QueryGetSessionArgs = {
  channelKey: Scalars['String']['input'];
};

export type RenderInstruction = {
  __typename?: 'RenderInstruction';
  dealCommunity: Maybe<DealCommunityPayload>;
  dealHands: Maybe<DealHandsPayload>;
  gameOver: Maybe<GameOverPayload>;
  gameStart: Maybe<GameStartPayload>;
  handResult: Maybe<HandResultPayload>;
  instructionId: Scalars['ID']['output'];
  leaderboard: Maybe<LeaderboardPayload>;
  moduleId: Scalars['String']['output'];
  playerAction: Maybe<PlayerActionPayload>;
  playerAnalysis: Maybe<PlayerAnalysisPayload>;
  playerTurn: Maybe<PlayerTurnPayload>;
  timestamp: Scalars['String']['output'];
  type: InstructionType;
};

export type Session = {
  __typename?: 'Session';
  channelKey: Scalars['String']['output'];
  gameId: Maybe<Scalars['ID']['output']>;
  handNumber: Scalars['Int']['output'];
  players: Array<SessionPlayer>;
  status: SessionStatus;
};

export type SessionPlayer = {
  __typename?: 'SessionPlayer';
  chips: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  modelId: Scalars['String']['output'];
  modelName: Scalars['String']['output'];
  name: Scalars['String']['output'];
  provider: Scalars['String']['output'];
};

export type SessionStatus =
  | 'FINISHED'
  | 'RUNNING'
  | 'STOPPED';

export type SubmitActionInput = {
  amount: InputMaybe<Scalars['Int']['input']>;
  type: ActionType;
};

export type Subscription = {
  __typename?: 'Subscription';
  _empty: Maybe<Scalars['String']['output']>;
  renderInstructions: RenderInstruction;
};


export type SubscriptionRenderInstructionsArgs = {
  channelKey: Scalars['String']['input'];
};

export type ValidAction = {
  __typename?: 'ValidAction';
  amount: Maybe<Scalars['Int']['output']>;
  max: Maybe<Scalars['Int']['output']>;
  min: Maybe<Scalars['Int']['output']>;
  type: ActionType;
};

export type WinnerInfo = {
  __typename?: 'WinnerInfo';
  amount: Scalars['Int']['output'];
  hand: Maybe<Scalars['String']['output']>;
  playerId: Scalars['ID']['output'];
};

export type ConnectQueryVariables = Exact<{
  channelKey: Scalars['String']['input'];
}>;


export type ConnectQuery = { __typename?: 'Query', connect: { __typename?: 'ChannelConnection', moduleId: string, moduleType: string, gameState: { __typename?: 'ProctorGameState', status: string | null, gameId: string | null, handNumber: number, phase: string | null, button: number | null, smallBlind: number, bigBlind: number, players: Array<{ __typename?: 'PlayerInfo', id: string, name: string, chips: number, bet: number, status: string, seatIndex: number }>, communityCards: Array<{ __typename?: 'CardInfo', rank: string, suit: string }>, pots: Array<{ __typename?: 'PotInfo', size: number, eligiblePlayerIds: Array<string> }>, hands: Array<{ __typename?: 'HandCardInfo', playerId: string, cards: Array<{ __typename?: 'CardInfo', rank: string, suit: string }> }>, playerMeta: Array<{ __typename?: 'PlayerMetaInfo', id: string, ttsVoice: string | null, avatarUrl: string | null }> } | null } };

export type StartModuleMutationVariables = Exact<{
  channelKey: Scalars['String']['input'];
}>;


export type StartModuleMutation = { __typename?: 'Mutation', startModule: boolean };

export type StopSessionMutationVariables = Exact<{
  channelKey: Scalars['String']['input'];
}>;


export type StopSessionMutation = { __typename?: 'Mutation', stopSession: boolean };

export type CompleteInstructionMutationVariables = Exact<{
  channelKey: Scalars['String']['input'];
  moduleId: Scalars['String']['input'];
  instructionId: Scalars['String']['input'];
}>;


export type CompleteInstructionMutation = { __typename?: 'Mutation', completeInstruction: boolean };

export type GetChannelStateQueryVariables = Exact<{
  channelKey: Scalars['String']['input'];
}>;


export type GetChannelStateQuery = { __typename?: 'Query', getChannelState: { __typename?: 'ProctorGameState', status: string | null, gameId: string | null, handNumber: number, phase: string | null, button: number | null, smallBlind: number, bigBlind: number, players: Array<{ __typename?: 'PlayerInfo', id: string, name: string, chips: number, bet: number, status: string, seatIndex: number }>, communityCards: Array<{ __typename?: 'CardInfo', rank: string, suit: string }>, pots: Array<{ __typename?: 'PotInfo', size: number, eligiblePlayerIds: Array<string> }>, hands: Array<{ __typename?: 'HandCardInfo', playerId: string, cards: Array<{ __typename?: 'CardInfo', rank: string, suit: string }> }>, playerMeta: Array<{ __typename?: 'PlayerMetaInfo', id: string, ttsVoice: string | null, avatarUrl: string | null }> } };

export type RenderInstructionsSubscriptionVariables = Exact<{
  channelKey: Scalars['String']['input'];
}>;


export type RenderInstructionsSubscription = { __typename?: 'Subscription', renderInstructions: { __typename?: 'RenderInstruction', instructionId: string, moduleId: string, type: InstructionType, timestamp: string, gameStart: { __typename?: 'GameStartPayload', gameId: string, smallBlind: number, bigBlind: number, players: Array<{ __typename?: 'PlayerInfo', id: string, name: string, chips: number, bet: number, status: string, seatIndex: number }>, playerMeta: Array<{ __typename?: 'PlayerMeta', id: string, ttsVoice: string | null, avatarUrl: string | null }> } | null, dealHands: { __typename?: 'DealHandsPayload', handNumber: number, button: number | null, players: Array<{ __typename?: 'PlayerInfo', id: string, name: string, chips: number, bet: number, status: string, seatIndex: number }>, hands: Array<{ __typename?: 'PlayerHand', playerId: string, cards: Array<{ __typename?: 'CardInfo', rank: string, suit: string }> }>, pots: Array<{ __typename?: 'PotInfo', size: number, eligiblePlayerIds: Array<string> }> } | null, dealCommunity: { __typename?: 'DealCommunityPayload', phase: string, communityCards: Array<{ __typename?: 'CardInfo', rank: string, suit: string }>, pots: Array<{ __typename?: 'PotInfo', size: number, eligiblePlayerIds: Array<string> }> } | null, playerTurn: { __typename?: 'PlayerTurnPayload', playerId: string, playerName: string } | null, playerAnalysis: { __typename?: 'PlayerAnalysisPayload', playerId: string, playerName: string, analysis: string, isApiError: boolean } | null, playerAction: { __typename?: 'PlayerActionPayload', playerId: string, playerName: string, action: string, amount: number | null, pots: Array<{ __typename?: 'PotInfo', size: number, eligiblePlayerIds: Array<string> }>, players: Array<{ __typename?: 'PlayerInfo', id: string, name: string, chips: number, bet: number, status: string, seatIndex: number }> } | null, handResult: { __typename?: 'HandResultPayload', winners: Array<{ __typename?: 'WinnerInfo', playerId: string, amount: number, hand: string | null }>, pots: Array<{ __typename?: 'PotInfo', size: number, eligiblePlayerIds: Array<string> }>, players: Array<{ __typename?: 'PlayerInfo', id: string, name: string, chips: number, bet: number, status: string, seatIndex: number }>, communityCards: Array<{ __typename?: 'CardInfo', rank: string, suit: string }> } | null, leaderboard: { __typename?: 'LeaderboardPayload', handsPlayed: number, players: Array<{ __typename?: 'PlayerInfo', id: string, name: string, chips: number, bet: number, status: string, seatIndex: number }> } | null, gameOver: { __typename?: 'GameOverPayload', winnerId: string, winnerName: string, handsPlayed: number, players: Array<{ __typename?: 'PlayerInfo', id: string, name: string, chips: number, bet: number, status: string, seatIndex: number }> } | null } };
