# Admin Service

Control plane for the Arena stream. Provides health monitoring and start/stop control via an authenticated GraphQL API and a bare-bones web dashboard.

## Architecture

```
Internet → CloudFront (HTTPS) → ALB (:80) → admin container (Nginx:8080)
                                                ├── /            → admin-fe static (public, no auth to load)
                                                └── /graphql     → admin-api (graphql-yoga:3000, Cognito JWT)

Same ECS task (localhost):
  arena-app    → Nginx:80 + proctor-api:4001
  videographer → streaming + health:3001
  admin        → Nginx:8080 + admin-api:3000
```

All three containers share the same Fargate task network namespace and communicate over localhost.

## Auth Flow

1. User opens admin dashboard (CloudFront URL)
2. Clicks "Login" → redirects to Cognito Hosted UI
3. Cognito authenticates → redirects back with `id_token` in URL hash (implicit grant)
4. admin-fe stores token in memory, sends `Authorization: Bearer <token>` with every GraphQL request
5. admin-api verifies JWT against Cognito JWKS (issuer, audience, signature, expiry)

No auth is required to load the SPA itself — only API calls are protected.

## Internal Endpoints

### proctor-api (port 4001)

| Endpoint | Description |
|----------|-------------|
| `GET /health` | `{ status: "ok", session: { channelKey, status, handNumber } \| null }` |
| `query { live(channelKey: String!) }` | Returns `Boolean!` — current live flag value |
| `mutation { setLive(channelKey: String!, live: Boolean!) }` | Persists to DynamoDB settings table, returns new value |

### videographer (port 3001)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ status: "streaming" \| "idle" \| "starting" \| "error" }` |

These are internal-only REST endpoints. They are not exposed to the internet.

## Admin API (`packages/admin-api/`)

graphql-yoga server with Cognito JWT auth. Proxies all operations to proctor-api and videographer internal endpoints. Exposed via CloudFront → ALB at `/graphql`. All operations require a valid Cognito JWT (unless `SKIP_AUTH=true`).

### Source Structure

```
src/
  index.ts    # Schema, resolvers, yoga server with JWT context
  auth.ts     # Cognito JWT verification via jose (JWKS, issuer, audience)
```

### Auth Implementation

Uses `jose` to verify JWTs against Cognito's JWKS endpoint. The `verifyToken` function checks issuer (`https://cognito-idp.<region>.amazonaws.com/<poolId>`), audience (client ID), signature, and expiry. Returns `{ sub, email }` from the token payload. When `SKIP_AUTH=true`, the context returns a hardcoded local dev user instead.

### Schema

```graphql
type ServiceHealth {
  status: String!
}

type Health {
  proctor: ServiceHealth!
  videographer: ServiceHealth!
}

type Query {
  health: Health!
  live: Boolean!
}

type Mutation {
  setLive(live: Boolean!): Boolean!
  resetDatabase: Boolean!
}
```

### Resolvers

- `health` — fetches `GET localhost:4001/health` and `GET localhost:3001/health`, returns aggregate
- `live` — queries `localhost:4001/graphql` for `{ live(channelKey) }` using `CHANNEL_KEY` from env, returns the boolean
- `setLive(live)` — calls `mutation { setLive(channelKey, live) }` on `localhost:4001/graphql` using `CHANNEL_KEY` from env, returns new value
- `resetDatabase` — calls `mutation { resetDatabase(channelKey) }` on `localhost:4001/graphql` using `CHANNEL_KEY` from env

## Live Flag Behavior

The `live` flag is persisted in proctor-api's DynamoDB `settings` table (as `live:${channelKey}`). Defaults to `false` on first boot.

### When `live` is set to `false` (stop)

- **proctor-api**: current hand completes, then the programming loop pauses (polls every 5s)
- **videographer**: detects `live=false`, gracefully stops ffmpeg and closes the browser, enters idle state

### When `live` is set to `true` (start)

- **proctor-api**: programming loop resumes, starts a new game
- **videographer**: detects `live=true`, launches browser capture and ffmpeg, begins streaming

## Admin Dashboard (`packages/admin-fe/`)

Bare-bones React SPA (Vite + React 19). No router — single-page with conditional rendering.

### Source Structure

```
src/
  main.tsx       # React root
  App.tsx        # Login page, Dashboard component, GraphQL client
  vite-env.d.ts  # Vite type reference
```

### Pages

- **Login page**: single "Login with Cognito" button → Cognito Hosted UI redirect (implicit grant). Shown when a Cognito domain is configured and no token is present.
- **Dashboard**: health indicators (green/red dots) for proctor and videographer, live/stopped status with start/stop toggle button. Polls `health` and `live` queries every 10 seconds.

### Auth Bypass

When no Cognito domain is configured (`VITE_COGNITO_DOMAIN` not set at build time and `COGNITO_DOMAIN` not injected at runtime), the login page is skipped and the Dashboard renders immediately without a token. This is the default behavior in local dev and Docker without Cognito setup. The admin-api must also have `SKIP_AUTH=true` for unauthenticated requests to succeed.

### Runtime Config Injection

Cognito settings can be provided two ways: baked in at build time via `VITE_*` env vars, or injected at runtime via `window.__ARENA_CONFIG__` (written by `entrypoint-admin.sh` from environment variables). Runtime values take precedence.

### Dev Server

Runs on port 5174 (`npm run admin-fe`). Proxies `/graphql` to `http://localhost:3000` (admin-api) via Vite config.

## Local Development

```sh
npm run proctor-api              # must be running on :4001
SKIP_AUTH=true npm run admin-api # GraphQL API on :3000, auth bypassed
npm run admin-fe                 # dashboard on :5174, proxies /graphql → :3000
```

Open `http://localhost:5174`. With no `VITE_COGNITO_DOMAIN` set, the login page is skipped and the dashboard loads directly.

## Environment Variables

### admin-api

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `PROCTOR_URL` | proctor-api base URL (default: `http://localhost:4001`) |
| `VIDEOGRAPHER_URL` | videographer base URL (default: `http://localhost:3001`) |
| `CHANNEL_KEY` | Channel key for proctor-api queries (default: `poker-stream-1`) |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID for JWT verification |
| `COGNITO_CLIENT_ID` | Cognito App Client ID |
| `COGNITO_DOMAIN` | Cognito Hosted UI domain (injected into admin-fe at runtime via entrypoint) |
| `AWS_REGION` | AWS region (default: us-east-1) |
| `SKIP_AUTH` | Set to `"true"` to bypass JWT verification (local dev only) |

### admin-fe (build-time)

| Variable | Description |
|----------|-------------|
| `VITE_COGNITO_DOMAIN` | Cognito Hosted UI domain (e.g., `arena-admin.auth.us-east-1.amazoncognito.com`) |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_REDIRECT_URI` | OAuth redirect URI (the CloudFront URL) |
