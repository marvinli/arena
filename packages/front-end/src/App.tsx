import { PokerTable } from "./components/PokerTable";
import { StartScreen } from "./components/StartScreen";
import { useGameSession } from "./hooks/useGameSession";
import { mockCommunityCards, mockPlayers, mockPots } from "./mockData";
import "./styles/global.css";

const isMock = new URLSearchParams(window.location.search).has("mock");

export function App() {
  const { state, startGame, stopGame } = useGameSession();

  if (isMock) {
    return (
      <div className="app">
        <PokerTable
          players={mockPlayers}
          communityCards={mockCommunityCards}
          pots={mockPots}
          speakingPlayerId="agent-1"
          analysisText="Ace-king suited on the button — this is a premium hand. With Gemini folding and only Grok and ChatGPT left to act behind me, I'm in great position. The flop gives me two overcards and a backdoor flush draw. I like my equity here. Let me put in a raise to 80 and see who wants to play."
          handNumber={1}
          button={0}
        />
      </div>
    );
  }

  if (state.status === "idle" || state.status === "error") {
    return (
      <div className="app">
        <StartScreen onStart={startGame} error={state.error} />
      </div>
    );
  }

  return (
    <div className="app">
      <PokerTable
        players={state.players}
        communityCards={state.communityCards}
        pots={state.pots}
        speakingPlayerId={state.speakingPlayerId}
        analysisText={state.analysisText}
        handNumber={state.handNumber}
        button={state.button}
      />
      {state.status === "finished" && (
        <button
          type="button"
          onClick={stopGame}
          style={{
            position: "fixed",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "0.5rem 1.5rem",
            fontSize: "1rem",
            fontWeight: 700,
            color: "#e0e4ef",
            background: "rgba(255,255,255,0.08)",
            border: "2px solid rgba(255,255,255,0.2)",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          New Game
        </button>
      )}
    </div>
  );
}
