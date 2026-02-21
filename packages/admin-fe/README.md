# Admin Frontend

Single-page admin dashboard for controlling the Arena stream. Built with React and Vite. Authenticates via AWS Cognito (Google OAuth) and communicates with admin-api over GraphQL.

## Features

- **Health monitoring**: Shows proctor and videographer service status with auto-refresh every 10 seconds.
- **Stream control**: Start/stop the live stream (toggles the `live` flag).
- **Database reset**: Clears all game data (with confirmation).

## Commands

```sh
npm run dev       # vite dev server (port 5174)
npm run build     # tsc + vite build
npm run preview   # preview production build
```

## Environment Variables

Vite env vars are read from the root `.env` file. Only `VITE_`-prefixed vars are exposed to client code.

| Variable | Description |
|---|---|
| `VITE_COGNITO_DOMAIN` | Cognito hosted UI domain (omit to skip auth in local dev) |
| `VITE_COGNITO_CLIENT_ID` | Cognito app client ID |
| `VITE_REDIRECT_URI` | OAuth callback URL (defaults to `window.location.origin`) |

## Key Conventions

- The entire app lives in a single `App.tsx` file -- no routing, no state management libraries.
- In dev mode, `/graphql` requests are proxied to `http://localhost:3000` (the admin-api) via Vite's dev server proxy.
- When `VITE_COGNITO_DOMAIN` is not set, auth is skipped entirely for local development.
- In production, the admin-fe static build is deployed to S3 and served via CloudFront. Cognito config is injected at runtime via a `config.js` file (sets `window.__ARENA_CONFIG__`) deployed as a separate S3 object by CDK.
- Uses the Cognito implicit grant flow: the ID token is extracted from the URL hash fragment after redirect.
