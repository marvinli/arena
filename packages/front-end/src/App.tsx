import { Navigate, Route, Routes } from "react-router-dom";
import { PokerLeaderboardPage } from "./components/PokerLeaderboardPage";
import { PokerPage } from "./components/PokerPage";
import { useGameSession } from "./hooks/useGameSession";
import { useRouteSync } from "./hooks/useRouteSync";
import { getMockFixture } from "./mockData";
import "./styles/global.css";

const params = new URLSearchParams(window.location.search);
const mockParam = params.get("mock");

export function App() {
  const { state } = useGameSession();

  useRouteSync(state.currentView);

  if (mockParam !== null) {
    const mock = getMockFixture(mockParam || "default");
    return (
      <div className="app">
        <PokerPage
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
      <Routes>
        <Route
          path="/poker"
          element={
            <PokerPage
              players={state.players}
              communityCards={state.communityCards}
              pots={state.pots}
              speakingPlayerId={state.speakingPlayerId}
              analysisText={state.analysisText}
              isApiError={state.isApiError}
              handNumber={state.handNumber}
              button={state.button}
            />
          }
        />
        <Route
          path="/poker/leaderboard"
          element={
            <PokerLeaderboardPage
              players={state.players}
              handNumber={state.handNumber}
              smallBlind={state.smallBlind}
              bigBlind={state.bigBlind}
            />
          }
        />
        <Route path="*" element={<Navigate to="/poker" replace />} />
      </Routes>
    </div>
  );
}
