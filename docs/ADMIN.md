# Admin Service

Control plane for the Arena stream. Provides health monitoring and start/stop control via an authenticated GraphQL API and a bare-bones web dashboard.

## Architecture

```
Internet → ALB (:80) → admin container (Nginx:8080)
                           ├── /            → admin-fe static (public, no auth to load)
                           └── /graphql     → admin-api (graphql-yoga:3000, Cognito JWT)

Same ECS task (localhost):
  arena-app    → Nginx:80 + proctor-api:4001
  videographer → streaming + health:3001
  admin        → Nginx:8080 + admin-api:3000
```

All three containers share the same Fargate task network namespace and communicate over localhost.

## Auth Flow

1. User opens admin dashboard (ALB URL)
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
| `query { live }` | Returns `Boolean!` — current live flag value |
| `mutation { setLive(live: Boolean!) }` | Persists to SQLite settings table, returns new value |

### videographer (port 3001)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ status: "streaming" \| "idle" \| "starting" \| "error" }` |

These are internal-only REST endpoints. They are not exposed to the internet.

## Admin API (GraphQL)

Exposed via ALB at `/graphql`. All operations require a valid Cognito JWT.

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
}
```

### Resolvers

- `health` — fetches `GET localhost:4001/health` and `GET localhost:3001/health`, returns aggregate
- `live` — queries `localhost:4001/graphql` for `{ live }`, returns the boolean
- `setLive(live)` — calls `mutation { setLive(live) }` on `localhost:4001/graphql`, returns new value

## Live Flag Behavior

The `live` flag is persisted in proctor-api's SQLite `settings` table. Defaults to `false` on first boot.

### When `live` is set to `false` (stop)

- **proctor-api**: current hand completes, then the programming loop pauses (polls every 5s)
- **videographer**: detects `live=false`, gracefully stops ffmpeg and closes the browser, enters idle state

### When `live` is set to `true` (start)

- **proctor-api**: programming loop resumes, starts a new game
- **videographer**: detects `live=true`, launches browser capture and ffmpeg, begins streaming

## Admin Dashboard (admin-fe)

Bare-bones React SPA:

- **Login page**: single "Login" button → Cognito Hosted UI redirect
- **Dashboard**: health indicators (green/red) for proctor and videographer, start/stop toggle button
- Polls `health` query every 10 seconds

## Packages

- `packages/admin-api/` — graphql-yoga server, Cognito JWT auth, proxies to internal endpoints
- `packages/admin-fe/` — Vite React app, Cognito login, health dashboard

## Environment Variables

### admin-api

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID for JWT verification |
| `COGNITO_CLIENT_ID` | Cognito App Client ID |
| `AWS_REGION` | AWS region (default: us-east-1) |

### admin-fe (build-time)

| Variable | Description |
|----------|-------------|
| `VITE_COGNITO_DOMAIN` | Cognito Hosted UI domain (e.g., `arena-admin.auth.us-east-1.amazoncognito.com`) |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_REDIRECT_URI` | OAuth redirect URI (the ALB URL) |
