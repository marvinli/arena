import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { PokerLeaderboardPage } from "./components/PokerLeaderboardPage";
import { PokerPage } from "./components/PokerPage";
import { useGameSession } from "./hooks/useGameSession";
import { useRouteSync } from "./hooks/useRouteSync";
import { getMockFixture } from "./mockData";
import "./styles/global.css";

function MockPokerPage() {
  const [params] = useSearchParams();
  const mock = getMockFixture(params.get("mock") || "default");
  return (
    <PokerPage
      players={mock.players}
      communityCards={mock.communityCards}
      pots={mock.pots}
      speakingPlayerId={mock.speakingPlayerId}
      analysisText={mock.analysisText}
      isApiError={mock.isApiError}
      handNumber={mock.handNumber}
      button={mock.button}
      smallBlind={mock.smallBlind ?? 10}
      bigBlind={mock.bigBlind ?? 20}
    />
  );
}

function MockEndcardPage() {
  const mock = getMockFixture("game-over");
  return (
    <PokerLeaderboardPage
      players={mock.players}
      handNumber={mock.handNumber}
      smallBlind={mock.smallBlind ?? 10}
      bigBlind={mock.bigBlind ?? 20}
      awards={mock.awards ?? []}
      isFinished={mock.isFinished ?? false}
    />
  );
}

export function App() {
  const { state } = useGameSession();
  const { pathname } = useLocation();
  const isMock = pathname.endsWith("/mock");
  const isPokerTable =
    pathname === "/poker" || pathname === "/poker/mock";

  useRouteSync(isMock ? null : state.currentView);

  const appStyle = isPokerTable
    ? ({ "--gradient-x": "calc(50% - 9vw)" } as React.CSSProperties)
    : undefined;

  return (
    <div className="app" style={appStyle}>
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
              smallBlind={state.smallBlind}
              bigBlind={state.bigBlind}
            />
          }
        />
        <Route
          path="/poker/endcard"
          element={
            <PokerLeaderboardPage
              players={state.players}
              handNumber={state.handNumber}
              smallBlind={state.smallBlind}
              bigBlind={state.bigBlind}
              awards={state.awards}
              isFinished={state.status === "finished"}
            />
          }
        />
        <Route path="/poker/mock" element={<MockPokerPage />} />
        <Route path="/poker/endcard/mock" element={<MockEndcardPage />} />
        <Route path="*" element={<Navigate to="/poker" replace />} />
      </Routes>
    </div>
  );
}
