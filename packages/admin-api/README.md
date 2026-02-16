# Admin API

GraphQL API gateway for the Arena admin dashboard. Proxies health checks and control operations to the proctor-api and videographer services, with JWT authentication via AWS Cognito.

## How It Works

The admin-api does not contain game logic. It exposes a small GraphQL schema that:

- **Queries**: `health` (aggregates proctor + videographer health status), `live` (reads the live flag from the proctor)
- **Mutations**: `setLive` (toggles the stream on/off), `resetDatabase` (clears game data via the proctor)

All operations proxy to the proctor-api's GraphQL endpoint. Authentication uses Cognito JWT tokens verified via JWKS (using the `jose` library). Set `SKIP_AUTH=true` to bypass auth for local development.

## Commands

```sh
npm run dev      # tsx watch (hot reload)
npm run build    # tsc
npm run start    # node dist/index.js (production)
```

## Environment Variables

All env vars are read from the root `.env` file.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server listen port |
| `PROCTOR_URL` | `http://localhost:4001` | Proctor API base URL |
| `VIDEOGRAPHER_URL` | `http://localhost:3001` | Videographer health endpoint URL |
| `CHANNEL_KEY` | `poker-stream-1` | Channel key for scoping live flag and data |
| `SKIP_AUTH` | - | Set to `true` to bypass JWT auth (local dev) |
| `AWS_REGION` | `us-east-1` | AWS region for Cognito |
| `COGNITO_USER_POOL_ID` | - | Cognito user pool ID (required in production) |
| `COGNITO_CLIENT_ID` | - | Cognito app client ID (required in production) |

## Key Conventions

- Single-file GraphQL schema defined inline with `graphql-yoga` and `createSchema`.
- Auth middleware runs in the Yoga context function -- every request must include a `Bearer` token unless `SKIP_AUTH` is set.
- The server is a pure proxy layer; all business logic lives in proctor-api.
