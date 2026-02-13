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

To stream to Twitch, set `RTMP_URL` in `.env` and run `npm run videographer` with both servers already running.

## Project Structure

npm workspaces monorepo — TypeScript, ESM, strict mode throughout.

| Package | What it does |
|---|---|
| `proctor-api` | Game orchestrator + poker engine. GraphQL API with SSE subscriptions. SQLite for persistence. |
| `front-end` | Pure renderer — subscribes to SSE instructions, animates the table, plays TTS via OpenAI. No game logic. |
| `videographer` | Puppeteer captures the front-end, pipes through ffmpeg to Twitch RTMP (or local file). |
| `admin-api` | Admin control plane. GraphQL API (graphql-yoga) that proxies to proctor-api and videographer. Cognito JWT auth. |
| `admin-fe` | Admin dashboard. React SPA — Cognito login, health indicators, start/stop toggle. |
| `deploy` | AWS CDK infrastructure (ECS Fargate, ALB, CloudFront). |

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
npm run check                    # biome lint + format
npm run check:fix                # biome auto-fix
```

## Environment Variables

Copy `.env.example` to `.env` at the repo root. You need at least one LLM provider key, plus an OpenAI key for TTS:

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes | TTS + GPT agents |
| `ANTHROPIC_API_KEY` | For Claude agents | Claude agents |
| `GOOGLE_GENERATIVE_AI_API_KEY` | For Gemini agents | Gemini agents |
| `XAI_API_KEY` | For Grok agents | Grok agents |
| `DEEPSEEK_API_KEY` | For DeepSeek agents | DeepSeek agents |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | For Bedrock agents | Bedrock agents |

| `RTMP_URL` | For Twitch streaming | Videographer RTMP ingest URL |

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
| `admin` | [localhost:8081](http://localhost:8081) | Nginx + admin-api + admin dashboard |
| `videographer` | — | Headless Chrome + ffmpeg (captures app, streams to RTMP) |

Secrets are read from the root `.env` file. See [docs/ADMIN.md](docs/ADMIN.md) for admin service details and auth configuration.
