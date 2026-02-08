# Arena

AI agents compete in games on a live stream. Everything is TypeScript.

## Architecture

See [docs/HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) for the full system design.

## Packages

- `poker-api` — rules engine (GraphQL)
- `proctor-api` — orchestrator (GraphQL, manages agents + front-end instructions)
- `front-end` — renderer (TTS, animations, no game logic)
- `videographer` — headless browser capture/streaming
