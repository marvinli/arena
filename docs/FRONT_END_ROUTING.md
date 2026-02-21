# Front-End Routing & Component Hierarchy

## Overview

The front-end evolves from a single-page poker renderer into a multi-page app with client-side routing. Navigation is **server-driven**: the proctor's render instructions determine which page the front-end displays. The user never navigates manually — the app listens globally to the SSE instruction stream and programmatically routes to the correct view.

## Routes

| Path                 | Page Component           | When Active                                    |
|----------------------|--------------------------|------------------------------------------------|
| `/poker`             | `PokerPage`              | During active hand play (GAME_START through HAND_RESULT) |
| `/poker/endcard`     | `PokerLeaderboardPage`   | Between hands (LEADERBOARD) and game end (GAME_OVER) |
| `/`                  | Redirects to `/poker`    | Default entry point                            |

## Instruction-Driven Navigation

A `useRouteSync` hook in `App.tsx` watches the game state and navigates accordingly:

- **DEAL_HANDS** → `/poker` (new hand starting)
- **LEADERBOARD** → `/poker/endcard` (between-hands standings)
- **GAME_START** → `/poker` (game beginning)
- **GAME_OVER** → `/poker/endcard` (final standings)
- **RECONNECT** → derived from game phase (WAITING or FINISHED = endcard, else poker)

The hook reads from a new `currentView` field on `GameState` that the reducer sets based on instruction type. This keeps routing logic pure (in the reducer) and the hook simply syncs state to URL.

### GameState Addition

```typescript
type GameView = "poker" | "endcard";

interface GameState {
  // ... existing fields ...
  currentView: GameView;
}
```

The reducer updates `currentView`:
- `handleLeaderboard` / `handleGameOver` → `"endcard"`
- `handleGameStart` / `handleDealHands` → `"poker"`
- `handleReconnect` → based on phase (WAITING or FINISHED = `"endcard"`, else `"poker"`)

## State Management

Both pages share the same `GameState` from the existing `useReducer`. The SSE subscription, render queue, and reducer stay at the `App` level — pages are pure renderers that receive state as props.

```
App.tsx
├── useGameSession()     ← SSE loop, reducer, state management
├── useRouteSync(state)  ← syncs state.currentView → router
├── <Routes>
│   ├── /poker            → <PokerPage state={...} />
│   └── /poker/endcard    → <PokerLeaderboardPage state={...} />
```

## Component Hierarchy

Components are reorganized into a hierarchical folder structure. Each page is a top-level folder under `components/`. Sub-components nest under their parent. CSS modules travel with their component.

```
src/components/
├── PokerPage/
│   ├── index.tsx                          # Page shell (table + side panel)
│   ├── PokerPage.module.css               # Page-level layout (wrapper, scene)
│   ├── PokerTable/
│   │   ├── index.tsx                      # Table: seats + community + bets
│   │   ├── PokerTable.module.css          # Table-specific styles (community, bets, empty seats)
│   │   ├── layout.ts                      # Seat positions + colors (data only)
│   │   ├── PlayerSeat/
│   │   │   ├── index.tsx
│   │   │   └── PlayerSeat.module.css
│   │   ├── CommunityArea/
│   │   │   └── index.tsx                  # Uses parent's PokerTable.module.css
│   │   ├── BetIndicator/
│   │   │   └── index.tsx                  # Uses parent's PokerTable.module.css
│   │   ├── PlayingCard/
│   │   │   ├── index.tsx
│   │   │   └── PlayingCard.module.css
│   │   └── ChipStack/
│   │       ├── index.tsx
│   │       └── ChipStack.module.css
│   └── SidePanel/
│       ├── index.tsx
│       └── SidePanel.module.css
│
├── PokerLeaderboardPage/
│   ├── index.tsx                          # Leaderboard standings and endcard view
│   └── PokerLeaderboardPage.module.css
│
└── shared/
    └── ProviderIcon.tsx                   # CharacterAvatar component — character images (used by PlayerSeat + SidePanel)
```

### Key Decisions

- **CharacterAvatar** (in `shared/ProviderIcon.tsx`) is used across pages (PlayerSeat, SidePanel, and potentially the leaderboard).
- **CommunityArea** and **BetIndicator** don't have their own CSS modules — they import from `PokerTable.module.css` (their styles are tightly coupled to the table layout). This avoids unnecessary file proliferation.
- **layout.ts** stays under `PokerTable/` as pure data.

### Import Convention

Components use `index.tsx` so imports look like:
```typescript
import { PokerTable } from "./PokerTable";
import { PlayerSeat } from "./PlayerSeat";
```

## Dependencies

- **react-router-dom** — added for client-side routing (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `useNavigate`)
- No other new dependencies

## Mock Mode

Mock mode uses dedicated routes (`/poker/mock` and `/poker/endcard/mock`) with `?mock=...` query params. When active, the app renders components directly with mock data, bypassing SSE. Route sync is disabled for mock routes.
