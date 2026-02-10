import { GraphQLResolveInfo } from 'graphql';
import { Context } from './context.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
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
  amount?: Maybe<Scalars['Int']['output']>;
  playerId: Scalars['ID']['output'];
};

export enum ActionType {
  Bet = 'BET',
  Call = 'CALL',
  Check = 'CHECK',
  Fold = 'FOLD',
  Raise = 'RAISE'
}

export type AgentConfig = {
  avatarUrl?: InputMaybe<Scalars['String']['input']>;
  modelId: Scalars['String']['input'];
  modelName: Scalars['String']['input'];
  name: Scalars['String']['input'];
  playerId: Scalars['ID']['input'];
  provider: Scalars['String']['input'];
  temperature?: InputMaybe<Scalars['Float']['input']>;
  ttsVoice?: InputMaybe<Scalars['String']['input']>;
};

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
  button?: Maybe<Scalars['Int']['output']>;
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

export enum GamePhase {
  Flop = 'FLOP',
  Preflop = 'PREFLOP',
  River = 'RIVER',
  Showdown = 'SHOWDOWN',
  Turn = 'TURN',
  Waiting = 'WAITING'
}

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
  button?: Maybe<Scalars['Int']['output']>;
  communityCards: Array<Card>;
  currentPlayerId?: Maybe<Scalars['ID']['output']>;
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
  hand?: Maybe<Scalars['String']['output']>;
  playerId: Scalars['ID']['output'];
};

export enum InstructionType {
  DealCommunity = 'DEAL_COMMUNITY',
  DealHands = 'DEAL_HANDS',
  GameOver = 'GAME_OVER',
  GameStart = 'GAME_START',
  HandResult = 'HAND_RESULT',
  Leaderboard = 'LEADERBOARD',
  PlayerAction = 'PLAYER_ACTION',
  PlayerAnalysis = 'PLAYER_ANALYSIS',
  PlayerTurn = 'PLAYER_TURN'
}

export type LeaderboardPayload = {
  __typename?: 'LeaderboardPayload';
  handsPlayed: Scalars['Int']['output'];
  players: Array<PlayerInfo>;
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  advanceGame: GameState;
  createGame: GameState;
  renderComplete: Scalars['Boolean']['output'];
  runSession: Scalars['Boolean']['output'];
  startHand: GameState;
  startSession: Session;
  stopSession: Scalars['Boolean']['output'];
  submitAction: GameState;
};


export type MutationAdvanceGameArgs = {
  gameId: Scalars['ID']['input'];
};


export type MutationCreateGameArgs = {
  input: CreateGameInput;
};


export type MutationRenderCompleteArgs = {
  channelKey: Scalars['String']['input'];
  instructionId: Scalars['ID']['input'];
};


export type MutationRunSessionArgs = {
  channelKey: Scalars['String']['input'];
};


export type MutationStartHandArgs = {
  gameId: Scalars['ID']['input'];
};


export type MutationStartSessionArgs = {
  channelKey: Scalars['String']['input'];
  config: SessionConfig;
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
  amount?: Maybe<Scalars['Int']['output']>;
  playerId: Scalars['ID']['output'];
  playerName: Scalars['String']['output'];
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
};

export type PlayerAnalysisPayload = {
  __typename?: 'PlayerAnalysisPayload';
  analysis: Scalars['String']['output'];
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
  avatarUrl?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  ttsVoice?: Maybe<Scalars['String']['output']>;
};

export type PlayerMetaInfo = {
  __typename?: 'PlayerMetaInfo';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  ttsVoice?: Maybe<Scalars['String']['output']>;
};

export enum PlayerStatus {
  Active = 'ACTIVE',
  AllIn = 'ALL_IN',
  Busted = 'BUSTED',
  Folded = 'FOLDED'
}

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
  button?: Maybe<Scalars['Int']['output']>;
  channelKey: Scalars['String']['output'];
  communityCards: Array<CardInfo>;
  gameId?: Maybe<Scalars['ID']['output']>;
  handNumber: Scalars['Int']['output'];
  hands: Array<HandCardInfo>;
  lastInstruction?: Maybe<RenderInstruction>;
  phase?: Maybe<Scalars['String']['output']>;
  playerMeta: Array<PlayerMetaInfo>;
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
  smallBlind: Scalars['Int']['output'];
  status?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  getChannelState: ProctorGameState;
  getGameState: GameState;
  getHistory: Array<HandRecord>;
  getMyTurn: MyTurnResponse;
  getSession?: Maybe<Session>;
};


export type QueryGetChannelStateArgs = {
  channelKey: Scalars['String']['input'];
};


export type QueryGetGameStateArgs = {
  gameId: Scalars['ID']['input'];
};


export type QueryGetHistoryArgs = {
  gameId: Scalars['ID']['input'];
  lastN?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetMyTurnArgs = {
  gameId: Scalars['ID']['input'];
};


export type QueryGetSessionArgs = {
  channelKey: Scalars['String']['input'];
};

export type RenderInstruction = {
  __typename?: 'RenderInstruction';
  dealCommunity?: Maybe<DealCommunityPayload>;
  dealHands?: Maybe<DealHandsPayload>;
  gameOver?: Maybe<GameOverPayload>;
  gameStart?: Maybe<GameStartPayload>;
  handResult?: Maybe<HandResultPayload>;
  instructionId: Scalars['ID']['output'];
  leaderboard?: Maybe<LeaderboardPayload>;
  playerAction?: Maybe<PlayerActionPayload>;
  playerAnalysis?: Maybe<PlayerAnalysisPayload>;
  playerTurn?: Maybe<PlayerTurnPayload>;
  timestamp: Scalars['String']['output'];
  type: InstructionType;
};

export type Session = {
  __typename?: 'Session';
  channelKey: Scalars['String']['output'];
  gameId?: Maybe<Scalars['ID']['output']>;
  handNumber: Scalars['Int']['output'];
  players: Array<SessionPlayer>;
  status: SessionStatus;
};

export type SessionConfig = {
  bigBlind: Scalars['Int']['input'];
  handsPerGame?: InputMaybe<Scalars['Int']['input']>;
  players: Array<AgentConfig>;
  smallBlind: Scalars['Int']['input'];
  startingChips: Scalars['Int']['input'];
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

export enum SessionStatus {
  Finished = 'FINISHED',
  Running = 'RUNNING',
  Stopped = 'STOPPED'
}

export type SubmitActionInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  type: ActionType;
};

export type Subscription = {
  __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']['output']>;
  renderInstructions: RenderInstruction;
};


export type SubscriptionRenderInstructionsArgs = {
  channelKey: Scalars['String']['input'];
};

export type ValidAction = {
  __typename?: 'ValidAction';
  amount?: Maybe<Scalars['Int']['output']>;
  max?: Maybe<Scalars['Int']['output']>;
  min?: Maybe<Scalars['Int']['output']>;
  type: ActionType;
};

export type WinnerInfo = {
  __typename?: 'WinnerInfo';
  amount: Scalars['Int']['output'];
  hand?: Maybe<Scalars['String']['output']>;
  playerId: Scalars['ID']['output'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  ActionRecord: ResolverTypeWrapper<ActionRecord>;
  ActionType: ActionType;
  AgentConfig: AgentConfig;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Card: ResolverTypeWrapper<Card>;
  CardInfo: ResolverTypeWrapper<CardInfo>;
  CreateGameInput: CreateGameInput;
  DealCommunityPayload: ResolverTypeWrapper<DealCommunityPayload>;
  DealHandsPayload: ResolverTypeWrapper<DealHandsPayload>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GameOverPayload: ResolverTypeWrapper<GameOverPayload>;
  GamePhase: GamePhase;
  GameStartPayload: ResolverTypeWrapper<GameStartPayload>;
  GameState: ResolverTypeWrapper<GameState>;
  HandCardInfo: ResolverTypeWrapper<HandCardInfo>;
  HandRecord: ResolverTypeWrapper<HandRecord>;
  HandRecordPlayer: ResolverTypeWrapper<HandRecordPlayer>;
  HandResultPayload: ResolverTypeWrapper<HandResultPayload>;
  HandWinner: ResolverTypeWrapper<HandWinner>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  InstructionType: InstructionType;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  LeaderboardPayload: ResolverTypeWrapper<LeaderboardPayload>;
  Mutation: ResolverTypeWrapper<{}>;
  MyTurnResponse: ResolverTypeWrapper<MyTurnResponse>;
  PhaseActions: ResolverTypeWrapper<PhaseActions>;
  Player: ResolverTypeWrapper<Player>;
  PlayerActionPayload: ResolverTypeWrapper<PlayerActionPayload>;
  PlayerAnalysisPayload: ResolverTypeWrapper<PlayerAnalysisPayload>;
  PlayerHand: ResolverTypeWrapper<PlayerHand>;
  PlayerInfo: ResolverTypeWrapper<PlayerInfo>;
  PlayerInput: PlayerInput;
  PlayerMeta: ResolverTypeWrapper<PlayerMeta>;
  PlayerMetaInfo: ResolverTypeWrapper<PlayerMetaInfo>;
  PlayerStatus: PlayerStatus;
  PlayerTurnPayload: ResolverTypeWrapper<PlayerTurnPayload>;
  Pot: ResolverTypeWrapper<Pot>;
  PotInfo: ResolverTypeWrapper<PotInfo>;
  ProctorGameState: ResolverTypeWrapper<ProctorGameState>;
  Query: ResolverTypeWrapper<{}>;
  RenderInstruction: ResolverTypeWrapper<RenderInstruction>;
  Session: ResolverTypeWrapper<Session>;
  SessionConfig: SessionConfig;
  SessionPlayer: ResolverTypeWrapper<SessionPlayer>;
  SessionStatus: SessionStatus;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SubmitActionInput: SubmitActionInput;
  Subscription: ResolverTypeWrapper<{}>;
  ValidAction: ResolverTypeWrapper<ValidAction>;
  WinnerInfo: ResolverTypeWrapper<WinnerInfo>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  ActionRecord: ActionRecord;
  AgentConfig: AgentConfig;
  Boolean: Scalars['Boolean']['output'];
  Card: Card;
  CardInfo: CardInfo;
  CreateGameInput: CreateGameInput;
  DealCommunityPayload: DealCommunityPayload;
  DealHandsPayload: DealHandsPayload;
  Float: Scalars['Float']['output'];
  GameOverPayload: GameOverPayload;
  GameStartPayload: GameStartPayload;
  GameState: GameState;
  HandCardInfo: HandCardInfo;
  HandRecord: HandRecord;
  HandRecordPlayer: HandRecordPlayer;
  HandResultPayload: HandResultPayload;
  HandWinner: HandWinner;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  LeaderboardPayload: LeaderboardPayload;
  Mutation: {};
  MyTurnResponse: MyTurnResponse;
  PhaseActions: PhaseActions;
  Player: Player;
  PlayerActionPayload: PlayerActionPayload;
  PlayerAnalysisPayload: PlayerAnalysisPayload;
  PlayerHand: PlayerHand;
  PlayerInfo: PlayerInfo;
  PlayerInput: PlayerInput;
  PlayerMeta: PlayerMeta;
  PlayerMetaInfo: PlayerMetaInfo;
  PlayerTurnPayload: PlayerTurnPayload;
  Pot: Pot;
  PotInfo: PotInfo;
  ProctorGameState: ProctorGameState;
  Query: {};
  RenderInstruction: RenderInstruction;
  Session: Session;
  SessionConfig: SessionConfig;
  SessionPlayer: SessionPlayer;
  String: Scalars['String']['output'];
  SubmitActionInput: SubmitActionInput;
  Subscription: {};
  ValidAction: ValidAction;
  WinnerInfo: WinnerInfo;
};

export type ActionRecordResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ActionRecord'] = ResolversParentTypes['ActionRecord']> = {
  action?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  amount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CardResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Card'] = ResolversParentTypes['Card']> = {
  rank?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  suit?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CardInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CardInfo'] = ResolversParentTypes['CardInfo']> = {
  rank?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  suit?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DealCommunityPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['DealCommunityPayload'] = ResolversParentTypes['DealCommunityPayload']> = {
  communityCards?: Resolver<Array<ResolversTypes['CardInfo']>, ParentType, ContextType>;
  phase?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['PotInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DealHandsPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['DealHandsPayload'] = ResolversParentTypes['DealHandsPayload']> = {
  button?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  handNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hands?: Resolver<Array<ResolversTypes['PlayerHand']>, ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['PotInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GameOverPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['GameOverPayload'] = ResolversParentTypes['GameOverPayload']> = {
  handsPlayed?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  winnerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  winnerName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GameStartPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['GameStartPayload'] = ResolversParentTypes['GameStartPayload']> = {
  bigBlind?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  gameId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  playerMeta?: Resolver<Array<ResolversTypes['PlayerMeta']>, ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  smallBlind?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GameStateResolvers<ContextType = Context, ParentType extends ResolversParentTypes['GameState'] = ResolversParentTypes['GameState']> = {
  button?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  communityCards?: Resolver<Array<ResolversTypes['Card']>, ParentType, ContextType>;
  currentPlayerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  gameId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  handNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  phase?: Resolver<ResolversTypes['GamePhase'], ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['Player']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['Pot']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HandCardInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HandCardInfo'] = ResolversParentTypes['HandCardInfo']> = {
  cards?: Resolver<Array<ResolversTypes['CardInfo']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HandRecordResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HandRecord'] = ResolversParentTypes['HandRecord']> = {
  actions?: Resolver<Array<ResolversTypes['PhaseActions']>, ParentType, ContextType>;
  communityCards?: Resolver<Array<ResolversTypes['Card']>, ParentType, ContextType>;
  handNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['HandRecordPlayer']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['Pot']>, ParentType, ContextType>;
  winners?: Resolver<Array<ResolversTypes['HandWinner']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HandRecordPlayerResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HandRecordPlayer'] = ResolversParentTypes['HandRecordPlayer']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startingChips?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HandResultPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HandResultPayload'] = ResolversParentTypes['HandResultPayload']> = {
  communityCards?: Resolver<Array<ResolversTypes['CardInfo']>, ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['PotInfo']>, ParentType, ContextType>;
  winners?: Resolver<Array<ResolversTypes['WinnerInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HandWinnerResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HandWinner'] = ResolversParentTypes['HandWinner']> = {
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hand?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LeaderboardPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['LeaderboardPayload'] = ResolversParentTypes['LeaderboardPayload']> = {
  handsPlayed?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  advanceGame?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<MutationAdvanceGameArgs, 'gameId'>>;
  createGame?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<MutationCreateGameArgs, 'input'>>;
  renderComplete?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRenderCompleteArgs, 'channelKey' | 'instructionId'>>;
  runSession?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRunSessionArgs, 'channelKey'>>;
  startHand?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<MutationStartHandArgs, 'gameId'>>;
  startSession?: Resolver<ResolversTypes['Session'], ParentType, ContextType, RequireFields<MutationStartSessionArgs, 'channelKey' | 'config'>>;
  stopSession?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationStopSessionArgs, 'channelKey'>>;
  submitAction?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<MutationSubmitActionArgs, 'action' | 'gameId'>>;
};

export type MyTurnResponseResolvers<ContextType = Context, ParentType extends ResolversParentTypes['MyTurnResponse'] = ResolversParentTypes['MyTurnResponse']> = {
  gameState?: Resolver<ResolversTypes['GameState'], ParentType, ContextType>;
  myHand?: Resolver<Array<ResolversTypes['Card']>, ParentType, ContextType>;
  validActions?: Resolver<Array<ResolversTypes['ValidAction']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PhaseActionsResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PhaseActions'] = ResolversParentTypes['PhaseActions']> = {
  actions?: Resolver<Array<ResolversTypes['ActionRecord']>, ParentType, ContextType>;
  phase?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Player'] = ResolversParentTypes['Player']> = {
  bet?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  chips?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  seatIndex?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['PlayerStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerActionPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerActionPayload'] = ResolversParentTypes['PlayerActionPayload']> = {
  action?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  amount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  playerName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['PotInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerAnalysisPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerAnalysisPayload'] = ResolversParentTypes['PlayerAnalysisPayload']> = {
  analysis?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  playerName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerHandResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerHand'] = ResolversParentTypes['PlayerHand']> = {
  cards?: Resolver<Array<ResolversTypes['CardInfo']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerInfo'] = ResolversParentTypes['PlayerInfo']> = {
  bet?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  chips?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  seatIndex?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerMetaResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerMeta'] = ResolversParentTypes['PlayerMeta']> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ttsVoice?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerMetaInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerMetaInfo'] = ResolversParentTypes['PlayerMetaInfo']> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ttsVoice?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerTurnPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerTurnPayload'] = ResolversParentTypes['PlayerTurnPayload']> = {
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  playerName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PotResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Pot'] = ResolversParentTypes['Pot']> = {
  eligiblePlayerIds?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  size?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PotInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PotInfo'] = ResolversParentTypes['PotInfo']> = {
  eligiblePlayerIds?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  size?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProctorGameStateResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ProctorGameState'] = ResolversParentTypes['ProctorGameState']> = {
  bigBlind?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  button?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  channelKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  communityCards?: Resolver<Array<ResolversTypes['CardInfo']>, ParentType, ContextType>;
  gameId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  handNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hands?: Resolver<Array<ResolversTypes['HandCardInfo']>, ParentType, ContextType>;
  lastInstruction?: Resolver<Maybe<ResolversTypes['RenderInstruction']>, ParentType, ContextType>;
  phase?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  playerMeta?: Resolver<Array<ResolversTypes['PlayerMetaInfo']>, ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['PotInfo']>, ParentType, ContextType>;
  smallBlind?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  getChannelState?: Resolver<ResolversTypes['ProctorGameState'], ParentType, ContextType, RequireFields<QueryGetChannelStateArgs, 'channelKey'>>;
  getGameState?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<QueryGetGameStateArgs, 'gameId'>>;
  getHistory?: Resolver<Array<ResolversTypes['HandRecord']>, ParentType, ContextType, RequireFields<QueryGetHistoryArgs, 'gameId'>>;
  getMyTurn?: Resolver<ResolversTypes['MyTurnResponse'], ParentType, ContextType, RequireFields<QueryGetMyTurnArgs, 'gameId'>>;
  getSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QueryGetSessionArgs, 'channelKey'>>;
};

export type RenderInstructionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RenderInstruction'] = ResolversParentTypes['RenderInstruction']> = {
  dealCommunity?: Resolver<Maybe<ResolversTypes['DealCommunityPayload']>, ParentType, ContextType>;
  dealHands?: Resolver<Maybe<ResolversTypes['DealHandsPayload']>, ParentType, ContextType>;
  gameOver?: Resolver<Maybe<ResolversTypes['GameOverPayload']>, ParentType, ContextType>;
  gameStart?: Resolver<Maybe<ResolversTypes['GameStartPayload']>, ParentType, ContextType>;
  handResult?: Resolver<Maybe<ResolversTypes['HandResultPayload']>, ParentType, ContextType>;
  instructionId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  leaderboard?: Resolver<Maybe<ResolversTypes['LeaderboardPayload']>, ParentType, ContextType>;
  playerAction?: Resolver<Maybe<ResolversTypes['PlayerActionPayload']>, ParentType, ContextType>;
  playerAnalysis?: Resolver<Maybe<ResolversTypes['PlayerAnalysisPayload']>, ParentType, ContextType>;
  playerTurn?: Resolver<Maybe<ResolversTypes['PlayerTurnPayload']>, ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['InstructionType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session']> = {
  channelKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  gameId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  handNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['SessionPlayer']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionPlayerResolvers<ContextType = Context, ParentType extends ResolversParentTypes['SessionPlayer'] = ResolversParentTypes['SessionPlayer']> = {
  chips?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  modelId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  modelName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  provider?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  _empty?: SubscriptionResolver<Maybe<ResolversTypes['String']>, "_empty", ParentType, ContextType>;
  renderInstructions?: SubscriptionResolver<ResolversTypes['RenderInstruction'], "renderInstructions", ParentType, ContextType, RequireFields<SubscriptionRenderInstructionsArgs, 'channelKey'>>;
};

export type ValidActionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ValidAction'] = ResolversParentTypes['ValidAction']> = {
  amount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  max?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['ActionType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WinnerInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WinnerInfo'] = ResolversParentTypes['WinnerInfo']> = {
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hand?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = Context> = {
  ActionRecord?: ActionRecordResolvers<ContextType>;
  Card?: CardResolvers<ContextType>;
  CardInfo?: CardInfoResolvers<ContextType>;
  DealCommunityPayload?: DealCommunityPayloadResolvers<ContextType>;
  DealHandsPayload?: DealHandsPayloadResolvers<ContextType>;
  GameOverPayload?: GameOverPayloadResolvers<ContextType>;
  GameStartPayload?: GameStartPayloadResolvers<ContextType>;
  GameState?: GameStateResolvers<ContextType>;
  HandCardInfo?: HandCardInfoResolvers<ContextType>;
  HandRecord?: HandRecordResolvers<ContextType>;
  HandRecordPlayer?: HandRecordPlayerResolvers<ContextType>;
  HandResultPayload?: HandResultPayloadResolvers<ContextType>;
  HandWinner?: HandWinnerResolvers<ContextType>;
  LeaderboardPayload?: LeaderboardPayloadResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  MyTurnResponse?: MyTurnResponseResolvers<ContextType>;
  PhaseActions?: PhaseActionsResolvers<ContextType>;
  Player?: PlayerResolvers<ContextType>;
  PlayerActionPayload?: PlayerActionPayloadResolvers<ContextType>;
  PlayerAnalysisPayload?: PlayerAnalysisPayloadResolvers<ContextType>;
  PlayerHand?: PlayerHandResolvers<ContextType>;
  PlayerInfo?: PlayerInfoResolvers<ContextType>;
  PlayerMeta?: PlayerMetaResolvers<ContextType>;
  PlayerMetaInfo?: PlayerMetaInfoResolvers<ContextType>;
  PlayerTurnPayload?: PlayerTurnPayloadResolvers<ContextType>;
  Pot?: PotResolvers<ContextType>;
  PotInfo?: PotInfoResolvers<ContextType>;
  ProctorGameState?: ProctorGameStateResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RenderInstruction?: RenderInstructionResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  SessionPlayer?: SessionPlayerResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  ValidAction?: ValidActionResolvers<ContextType>;
  WinnerInfo?: WinnerInfoResolvers<ContextType>;
};

