# Videographer

Headless browser capture service that records the Arena front-end and streams it to Twitch (or a local file). Uses Puppeteer with `puppeteer-stream` for tab capture and ffmpeg for transcoding to H.264/AAC FLV.

## How It Works

The service polls the proctor-api `{ live }` GraphQL query every 5 seconds. When the live flag is set, it launches Chrome in `--app` mode (no browser UI), captures the tab's video+audio via a Chrome extension, pipes the WebM stream through ffmpeg for H.264 transcoding, and pushes it to an RTMP ingest URL. When the live flag is cleared, it tears down the pipeline and returns to idle.

A health endpoint on `HEALTH_PORT` (default 3001) reports the current status: `idle`, `starting`, `streaming`, or `error`.

## Commands

```sh
npm run dev      # tsx watch (hot reload)
npm run build    # tsc
npm run start    # node dist/index.js (production)
```

## Environment Variables

All env vars are read from the root `.env` file. Required variables:

| Variable | Description |
|---|---|
| `RTMP_URL` | RTMP ingest URL (e.g. `rtmp://live.twitch.tv/app/KEY`). Mutually exclusive with `OUTPUT_FILE`. |
| `OUTPUT_FILE` | Local file path for recording (e.g. `recording.mp4`). Mutually exclusive with `RTMP_URL`. |

Optional variables:

| Variable | Default | Description |
|---|---|---|
| `FRONTEND_URL` | `http://localhost:5173/` | URL of the front-end to capture |
| `PROCTOR_URL` | `http://localhost:4001` | Proctor API base URL (for live flag polling) |
| `CAPTURE_WIDTH` | `1920` | Viewport width in pixels |
| `CAPTURE_HEIGHT` | `1080` | Viewport height in pixels |
| `CAPTURE_FPS` | `30` | Video framerate |
| `CHROME_PATH` | Platform default | Path to Chrome/Chromium executable |
| `HEALTH_PORT` | `3001` | Health server port |

## Key Conventions

- Requires a real Chrome installation (not headless) because `puppeteer-stream` uses a Chrome extension for tab capture.
- ffmpeg must be installed and available on `PATH`.
- The service waits up to 60 seconds for the front-end to become reachable before starting capture.
- Video is transcoded from VP8 to H.264 at 4500 kbps; audio from Opus to AAC at 160 kbps.
- When streaming to RTMP, ffmpeg uses `-tune zerolatency` for low-latency output.
- Graceful shutdown on SIGTERM/SIGINT: stops ffmpeg, closes the browser, then exits.
