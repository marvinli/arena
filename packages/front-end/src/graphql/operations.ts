export const CONNECT_QUERY = /* GraphQL */ `
  query Connect($channelKey: String!) {
    connect(channelKey: $channelKey) {
      moduleId
      moduleType
      gameState {
        status
        gameId
        handNumber
        phase
        button
        smallBlind
        bigBlind
        players { id name chips bet status seatIndex }
        communityCards { rank suit }
        pots { size eligiblePlayerIds }
        hands { playerId cards { rank suit } }
        playerMeta { id ttsVoice avatarUrl }
      }
    }
  }
`;

export const START_MODULE_MUT = /* GraphQL */ `
  mutation StartModule($channelKey: String!) {
    startModule(channelKey: $channelKey)
  }
`;

export const STOP_SESSION_MUT = /* GraphQL */ `
  mutation StopSession($channelKey: String!) {
    stopSession(channelKey: $channelKey)
  }
`;

export const COMPLETE_INSTRUCTION_MUT = /* GraphQL */ `
  mutation CompleteInstruction($channelKey: String!, $moduleId: String!, $instructionId: String!) {
    completeInstruction(channelKey: $channelKey, moduleId: $moduleId, instructionId: $instructionId)
  }
`;

export const GET_CHANNEL_STATE = /* GraphQL */ `
  query GetChannelState($channelKey: String!) {
    getChannelState(channelKey: $channelKey) {
      status
      gameId
      handNumber
      phase
      button
      smallBlind
      bigBlind
      players { id name chips bet status seatIndex }
      communityCards { rank suit }
      pots { size eligiblePlayerIds }
      hands { playerId cards { rank suit } }
      playerMeta { id ttsVoice avatarUrl }
    }
  }
`;

export const RENDER_INSTRUCTIONS_SUB = /* GraphQL */ `
  subscription RenderInstructions($channelKey: String!) {
    renderInstructions(channelKey: $channelKey) {
      instructionId
      moduleId
      type
      timestamp

      gameStart {
        gameId
        players { id name chips bet status seatIndex }
        playerMeta { id ttsVoice avatarUrl }
        smallBlind
        bigBlind
      }

      dealHands {
        handNumber
        players { id name chips bet status seatIndex }
        hands { playerId cards { rank suit } }
        button
        pots { size eligiblePlayerIds }
        smallBlind
        bigBlind
      }

      dealCommunity {
        phase
        communityCards { rank suit }
        pots { size eligiblePlayerIds }
      }

      playerTurn {
        playerId
        playerName
      }

      playerAnalysis {
        playerId
        playerName
        analysis
        isApiError
      }

      playerAction {
        playerId
        playerName
        action
        amount
        pots { size eligiblePlayerIds }
        players { id name chips bet status seatIndex }
      }

      handResult {
        winners { playerId amount hand }
        pots { size eligiblePlayerIds }
        players { id name chips bet status seatIndex }
        communityCards { rank suit }
      }

      leaderboard {
        players { id name chips bet status seatIndex }
        handsPlayed
        smallBlind
        bigBlind
      }

      gameOver {
        winnerId
        winnerName
        players { id name chips bet status seatIndex }
        handsPlayed
      }
    }
  }
`;
