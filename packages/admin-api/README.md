# Admin API

GraphQL API for the Arena admin dashboard. Reads/writes DynamoDB directly and manages the ECS Fargate service, with JWT authentication via AWS Cognito. Deployed as a Lambda function in production, with a standalone HTTP server for local development.

## How It Works

The admin-api does not contain game logic. It exposes a small GraphQL schema that:

- **Queries**: `live` (reads the live flag from DynamoDB), `serviceStatus` (describes the ECS Fargate service)
- **Mutations**: `setLive` (toggles the stream on/off in DynamoDB), `resetDatabase` (scans and batch-deletes all game tables), `startService` / `stopService` (sets ECS desired count to 1 or 0)

The API talks directly to DynamoDB and ECS — it does not proxy to the proctor-api. Authentication uses Cognito JWT tokens verified via JWKS (using the `jose` library). Set `SKIP_AUTH=true` to bypass auth for local development.

## Entry Points

- `src/yoga.ts` — shared graphql-yoga server (schema, resolvers, JWT context)
- `src/index.ts` — standalone `node:http` server wrapping `yoga` (local dev)
- `src/lambda.ts` — Lambda handler wrapping `yoga` (production, behind Lambda Function URL)

## Commands

```sh
npm run dev          # tsx watch (hot reload, local HTTP server)
npm run build        # tsc
npm run build:lambda # esbuild bundle for Lambda deployment
npm run start        # node dist/index.js (production HTTP server)
npm run test         # vitest
```

## Environment Variables

All env vars are read from the root `.env` file.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server listen port (local dev only) |
| `CHANNEL_KEY` | `poker-stream-1` | Channel key for scoping live flag and data |
| `TABLE_PREFIX` | `arena-` | DynamoDB table name prefix |
| `ECS_CLUSTER_NAME` | - | ECS cluster name for service management |
| `ECS_SERVICE_NAME` | - | ECS service name for start/stop control |
| `SKIP_AUTH` | - | Set to `true` to bypass JWT auth (local dev) |
| `AWS_REGION` | `us-east-1` | AWS region for Cognito |
| `COGNITO_USER_POOL_ID` | - | Cognito user pool ID (required in production) |
| `COGNITO_CLIENT_ID` | - | Cognito app client ID (required in production) |

## Key Conventions

- GraphQL schema defined inline in `yoga.ts` with `graphql-yoga` and `createSchema`.
- Auth middleware runs in the Yoga context function — every request must include a `Bearer` token unless `SKIP_AUTH` is set.
- The `yoga` instance is shared between the local HTTP server and the Lambda handler.
- Tests use vitest with mocked AWS SDK clients (DynamoDB, ECS) and mock auth. Both the yoga `fetch` and Lambda handler paths are tested.
