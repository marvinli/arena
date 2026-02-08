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

export type Card = {
  __typename?: 'Card';
  rank: Scalars['String']['output'];
  suit: Scalars['String']['output'];
};

export type CreateGameInput = {
  bigBlind: Scalars['Int']['input'];
  players: Array<PlayerInput>;
  smallBlind: Scalars['Int']['input'];
};

export enum GamePhase {
  Flop = 'FLOP',
  Preflop = 'PREFLOP',
  River = 'RIVER',
  Showdown = 'SHOWDOWN',
  Turn = 'TURN',
  Waiting = 'WAITING'
}

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

export type HandWinner = {
  __typename?: 'HandWinner';
  amount: Scalars['Int']['output'];
  hand?: Maybe<Scalars['String']['output']>;
  playerId: Scalars['ID']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  advanceGame: GameState;
  createGame: GameState;
  startHand: GameState;
  submitAction: GameState;
};


export type MutationAdvanceGameArgs = {
  gameId: Scalars['ID']['input'];
};


export type MutationCreateGameArgs = {
  input: CreateGameInput;
};


export type MutationStartHandArgs = {
  gameId: Scalars['ID']['input'];
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

export type PlayerInput = {
  chips: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export enum PlayerStatus {
  Active = 'ACTIVE',
  AllIn = 'ALL_IN',
  Busted = 'BUSTED',
  Folded = 'FOLDED'
}

export type Pot = {
  __typename?: 'Pot';
  eligiblePlayerIds: Array<Scalars['ID']['output']>;
  size: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  getGameState: GameState;
  getHistory: Array<HandRecord>;
  getMyTurn: MyTurnResponse;
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

export type SubmitActionInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  type: ActionType;
};

export type ValidAction = {
  __typename?: 'ValidAction';
  amount?: Maybe<Scalars['Int']['output']>;
  max?: Maybe<Scalars['Int']['output']>;
  min?: Maybe<Scalars['Int']['output']>;
  type: ActionType;
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
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Card: ResolverTypeWrapper<Card>;
  CreateGameInput: CreateGameInput;
  GamePhase: GamePhase;
  GameState: ResolverTypeWrapper<GameState>;
  HandRecord: ResolverTypeWrapper<HandRecord>;
  HandRecordPlayer: ResolverTypeWrapper<HandRecordPlayer>;
  HandWinner: ResolverTypeWrapper<HandWinner>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mutation: ResolverTypeWrapper<{}>;
  MyTurnResponse: ResolverTypeWrapper<MyTurnResponse>;
  PhaseActions: ResolverTypeWrapper<PhaseActions>;
  Player: ResolverTypeWrapper<Player>;
  PlayerInput: PlayerInput;
  PlayerStatus: PlayerStatus;
  Pot: ResolverTypeWrapper<Pot>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SubmitActionInput: SubmitActionInput;
  ValidAction: ResolverTypeWrapper<ValidAction>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  ActionRecord: ActionRecord;
  Boolean: Scalars['Boolean']['output'];
  Card: Card;
  CreateGameInput: CreateGameInput;
  GameState: GameState;
  HandRecord: HandRecord;
  HandRecordPlayer: HandRecordPlayer;
  HandWinner: HandWinner;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mutation: {};
  MyTurnResponse: MyTurnResponse;
  PhaseActions: PhaseActions;
  Player: Player;
  PlayerInput: PlayerInput;
  Pot: Pot;
  Query: {};
  String: Scalars['String']['output'];
  SubmitActionInput: SubmitActionInput;
  ValidAction: ValidAction;
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

export type HandWinnerResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HandWinner'] = ResolversParentTypes['HandWinner']> = {
  amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hand?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  playerId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  advanceGame?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<MutationAdvanceGameArgs, 'gameId'>>;
  createGame?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<MutationCreateGameArgs, 'input'>>;
  startHand?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<MutationStartHandArgs, 'gameId'>>;
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

export type PotResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Pot'] = ResolversParentTypes['Pot']> = {
  eligiblePlayerIds?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  size?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  getGameState?: Resolver<ResolversTypes['GameState'], ParentType, ContextType, RequireFields<QueryGetGameStateArgs, 'gameId'>>;
  getHistory?: Resolver<Array<ResolversTypes['HandRecord']>, ParentType, ContextType, RequireFields<QueryGetHistoryArgs, 'gameId'>>;
  getMyTurn?: Resolver<ResolversTypes['MyTurnResponse'], ParentType, ContextType, RequireFields<QueryGetMyTurnArgs, 'gameId'>>;
};

export type ValidActionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ValidAction'] = ResolversParentTypes['ValidAction']> = {
  amount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  max?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['ActionType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = Context> = {
  ActionRecord?: ActionRecordResolvers<ContextType>;
  Card?: CardResolvers<ContextType>;
  GameState?: GameStateResolvers<ContextType>;
  HandRecord?: HandRecordResolvers<ContextType>;
  HandRecordPlayer?: HandRecordPlayerResolvers<ContextType>;
  HandWinner?: HandWinnerResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  MyTurnResponse?: MyTurnResponseResolvers<ContextType>;
  PhaseActions?: PhaseActionsResolvers<ContextType>;
  Player?: PlayerResolvers<ContextType>;
  Pot?: PotResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  ValidAction?: ValidActionResolvers<ContextType>;
};

