import { PokerTable } from "./components/PokerTable";
import { useGameSession } from "./hooks/useGameSession";
import { getMockFixture } from "./mockData";
import "./styles/global.css";

const params = new URLSearchParams(window.location.search);
const mockParam = params.get("mock");

export function App() {
  const { state } = useGameSession();

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
    </div>
  );
}
