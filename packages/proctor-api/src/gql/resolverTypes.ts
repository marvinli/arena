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

export type AgentConfig = {
  model: Scalars['String']['input'];
  name: Scalars['String']['input'];
  playerId: Scalars['ID']['input'];
  systemPrompt: Scalars['String']['input'];
  temperature?: InputMaybe<Scalars['Float']['input']>;
};

export type CardInfo = {
  __typename?: 'CardInfo';
  rank: Scalars['String']['output'];
  suit: Scalars['String']['output'];
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

export type GameStartPayload = {
  __typename?: 'GameStartPayload';
  bigBlind: Scalars['Int']['output'];
  gameId: Scalars['ID']['output'];
  players: Array<PlayerInfo>;
  smallBlind: Scalars['Int']['output'];
};

export type HandResultPayload = {
  __typename?: 'HandResultPayload';
  communityCards: Array<CardInfo>;
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
  winners: Array<WinnerInfo>;
};

export enum InstructionType {
  DealCommunity = 'DEAL_COMMUNITY',
  DealHands = 'DEAL_HANDS',
  GameOver = 'GAME_OVER',
  GameStart = 'GAME_START',
  HandResult = 'HAND_RESULT',
  Leaderboard = 'LEADERBOARD',
  PlayerAction = 'PLAYER_ACTION'
}

export type LeaderboardPayload = {
  __typename?: 'LeaderboardPayload';
  handsPlayed: Scalars['Int']['output'];
  players: Array<PlayerInfo>;
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  renderComplete: Scalars['Boolean']['output'];
  startSession: Session;
  stopSession: Scalars['Boolean']['output'];
};


export type MutationRenderCompleteArgs = {
  channelKey: Scalars['String']['input'];
  instructionId: Scalars['ID']['input'];
};


export type MutationStartSessionArgs = {
  channelKey: Scalars['String']['input'];
  config: SessionConfig;
};


export type MutationStopSessionArgs = {
  channelKey: Scalars['String']['input'];
};

export type PlayerActionPayload = {
  __typename?: 'PlayerActionPayload';
  action: Scalars['String']['output'];
  amount?: Maybe<Scalars['Int']['output']>;
  analysis?: Maybe<Scalars['String']['output']>;
  playerId: Scalars['ID']['output'];
  playerName: Scalars['String']['output'];
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
};

export type PlayerInfo = {
  __typename?: 'PlayerInfo';
  chips: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  seatIndex: Scalars['Int']['output'];
  status: Scalars['String']['output'];
};

export type PotInfo = {
  __typename?: 'PotInfo';
  eligiblePlayerIds: Array<Scalars['ID']['output']>;
  size: Scalars['Int']['output'];
};

export type ProctorGameState = {
  __typename?: 'ProctorGameState';
  channelKey: Scalars['String']['output'];
  communityCards: Array<CardInfo>;
  gameId?: Maybe<Scalars['ID']['output']>;
  handNumber: Scalars['Int']['output'];
  lastInstruction?: Maybe<RenderInstruction>;
  phase?: Maybe<Scalars['String']['output']>;
  players: Array<PlayerInfo>;
  pots: Array<PotInfo>;
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  getGameState: ProctorGameState;
  getSession?: Maybe<Session>;
};


export type QueryGetGameStateArgs = {
  channelKey: Scalars['String']['input'];
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
  pokerApiUrl?: InputMaybe<Scalars['String']['input']>;
  smallBlind: Scalars['Int']['input'];
  startingChips: Scalars['Int']['input'];
};

export type SessionPlayer = {
  __typename?: 'SessionPlayer';
  chips: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  model: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export enum SessionStatus {
  Finished = 'FINISHED',
  Running = 'RUNNING',
  Stopped = 'STOPPED'
}

export type Subscription = {
  __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']['output']>;
  renderInstructions: RenderInstruction;
};


export type SubscriptionRenderInstructionsArgs = {
  channelKey: Scalars['String']['input'];
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
  AgentConfig: AgentConfig;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CardInfo: ResolverTypeWrapper<CardInfo>;
  DealCommunityPayload: ResolverTypeWrapper<DealCommunityPayload>;
  DealHandsPayload: ResolverTypeWrapper<DealHandsPayload>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GameOverPayload: ResolverTypeWrapper<GameOverPayload>;
  GameStartPayload: ResolverTypeWrapper<GameStartPayload>;
  HandResultPayload: ResolverTypeWrapper<HandResultPayload>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  InstructionType: InstructionType;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  LeaderboardPayload: ResolverTypeWrapper<LeaderboardPayload>;
  Mutation: ResolverTypeWrapper<{}>;
  PlayerActionPayload: ResolverTypeWrapper<PlayerActionPayload>;
  PlayerInfo: ResolverTypeWrapper<PlayerInfo>;
  PotInfo: ResolverTypeWrapper<PotInfo>;
  ProctorGameState: ResolverTypeWrapper<ProctorGameState>;
  Query: ResolverTypeWrapper<{}>;
  RenderInstruction: ResolverTypeWrapper<RenderInstruction>;
  Session: ResolverTypeWrapper<Session>;
  SessionConfig: SessionConfig;
  SessionPlayer: ResolverTypeWrapper<SessionPlayer>;
  SessionStatus: SessionStatus;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<{}>;
  WinnerInfo: ResolverTypeWrapper<WinnerInfo>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AgentConfig: AgentConfig;
  Boolean: Scalars['Boolean']['output'];
  CardInfo: CardInfo;
  DealCommunityPayload: DealCommunityPayload;
  DealHandsPayload: DealHandsPayload;
  Float: Scalars['Float']['output'];
  GameOverPayload: GameOverPayload;
  GameStartPayload: GameStartPayload;
  HandResultPayload: HandResultPayload;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  LeaderboardPayload: LeaderboardPayload;
  Mutation: {};
  PlayerActionPayload: PlayerActionPayload;
  PlayerInfo: PlayerInfo;
  PotInfo: PotInfo;
  ProctorGameState: ProctorGameState;
  Query: {};
  RenderInstruction: RenderInstruction;
  Session: Session;
  SessionConfig: SessionConfig;
  SessionPlayer: SessionPlayer;
  String: Scalars['String']['output'];
  Subscription: {};
  WinnerInfo: WinnerInfo;
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
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  smallBlind?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HandResultPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HandResultPayload'] = ResolversParentTypes['HandResultPayload']> = {
  communityCards?: Resolver<Array<ResolversTypes['CardInfo']>, ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['PotInfo']>, ParentType, ContextType>;
  winners?: Resolver<Array<ResolversTypes['WinnerInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LeaderboardPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['LeaderboardPayload'] = ResolversParentTypes['LeaderboardPayload']> = {
  handsPlayed?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  renderComplete?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRenderCompleteArgs, 'channelKey' | 'instructionId'>>;
  startSession?: Resolver<ResolversTypes['Session'], ParentType, ContextType, RequireFields<MutationStartSessionArgs, 'channelKey' | 'config'>>;
  stopSession?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationStopSessionArgs, 'channelKey'>>;
};

export type PlayerActionPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerActionPayload'] = ResolversParentTypes['PlayerActionPayload']> = {
  action?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  amount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  analysis?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  playerName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['PotInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PlayerInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PlayerInfo'] = ResolversParentTypes['PlayerInfo']> = {
  chips?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  seatIndex?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PotInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PotInfo'] = ResolversParentTypes['PotInfo']> = {
  eligiblePlayerIds?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  size?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProctorGameStateResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ProctorGameState'] = ResolversParentTypes['ProctorGameState']> = {
  channelKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  communityCards?: Resolver<Array<ResolversTypes['CardInfo']>, ParentType, ContextType>;
  gameId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  handNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  lastInstruction?: Resolver<Maybe<ResolversTypes['RenderInstruction']>, ParentType, ContextType>;
  phase?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  players?: Resolver<Array<ResolversTypes['PlayerInfo']>, ParentType, ContextType>;
  pots?: Resolver<Array<ResolversTypes['PotInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  getGameState?: Resolver<ResolversTypes['ProctorGameState'], ParentType, ContextType, RequireFields<QueryGetGameStateArgs, 'channelKey'>>;
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
  model?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  _empty?: SubscriptionResolver<Maybe<ResolversTypes['String']>, "_empty", ParentType, ContextType>;
  renderInstructions?: SubscriptionResolver<ResolversTypes['RenderInstruction'], "renderInstructions", ParentType, ContextType, RequireFields<SubscriptionRenderInstructionsArgs, 'channelKey'>>;
};

export type WinnerInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WinnerInfo'] = ResolversParentTypes['WinnerInfo']> = {
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hand?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = Context> = {
  CardInfo?: CardInfoResolvers<ContextType>;
  DealCommunityPayload?: DealCommunityPayloadResolvers<ContextType>;
  DealHandsPayload?: DealHandsPayloadResolvers<ContextType>;
  GameOverPayload?: GameOverPayloadResolvers<ContextType>;
  GameStartPayload?: GameStartPayloadResolvers<ContextType>;
  HandResultPayload?: HandResultPayloadResolvers<ContextType>;
  LeaderboardPayload?: LeaderboardPayloadResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PlayerActionPayload?: PlayerActionPayloadResolvers<ContextType>;
  PlayerInfo?: PlayerInfoResolvers<ContextType>;
  PotInfo?: PotInfoResolvers<ContextType>;
  ProctorGameState?: ProctorGameStateResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RenderInstruction?: RenderInstructionResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  SessionPlayer?: SessionPlayerResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  WinnerInfo?: WinnerInfoResolvers<ContextType>;
};

