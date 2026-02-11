import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { GameView } from "../types";

const VIEW_ROUTES: Record<GameView, string> = {
  poker: "/poker",
  leaderboard: "/poker/leaderboard",
};

/**
 * Syncs the GameState's `currentView` to the browser URL.
 * Navigation is driven by the proctor's render instructions — the user
 * never navigates manually.
 */
export function useRouteSync(currentView: GameView) {
  const navigate = useNavigate();

  useEffect(() => {
    const target = VIEW_ROUTES[currentView];
    if (target && window.location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [currentView, navigate]);
}
