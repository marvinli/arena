const CREATE_GAME = /* GraphQL */ `
  mutation CreateGame($input: CreateGameInput!) {
    createGame(input: $input) {
      gameId
      phase
      communityCards { rank suit }
      players { id name chips bet status seatIndex }
      pots { size eligiblePlayerIds }
      currentPlayerId
      handNumber
      button
    }
  }
`;

const START_HAND = /* GraphQL */ `
  mutation StartHand($gameId: ID!) {
    startHand(gameId: $gameId) {
      gameId
      phase
      communityCards { rank suit }
      players { id name chips bet status seatIndex }
      pots { size eligiblePlayerIds }
      currentPlayerId
      handNumber
      button
    }
  }
`;

const GET_GAME_STATE = /* GraphQL */ `
  query GetGameState($gameId: ID!) {
    getGameState(gameId: $gameId) {
      gameId
      phase
      communityCards { rank suit }
      players { id name chips bet status seatIndex }
      pots { size eligiblePlayerIds }
      currentPlayerId
      handNumber
      button
    }
  }
`;

const GET_MY_TURN = /* GraphQL */ `
  query GetMyTurn($gameId: ID!) {
    getMyTurn(gameId: $gameId) {
      gameState {
        gameId
        phase
        communityCards { rank suit }
        players { id name chips bet status seatIndex }
        pots { size eligiblePlayerIds }
        currentPlayerId
        handNumber
        button
      }
      myHand { rank suit }
      validActions { type amount min max }
    }
  }
`;

const SUBMIT_ACTION = /* GraphQL */ `
  mutation SubmitAction($gameId: ID!, $action: SubmitActionInput!) {
    submitAction(gameId: $gameId, action: $action) {
      gameId
      phase
      communityCards { rank suit }
      players { id name chips bet status seatIndex }
      pots { size eligiblePlayerIds }
      currentPlayerId
      handNumber
      button
    }
  }
`;

const ADVANCE_GAME = /* GraphQL */ `
  mutation AdvanceGame($gameId: ID!) {
    advanceGame(gameId: $gameId) {
      gameId
      phase
      communityCards { rank suit }
      players { id name chips bet status seatIndex }
      pots { size eligiblePlayerIds }
      currentPlayerId
      handNumber
      button
    }
  }
`;

const GET_HISTORY = /* GraphQL */ `
  query GetHistory($gameId: ID!, $lastN: Int) {
    getHistory(gameId: $gameId, lastN: $lastN) {
      handNumber
      players { id name startingChips }
      communityCards { rank suit }
      actions { phase actions { playerId action amount } }
      pots { size eligiblePlayerIds }
      winners { playerId amount hand }
    }
  }
`;

export interface PokerGameState {
  gameId: string;
  phase: string;
  communityCards: Array<{ rank: string; suit: string }>;
  players: Array<{
    id: string;
    name: string;
    chips: number;
    bet: number;
    status: string;
    seatIndex: number;
  }>;
  pots: Array<{ size: number; eligiblePlayerIds: string[] }>;
  currentPlayerId: string | null;
  handNumber: number;
  button: number | null;
}

export interface MyTurnResponse {
  gameState: PokerGameState;
  myHand: Array<{ rank: string; suit: string }>;
  validActions: Array<{
    type: string;
    amount?: number | null;
    min?: number | null;
    max?: number | null;
  }>;
}

export interface HandRecord {
  handNumber: number;
  players: Array<{ id: string; name: string; startingChips: number }>;
  communityCards: Array<{ rank: string; suit: string }>;
  actions: Array<{
    phase: string;
    actions: Array<{
      playerId: string;
      action: string;
      amount?: number | null;
    }>;
  }>;
  pots: Array<{ size: number; eligiblePlayerIds: string[] }>;
  winners: Array<{ playerId: string; amount: number; hand?: string | null }>;
}

interface GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function gqlFetch<T>(
  baseUrl: string,
  query: string,
  variables: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await response.json()) as GqlResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  if (!json.data) {
    throw new Error("No data returned from poker-api");
  }
  return json.data;
}

export interface PokerApiClient {
  createGame(input: {
    players: Array<{ id: string; name: string; chips: number }>;
    smallBlind: number;
    bigBlind: number;
  }): Promise<PokerGameState>;

  startHand(gameId: string): Promise<PokerGameState>;
  getGameState(gameId: string): Promise<PokerGameState>;
  getMyTurn(gameId: string, playerId: string): Promise<MyTurnResponse>;

  submitAction(
    gameId: string,
    playerId: string,
    action: { type: string; amount?: number },
  ): Promise<PokerGameState>;

  advanceGame(gameId: string): Promise<PokerGameState>;
  getHistory(gameId: string, lastN?: number): Promise<HandRecord[]>;
}

export function createPokerApiClient(baseUrl: string): PokerApiClient {
  return {
    async createGame(input) {
      const data = await gqlFetch<{ createGame: PokerGameState }>(
        baseUrl,
        CREATE_GAME,
        { input },
      );
      return data.createGame;
    },

    async startHand(gameId) {
      const data = await gqlFetch<{ startHand: PokerGameState }>(
        baseUrl,
        START_HAND,
        { gameId },
      );
      return data.startHand;
    },

    async getGameState(gameId) {
      const data = await gqlFetch<{ getGameState: PokerGameState }>(
        baseUrl,
        GET_GAME_STATE,
        { gameId },
      );
      return data.getGameState;
    },

    async getMyTurn(gameId, playerId) {
      const data = await gqlFetch<{ getMyTurn: MyTurnResponse }>(
        baseUrl,
        GET_MY_TURN,
        { gameId },
        { "x-player-id": playerId },
      );
      return data.getMyTurn;
    },

    async submitAction(gameId, playerId, action) {
      const data = await gqlFetch<{ submitAction: PokerGameState }>(
        baseUrl,
        SUBMIT_ACTION,
        { gameId, action },
        { "x-player-id": playerId },
      );
      return data.submitAction;
    },

    async advanceGame(gameId) {
      const data = await gqlFetch<{ advanceGame: PokerGameState }>(
        baseUrl,
        ADVANCE_GAME,
        { gameId },
      );
      return data.advanceGame;
    },

    async getHistory(gameId, lastN) {
      const data = await gqlFetch<{ getHistory: HandRecord[] }>(
        baseUrl,
        GET_HISTORY,
        { gameId, lastN: lastN ?? null },
      );
      return data.getHistory;
    },
  };
}
