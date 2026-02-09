import { PokerTable } from "./components/PokerTable";
import { StartScreen } from "./components/StartScreen";
import { useGameSession } from "./hooks/useGameSession";
import "./styles/global.css";

export function App() {
  const { state, startGame, stopGame } = useGameSession();

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
