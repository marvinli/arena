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
│     └→ RTMP_URL or OUTPUT_FILE, resolution, fps      │
└──────────────────────────────────────────────────────┘
```

The videographer has no connection to the proctor-api. It doesn't subscribe to GraphQL, doesn't know about instructions, and doesn't call `completeInstruction`. It is a dumb screen recorder pointed at a URL.

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
  -b:v 6000k \                   # 6 Mbps video
  -c:a aac -b:a 128k \           # Opus → AAC
  -f flv \                       # RTMP container
  rtmp://live.twitch.tv/app/{STREAM_KEY}
```

For local file recording:

```bash
ffmpeg \
  -i pipe:0 \                    # WebM from puppeteer-stream
  -c:v libx264 -preset veryfast \
  -c:a aac \
  output.mp4
```

## Configuration

All configuration via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:5173/` | URL to open in Chrome |
| `RTMP_URL` | — | RTMP ingest endpoint (e.g., `rtmp://live.twitch.tv/app/KEY`) |
| `OUTPUT_FILE` | — | Local file path instead of RTMP (e.g., `recording.mp4`) |
| `CAPTURE_WIDTH` | `1920` | Viewport width |
| `CAPTURE_HEIGHT` | `1080` | Viewport height |
| `CAPTURE_FPS` | `30` | Target framerate |
| `CHROME_PATH` | auto-detect | Custom Chrome/Chromium path |

Either `RTMP_URL` or `OUTPUT_FILE` must be set (not both).

Chrome is auto-detected on macOS (`/Applications/Google Chrome.app/...`), Linux (`/usr/bin/google-chrome`), and Windows.

## Process Lifecycle

```
1. Wait for front-end to be reachable (HEAD request health check)
2. Launch Chrome in --app mode with fixed viewport
3. Navigate to FRONTEND_URL
4. Start puppeteer-stream tab capture → WebM stream
5. Spawn ffmpeg, pipe WebM to stdin
6. ffmpeg transcodes and pushes to RTMP (or writes to file)

   ... runs indefinitely until stopped ...

7. On SIGTERM/SIGINT:
   - Stop capture stream
   - Kill ffmpeg
   - Close browser
   - Exit
```

The process is long-lived and stateless. If it crashes, restart it — it'll reconnect to whatever the front-end is showing.

## Package Structure

```
packages/videographer/
  src/
    index.ts          # Entry point — health check, launch browser, start capture, graceful shutdown
    browser.ts        # puppeteer-stream launch + tab capture (WebM VP8+Opus)
    ffmpeg.ts         # Spawn ffmpeg, pipe WebM stdin → RTMP or file
    config.ts         # Env var loading, Chrome auto-detection, validation
  .env.example
  package.json
  tsconfig.json
```

Dependencies:
- `puppeteer` + `puppeteer-stream` — headless Chrome + tab capture
- `dotenv` — env loading

ffmpeg is a system dependency, not an npm package.

## What This Package Does NOT Do

- No game logic. Doesn't know what poker is.
- No GraphQL. Doesn't talk to proctor-api.
- No rendering. Doesn't draw cards or chips.
- No TTS. The front-end handles TTS via OpenAI — the videographer just captures the audio output.
- No instruction processing. Doesn't call `completeInstruction`.
- No stream management. Doesn't create Twitch channels or manage stream keys.

It is a screen recorder that pushes to RTMP. That's it.
