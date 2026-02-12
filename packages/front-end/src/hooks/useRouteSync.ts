import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { GameView } from "../types";

const VIEW_ROUTES: Record<GameView, string> = {
  poker: "/poker",
  endcard: "/poker/endcard",
};

/**
 * Syncs the GameState's `currentView` to the browser URL.
 * Navigation is driven by the proctor's render instructions — the user
 * never navigates manually.
 */
export function useRouteSync(currentView: GameView | null) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentView) return;
    const target = VIEW_ROUTES[currentView];
    if (target && window.location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [currentView, navigate]);
}
