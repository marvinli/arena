export const START_SESSION_MUT = `
  mutation StartSession($channelKey: String!, $config: SessionConfig!) {
    startSession(channelKey: $channelKey, config: $config) {
      channelKey
      gameId
      status
      handNumber
      players { id name chips modelId modelName provider }
    }
  }
`;

export const RUN_SESSION_MUT = `
  mutation RunSession($channelKey: String!) {
    runSession(channelKey: $channelKey)
  }
`;

export const STOP_SESSION_MUT = `
  mutation StopSession($channelKey: String!) {
    stopSession(channelKey: $channelKey)
  }
`;

export const RENDER_COMPLETE_MUT = `
  mutation RenderComplete($channelKey: String!, $instructionId: ID!) {
    renderComplete(channelKey: $channelKey, instructionId: $instructionId)
  }
`;

export const RENDER_INSTRUCTIONS_SUB = `
  subscription RenderInstructions($channelKey: String!) {
    renderInstructions(channelKey: $channelKey) {
      instructionId
      type
      timestamp

      gameStart {
        gameId
        players { id name chips status seatIndex }
        smallBlind
        bigBlind
      }

      dealHands {
        handNumber
        players { id name chips status seatIndex }
        hands { playerId cards { rank suit } }
        button
        pots { size eligiblePlayerIds }
      }

      dealCommunity {
        phase
        communityCards { rank suit }
        pots { size eligiblePlayerIds }
      }

      playerAction {
        playerId
        playerName
        action
        amount
        analysis
        pots { size eligiblePlayerIds }
        players { id name chips status seatIndex }
      }

      handResult {
        winners { playerId amount hand }
        pots { size eligiblePlayerIds }
        players { id name chips status seatIndex }
        communityCards { rank suit }
      }

      leaderboard {
        players { id name chips status seatIndex }
        handsPlayed
      }

      gameOver {
        winnerId
        winnerName
        players { id name chips status seatIndex }
        handsPlayed
      }
    }
  }
`;
