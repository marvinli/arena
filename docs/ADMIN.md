# Admin Service

Control plane for the Arena stream. Provides health monitoring and start/stop control via an authenticated GraphQL API and a bare-bones web dashboard.

## Architecture

```
Internet → CloudFront (HTTPS) ──┬── /           → S3 (admin-fe static build)
                                └── /graphql    → Lambda Function URL (admin-api, Cognito JWT)

Separate ECS Fargate task (managed by admin-api via ECS API):
  arena-app    → Nginx:80 + proctor-api:4001
  videographer → streaming + health:3001
```

The admin-api runs as a Lambda function (not in the ECS task). It talks directly to DynamoDB for game data and to the ECS API to start/stop the arena service. The admin-fe is a static S3 website served by CloudFront.

## Auth Flow

1. User opens admin dashboard (CloudFront URL)
2. Clicks "Login" → redirects to Cognito Hosted UI
3. Cognito authenticates → redirects back with `id_token` in URL hash (implicit grant)
4. admin-fe stores token in memory, sends `Authorization: Bearer <token>` with every GraphQL request
5. admin-api verifies JWT against Cognito JWKS (issuer, audience, signature, expiry)

No auth is required to load the SPA itself — only API calls are protected.

## AWS Resources

The admin-api Lambda interacts with these AWS services directly:

- **DynamoDB** — reads/writes the `settings` table (live flag), scans/deletes game data tables (`modules`, `instructions`, `channel-state`, `agent-messages`)
- **ECS** — `DescribeServices` for service status, `UpdateService` to start (desiredCount=1) or stop (desiredCount=0) the arena Fargate service

## Admin API (`packages/admin-api/`)

graphql-yoga server with Cognito JWT auth. Talks directly to DynamoDB and ECS. Deployed as a Lambda function behind a Lambda Function URL, exposed via CloudFront at `/graphql`. All operations require a valid Cognito JWT (unless `SKIP_AUTH=true`).

### Source Structure

```
src/
  yoga.ts     # Schema, resolvers, yoga server with JWT context (shared)
  index.ts    # Standalone HTTP server for local dev
  lambda.ts   # Lambda handler for production (wraps yoga)
  auth.ts     # Cognito JWT verification via jose (JWKS, issuer, audience)
test/
  admin-api.test.ts  # Vitest tests with mocked AWS SDK (DynamoDB, ECS, auth)
```

### Auth Implementation

Uses `jose` to verify JWTs against Cognito's JWKS endpoint. The `verifyToken` function checks issuer (`https://cognito-idp.<region>.amazonaws.com/<poolId>`), audience (client ID), signature, and expiry. Returns `{ sub, email }` from the token payload. When `SKIP_AUTH=true`, the context returns a hardcoded local dev user instead.

### Schema

```graphql
type ServiceStatus {
  status: String!
  runningCount: Int
  desiredCount: Int
  lastEvent: String
}

type Query {
  live: Boolean!
  serviceStatus: ServiceStatus!
}

type Mutation {
  setLive(live: Boolean!): Boolean!
  resetDatabase: Boolean!
  startService: Boolean!
  stopService: Boolean!
}
```

### Resolvers

- `live` — reads `live:${CHANNEL_KEY}` from the DynamoDB settings table
- `serviceStatus` — calls `DescribeServices` on ECS to get the arena Fargate service status (running count, desired count, last event)
- `setLive(live)` — writes `live:${CHANNEL_KEY}` to the DynamoDB settings table
- `resetDatabase` — scans and batch-deletes all items from the modules, instructions, channel-state, and agent-messages DynamoDB tables
- `startService` — calls `UpdateService` on ECS with `desiredCount: 1`
- `stopService` — calls `UpdateService` on ECS with `desiredCount: 0`

## Live Flag Behavior

The `live` flag is persisted in the DynamoDB `settings` table (as `live:${channelKey}`), written directly by the admin-api Lambda. Defaults to `false` on first boot.

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

When no Cognito domain is configured (`VITE_COGNITO_DOMAIN` not set at build time and `cognitoDomain` not present in `window.__ARENA_CONFIG__`), the login page is skipped and the Dashboard renders immediately without a token. This is the default behavior in local dev. The admin-api must also have `SKIP_AUTH=true` for unauthenticated requests to succeed.

### Runtime Config Injection

Cognito settings can be provided two ways: baked in at build time via `VITE_*` env vars, or injected at runtime via `window.__ARENA_CONFIG__`. In production, CDK deploys a `config.js` file to the S3 bucket containing the resolved Cognito domain and client ID. The SPA loads this script, and runtime values take precedence over build-time env vars.

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
| `PORT` | Server port for local dev (default: 3000) |
| `CHANNEL_KEY` | Channel key for scoping live flag and data (default: `poker-stream-1`) |
| `TABLE_PREFIX` | DynamoDB table name prefix (default: `arena-`) |
| `ECS_CLUSTER_NAME` | ECS cluster name for service management |
| `ECS_SERVICE_NAME` | ECS service name for start/stop control |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID for JWT verification |
| `COGNITO_CLIENT_ID` | Cognito App Client ID |
| `AWS_REGION` | AWS region (default: us-east-1) |
| `SKIP_AUTH` | Set to `"true"` to bypass JWT verification (local dev only) |

### admin-fe (build-time)

| Variable | Description |
|----------|-------------|
| `VITE_COGNITO_DOMAIN` | Cognito Hosted UI domain (e.g., `arena-admin.auth.us-east-1.amazoncognito.com`) |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_REDIRECT_URI` | OAuth redirect URI (the CloudFront URL) |
