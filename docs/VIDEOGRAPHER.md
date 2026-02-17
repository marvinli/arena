# Videographer

The videographer is a headless camera. It opens the front-end in Chrome via `puppeteer-stream`, captures the tab's audio and video as a WebM stream, pipes it through ffmpeg to transcode to H.264/AAC, and pushes to an RTMP endpoint (Twitch, YouTube Live, etc.) or records to a local file. It has zero game logic and zero knowledge of poker — it just films whatever the front-end renders.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  videographer process                                │
│                                                      │
│   Chrome (--app mode, via puppeteer-stream)           │
│     └→ opens front-end at FRONTEND_URL               │
│     └→ tab capture extension → WebM stream (VP8+Opus)│
│                                                      │
│   ffmpeg (child process)                             │
│     └→ stdin: WebM pipe from puppeteer-stream        │
│     └→ transcode: VP8→H.264, Opus→AAC               │
│     └→ output: RTMP (flv) or local MP4 file          │
│                                                      │
│   Config (via .env)                                  │
│     └→ TWITCH_RTMP_URL, YOUTUBE_RTMP_URL, OUTPUT_FILE │
└──────────────────────────────────────────────────────┘
```

The videographer polls the proctor-api's `{ live }` GraphQL query to decide when to start and stop streaming. When `live` becomes `true`, it launches Chrome and begins capture; when `live` becomes `false`, it stops. It doesn't subscribe to SSE, doesn't know about render instructions, and doesn't call `completeInstruction`. It also exposes a tiny health server (`/health`) for monitoring.

## How It Works

The front-end already produces the complete show: cards, animations, TTS audio via the Web Audio API. We just need to capture that output.

`puppeteer-stream` uses a Chrome extension to capture the active tab's video and audio as a single WebM stream (VP8 video + Opus audio). This avoids the complexity of separate video/audio capture pipelines — everything comes muxed from Chrome.

The WebM stream is piped to ffmpeg, which transcodes to H.264/AAC and pushes to RTMP (for Twitch) or writes to a local MP4 file.

## ffmpeg Pipeline

For RTMP streaming:

```bash
ffmpeg \
  -i pipe:0 \                    # WebM from puppeteer-stream
  -c:v libx264 -preset veryfast \ # VP8 → H.264
  -tune zerolatency \            # Low-latency for RTMP
  -pix_fmt yuv420p \
  -r 30 -g 60 \                  # Framerate + keyframe interval
  -b:v 4500k -maxrate 4500k \   # 4.5 Mbps video
  -bufsize 9000k \
  -c:a aac -b:a 160k -ar 44100 \ # Opus → AAC
  -f flv \                       # RTMP container
  rtmp://live.twitch.tv/app/{STREAM_KEY}
```

For local file recording the same pipeline is used, minus `-tune zerolatency` and `-f flv`.

## Configuration

All configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:5173/` | URL to open in Chrome |
| `TWITCH_RTMP_URL` | — | Twitch RTMP ingest (e.g., `rtmp://live.twitch.tv/app/KEY`) |
| `YOUTUBE_RTMP_URL` | — | YouTube RTMP ingest (e.g., `rtmp://a.rtmp.youtube.com/live2/KEY`) |
| `OUTPUT_FILE` | — | Local file path instead of RTMP (e.g., `recording.mp4`) |
| `CAPTURE_WIDTH` | `1920` | Viewport width |
| `CAPTURE_HEIGHT` | `1080` | Viewport height |
| `CAPTURE_FPS` | `30` | Target framerate |
| `CHROME_PATH` | auto-detect | Custom Chrome/Chromium path |
| `HEALTH_PORT` | `3001` | Port for the `/health` endpoint |
| `CHANNEL_KEY` | `local-dev` | Channel key for live flag polling |
| `PROCTOR_URL` | `http://localhost:4001` | proctor-api URL (polled for `{ live }` flag) |

At least one of `TWITCH_RTMP_URL`, `YOUTUBE_RTMP_URL`, or `OUTPUT_FILE` must be set. When multiple RTMP URLs are set, ffmpeg uses the `tee` muxer to simulcast to all destinations with a single encode pass (`onfail=ignore` so one failing doesn't kill the others). RTMP URLs take precedence over `OUTPUT_FILE`.

Chrome is auto-detected on macOS (`/Applications/Google Chrome.app/...`), Linux (`/usr/bin/google-chrome`), and Windows.

## Process Lifecycle

```
1. Start health server on HEALTH_PORT (/health endpoint)
2. Poll proctor-api { live } query every 5 seconds

   When live = true and currently idle:
     3. Wait for front-end to be reachable (HEAD request, up to 30 attempts)
     4. Launch Chrome in --app mode with fixed viewport
     5. Start puppeteer-stream tab capture → WebM stream
     6. Spawn ffmpeg, pipe WebM to stdin
     7. ffmpeg transcodes and pushes to RTMP (or writes to file)

   When live = false and currently streaming:
     8. Stop capture stream, kill ffmpeg, close browser → back to idle

   On SIGTERM/SIGINT:
     9. Stop streaming (if active), close health server, exit
```

The process is long-lived. It automatically starts and stops streaming based on the proctor's live flag. If it crashes, restart it — it will resume polling and start streaming when `live` is true again.

## Package Structure

```
packages/videographer/
  src/
    index.ts          # Entry point — health server, live-flag polling, start/stop streaming, graceful shutdown
    browser.ts        # puppeteer-stream launch + tab capture (WebM VP8+Opus)
    ffmpeg.ts         # Spawn ffmpeg, pipe WebM stdin → RTMP or file
    config.ts         # Env var loading, Chrome auto-detection, validation
  package.json
  tsconfig.json
```

Dependencies:
- `puppeteer` + `puppeteer-stream` — headless Chrome + tab capture
- `dotenv` — env loading

ffmpeg is a system dependency, not an npm package.

## What This Package Does NOT Do

- No game logic. Doesn't know what poker is.
- No rendering. Doesn't draw cards or chips.
- No TTS. The front-end handles TTS via OpenAI — the videographer just captures the audio output.
- No instruction processing. Doesn't call `completeInstruction`.
- No stream management. Doesn't create Twitch channels or manage stream keys.

It is a screen recorder that pushes to RTMP. That's it.
