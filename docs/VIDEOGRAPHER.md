# Videographer — Design Doc

The videographer is a headless camera. It opens the front-end in a browser, captures the tab's audio and video, muxes them into a single stream, and pushes it to an RTMP endpoint (Twitch, YouTube Live, etc.). It has zero game logic and zero knowledge of poker — it just films whatever the front-end renders.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  videographer process                           │
│                                                 │
│   Puppeteer (headless Chrome)                   │
│     └→ opens front-end at http://localhost:5173  │
│     └→ CDP: Page.startScreencast (video frames) │
│     └→ CDP: tab audio capture via PulseAudio    │
│                                                 │
│   ffmpeg                                        │
│     └→ stdin: raw video frames (pipe)           │
│     └→ audio: PulseAudio virtual sink           │
│     └→ output: rtmp://live.twitch.tv/app/{key}  │
│                                                 │
│   Config                                        │
│     └→ RTMP_URL, resolution, fps, bitrate       │
└─────────────────────────────────────────────────┘
```

The videographer has no connection to the proctor-api. It doesn't subscribe to GraphQL, doesn't know about instructions, and doesn't call `renderComplete`. It is a dumb screen recorder pointed at a URL.

## Why Headless Chrome + ffmpeg

- The front-end already produces the complete show: cards, animations, TTS audio via the Web Audio API / HTML5 `<audio>`. We just need to capture that output.
- Chrome DevTools Protocol (CDP) gives us frame-level video capture. PulseAudio (on Linux) or virtual audio devices let us tap the tab's audio output.
- ffmpeg is the standard tool for muxing audio + video and pushing to RTMP. It handles encoding, bitrate control, and reconnection.
- No custom rendering, no canvas manipulation, no re-implementation of the front-end.

## Video Capture

Use Puppeteer to launch Chrome and navigate to the front-end URL. Chrome runs with a fixed viewport matching the stream resolution (e.g., 1920x1080).

Two viable approaches for getting frames into ffmpeg:

### Option A: CDP Screencast (simpler, lower quality)

`Page.startScreencast` sends JPEG/PNG frames over CDP at a target framerate. Pipe these to ffmpeg's stdin as raw image input.

- Pros: Simple. No OS-level dependencies. Works on macOS and Linux.
- Cons: CPU-intensive encoding of individual frames. Capped at ~30fps. JPEG compression artifacts before ffmpeg re-encodes.

### Option B: Virtual display + X11 capture (production)

Run Chrome on a virtual X11 display (Xvfb). Point ffmpeg's `x11grab` input at that display.

- Pros: Native framerate. No per-frame serialization overhead. Clean pipeline.
- Cons: Linux only. Requires Xvfb. Slightly more setup.

**Recommendation:** Start with Option A for local dev (works anywhere). Use Option B in production (ECS Linux container).

## Audio Capture

The front-end plays TTS audio through HTML5 `<audio>` elements. We need to route Chrome's audio output to ffmpeg.

### Linux (production)

Use PulseAudio to create a virtual sink. Launch Chrome with `PULSE_SINK=arena_capture`. Point ffmpeg at the PulseAudio monitor source for that sink.

```bash
# Create virtual sink
pactl load-module module-null-sink sink_name=arena_capture

# Chrome plays audio into the sink
PULSE_SINK=arena_capture chromium --no-sandbox ...

# ffmpeg reads from the sink's monitor
ffmpeg -f pulse -i arena_capture.monitor ...
```

### macOS (local dev)

Use BlackHole or similar virtual audio device. Chrome outputs to BlackHole, ffmpeg reads from it.

Alternatively, skip audio capture for local dev and test video-only. Audio capture on macOS is fiddly and not worth debugging for dev purposes.

## ffmpeg Pipeline

```bash
ffmpeg \
  # Video input (Option A: piped frames)
  -f image2pipe -framerate 30 -i pipe:0 \
  # Audio input (PulseAudio)
  -f pulse -i arena_capture.monitor \
  # Video encoding
  -c:v libx264 -preset veryfast -tune zerolatency \
  -b:v 4500k -maxrate 4500k -bufsize 9000k \
  -g 60 -keyint_min 60 \
  -pix_fmt yuv420p \
  # Audio encoding
  -c:a aac -b:a 160k -ar 44100 \
  # Output
  -f flv rtmp://live.twitch.tv/app/{STREAM_KEY}
```

For Option B (x11grab), replace the video input:

```bash
ffmpeg \
  -f x11grab -framerate 30 -video_size 1920x1080 -i :99 \
  -f pulse -i arena_capture.monitor \
  # ... same encoding and output
```

Key encoding choices:
- `libx264` with `veryfast` preset — good quality-to-CPU ratio for live streaming
- `zerolatency` tune — minimizes encode latency
- 4500 kbps video bitrate — Twitch recommended for 1080p30
- Keyframe interval of 60 frames (2 seconds) — required by most RTMP ingest servers
- AAC audio at 160 kbps — standard for live streaming

## Configuration

All configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:5173` | URL to open in headless Chrome |
| `RTMP_URL` | (required) | RTMP ingest endpoint with stream key |
| `RESOLUTION` | `1920x1080` | Viewport and output resolution |
| `FRAMERATE` | `30` | Target framerate |
| `VIDEO_BITRATE` | `4500k` | Video bitrate |
| `AUDIO_BITRATE` | `160k` | Audio bitrate |
| `CAPTURE_MODE` | `screencast` | `screencast` (Option A) or `x11grab` (Option B) |

## Auto-Start Behavior

The videographer navigates to the front-end URL. The front-end's `StartScreen` is shown until someone clicks "Start Game" or a game is already running.

Two options:

1. **Manual start** — a human (or separate script) hits the start button through the front-end. The videographer just records whatever is on screen, including the idle start screen.
2. **Auto-start via URL param** — the front-end accepts `?autostart` which automatically calls `startGame()` on mount. The videographer navigates to `http://localhost:5173/?autostart`. No manual intervention needed.

Option 2 is better for unattended streaming. The front-end change is trivial (3 lines in `App.tsx`).

## Process Lifecycle

```
1. Start Puppeteer with fixed viewport
2. Navigate to FRONTEND_URL
3. Wait for page load
4. Start ffmpeg child process with RTMP output
5. Begin frame capture → pipe to ffmpeg
6. Begin audio routing → ffmpeg reads from sink

   ... runs indefinitely until stopped ...

7. On SIGTERM/SIGINT:
   - Stop frame capture
   - Send 'q' to ffmpeg stdin (graceful shutdown)
   - Wait for ffmpeg to flush and close
   - Close browser
   - Exit
```

The process is long-lived and stateless. If it crashes, restart it — it'll reconnect to whatever the front-end is showing. If the front-end isn't running, it'll show a blank page (or an error screen) until the front-end comes up.

## Package Structure

```
packages/videographer/
  src/
    index.ts          # Entry point — parse config, launch browser, start capture
    browser.ts        # Puppeteer launch + navigation + frame capture
    ffmpeg.ts         # Spawn ffmpeg, pipe management, RTMP output
    audio.ts          # PulseAudio sink setup (Linux) / no-op (macOS)
  package.json
  tsconfig.json
```

Minimal dependencies:
- `puppeteer` — headless Chrome
- No web framework, no GraphQL, no React

ffmpeg and PulseAudio are system dependencies, not npm packages.

## Deployment (ECS)

```dockerfile
FROM node:20-slim

# System deps
RUN apt-get update && apt-get install -y \
  chromium ffmpeg xvfb pulseaudio \
  && rm -rf /var/lib/apt/lists/*

COPY packages/videographer /app
WORKDIR /app
RUN npm install

# Start Xvfb + PulseAudio + videographer
CMD ["./entrypoint.sh"]
```

`entrypoint.sh`:
```bash
#!/bin/bash
Xvfb :99 -screen 0 1920x1080x24 &
pulseaudio --start
pactl load-module module-null-sink sink_name=arena_capture
export DISPLAY=:99
export PULSE_SINK=arena_capture
export CAPTURE_MODE=x11grab
node src/index.js
```

ECS task definition points `FRONTEND_URL` to the CloudFront distribution and `RTMP_URL` to the streaming platform's ingest server.

## What This Package Does NOT Do

- No game logic. Doesn't know what poker is.
- No GraphQL. Doesn't talk to proctor-api.
- No rendering. Doesn't draw cards or chips.
- No TTS. Doesn't call ElevenLabs (the front-end does).
- No instruction processing. Doesn't ack `renderComplete`.
- No stream management. Doesn't create Twitch channels or manage stream keys.
- No chat integration. Doesn't read or post to Twitch/YouTube chat.

It is a screen recorder that pushes to RTMP. That's it.
