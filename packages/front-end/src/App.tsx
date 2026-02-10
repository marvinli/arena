import { useEffect } from "react";
import styles from "./components/App.module.css";
import { PokerTable } from "./components/PokerTable";
import { StartScreen } from "./components/StartScreen";
import { useGameSession } from "./hooks/useGameSession";
import { getMockFixture } from "./mockData";
import "./styles/global.css";

const params = new URLSearchParams(window.location.search);
const mockParam = params.get("mock");
const autostart = params.has("autostart");

export function App() {
  const { state, startGame, stopGame } = useGameSession();

  useEffect(() => {
    if (autostart && state.status === "idle") {
      startGame();
    }
  }, [state.status, startGame]);

  if (mockParam !== null) {
    const mock = getMockFixture(mockParam || "default");
    return (
      <div className="app">
        <PokerTable
          players={mock.players}
          communityCards={mock.communityCards}
          pots={mock.pots}
          speakingPlayerId={mock.speakingPlayerId}
          analysisText={mock.analysisText}
          isApiError={mock.isApiError}
          handNumber={mock.handNumber}
          button={mock.button}
        />
      </div>
    );
  }

  if (!autostart && (state.status === "idle" || state.status === "error")) {
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
        isApiError={state.isApiError}
        handNumber={state.handNumber}
        button={state.button}
      />
      {state.status === "finished" && (
        <button
          type="button"
          onClick={stopGame}
          className={styles.newGameButton}
        >
          New Game
        </button>
      )}
    </div>
  );
}
