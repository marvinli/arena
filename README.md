# Arena

AI agents play games against each other on a live stream. A server orchestrates turns, calls LLMs from multiple providers (Anthropic, OpenAI, Google, xAI, DeepSeek, AWS Bedrock), and streams the results to a React front-end with animations and TTS. A headless browser captures the front-end and pushes it to Twitch via RTMP. Currently poker — the game engine is pluggable.

## Quick Start

```sh
cp .env.example .env           # fill in API keys
npm install
npm run proctor-api            # GraphQL server on :4001
npm run front-end              # Vite dev server on :5173
```

Open `http://localhost:5173` and click Start. Agents will begin playing.

To stream to Twitch/YouTube, set `TWITCH_RTMP_URL` and/or `YOUTUBE_RTMP_URL` in `.env` and run `npm run videographer` with both servers already running.

## Project Structure

npm workspaces monorepo — TypeScript, ESM, strict mode throughout.

| Package | What it does |
|---|---|
| `proctor-api` | Game orchestrator + poker engine. GraphQL API with SSE subscriptions. DynamoDB for persistence. |
| `front-end` | Pure renderer — subscribes to SSE instructions, animates the table, plays TTS via Inworld. No game logic. |
| `videographer` | Puppeteer captures the front-end, pipes through ffmpeg to Twitch RTMP (or local file). |
| `admin-api` | Admin control plane. GraphQL API (graphql-yoga, Lambda) with direct DynamoDB/ECS access. Cognito JWT auth. |
| `admin-fe` | Admin dashboard. React SPA — Cognito login, per-container health, service start/stop. |
| `deploy` | AWS CDK infrastructure (DynamoDB, ECS Fargate, Lambda, S3, CloudFront, Cognito). |

## Commands

```sh
npm run proctor-api              # dev server (tsx watch, hot reload)
npm run front-end                # vite dev server
npm run videographer             # headless capture → stream
npm run admin-api                # admin API dev server (tsx watch)
npm run admin-fe                 # admin dashboard dev server (vite, port 5174)
npm run run-game                 # CLI game runner (no front-end needed)
npm run test:proctor-api         # vitest
npm run test:front-end           # vitest
npm run test:videographer        # vitest
npm run test:admin-api           # vitest
npm run check                    # biome lint + format
npm run check:fix                # biome auto-fix
npm run cdk:synth                # synthesize CDK stacks
npm run cdk:deploy               # deploy CDK stacks
npm run cdk:diff                 # diff CDK stacks
```

## Environment Variables

Copy `.env.example` to `.env` at the repo root. You need at least one LLM provider key, plus an Inworld key for TTS:

| Variable | Required | Purpose |
|---|---|---|
| `INWORLD_API_KEY` | No (unless TTS enabled) | TTS (Inworld). Set `VITE_DISABLE_TTS=true` to run without it. |
| `OPENAI_API_KEY` | For GPT agents | GPT agents |
| `ANTHROPIC_API_KEY` | For Claude agents | Claude agents |
| `GOOGLE_GENERATIVE_AI_API_KEY` | For Gemini agents | Gemini agents |
| `XAI_API_KEY` | For Grok agents | Grok agents |
| `DEEPSEEK_API_KEY` | For DeepSeek agents | DeepSeek agents |
| `AWS_REGION` | For Bedrock agents | AWS region (credentials via standard chain) |
| `VITE_DISABLE_TTS` | No | Disable TTS in the front-end (set to `true`) |

| `TWITCH_RTMP_URL` | For Twitch streaming | Twitch RTMP ingest URL |
| `YOUTUBE_RTMP_URL` | For YouTube streaming | YouTube RTMP ingest URL |

## How It Works

1. Front-end subscribes to `renderInstructions` via SSE
2. Proctor runs the game loop — deals cards, calls each agent's LLM on their turn
3. Agents see only their own hand, speak analysis as text, then call a `submit_action` tool
4. Proctor emits render instructions (`DEAL_HANDS`, `PLAYER_ACTION`, `HAND_RESULT`, etc.)
5. Front-end animates each instruction and plays TTS, then ACKs so proctor can continue
6. Videographer captures the browser tab and streams to Twitch

Game config (players, blinds, chips) lives in `packages/proctor-api/src/game-config.ts`.

## Docker

Run the full stack locally in containers:

```sh
cp .env.example .env           # fill in API keys
npm run docker:up              # build and start all containers
npm run docker:down            # stop and remove containers
```

| Container | Port | What it runs |
|---|---|---|
| `app` | [localhost:8080](http://localhost:8080) | Nginx + proctor-api + front-end |
| `videographer` | — | Headless Chrome + ffmpeg (captures app, streams to RTMP) |

Secrets are read from the root `.env` file. The admin service runs as Lambda + S3/CloudFront in production (not Docker). See [docs/ADMIN.md](docs/ADMIN.md) for admin service details and auth configuration.

## Admin Access (Cognito)

The admin dashboard is protected by AWS Cognito. Access is controlled via a Cognito user pool group:

1. Deploy the CDK stacks — this creates the Cognito user pool and an `admin` group
2. Create a user in the Cognito console (or let them sign in via Google OAuth)
3. Add the user to the `admin` group in the Cognito console:
   ```sh
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <pool-id> \
     --username <user-email> \
     --group-name admin
   ```
4. The admin-api checks for the `admin` group in the JWT's `cognito:groups` claim

For local development, set `SKIP_AUTH=true` when running admin-api to bypass auth entirely.
