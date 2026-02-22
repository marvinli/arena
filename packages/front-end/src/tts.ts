const INWORLD_API_KEY = import.meta.env.INWORLD_API_KEY as string | undefined;
const DISABLE_TTS = import.meta.env.VITE_DISABLE_TTS === "true";

console.log(
  "[TTS] config:",
  "inworldKey=" +
    (INWORLD_API_KEY ? `set(${INWORLD_API_KEY.length}chars)` : "MISSING"),
  `disabled=${DISABLE_TTS}`,
);

const INWORLD_PCM_SAMPLE_RATE = 48000;

// ── Shared PCM playback ─────────────────────────────────

interface ChunkResult {
  nextStartTime: number;
  source: AudioBufferSourceNode;
}

function schedulePcmChunk(
  ctx: AudioContext,
  data: Uint8Array,
  nextStartTime: number,
  sampleRate: number,
): ChunkResult {
  const int16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  const buffer = ctx.createBuffer(1, float32.length, sampleRate);
  buffer.copyToChannel(float32, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  const startAt = Math.max(nextStartTime, ctx.currentTime);
  source.start(startAt);
  return { nextStartTime: startAt + buffer.duration, source };
}

/** Align raw bytes to 16-bit boundary, returning [aligned, leftover]. */
function alignPcm(
  leftover: Uint8Array,
  incoming: Uint8Array,
): [aligned: Uint8Array, rest: Uint8Array] {
  let data: Uint8Array;
  if (leftover.length > 0) {
    data = new Uint8Array(leftover.length + incoming.length);
    data.set(leftover);
    data.set(incoming, leftover.length);
  } else {
    data = incoming;
  }

  if (data.length % 2 !== 0) {
    return [
      new Uint8Array(data.buffer.slice(0, data.length - 1)),
      new Uint8Array(data.buffer.slice(data.length - 1)),
    ];
  }
  return [data, new Uint8Array(0)];
}

async function waitForPlayback(
  ctx: AudioContext,
  lastSource: AudioBufferSourceNode | null,
) {
  if (lastSource) {
    await new Promise<void>((resolve) => {
      // If playback already finished, resolve immediately
      if (lastSource.context.state === "closed") {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 30_000); // safety timeout
      lastSource.onended = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
  await ctx.close();
}

// ── InWorld TTS ─────────────────────────────────────────

const RIFF_HEADER_SIZE = 44;

/**
 * Stream InWorld TTS: newline-delimited JSON with base64 LINEAR16 audio.
 * Each line is `{ "result": { "audioContent": "<base64>" } }`.
 */
async function speakInworld(text: string, voice: string): Promise<boolean> {
  const res = await fetch("https://api.inworld.ai/tts/v1/voice:stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${INWORLD_API_KEY}`,
    },
    body: JSON.stringify({
      text,
      voice_id: voice,
      model_id: "inworld-tts-1.5-mini",
      audio_config: {
        audio_encoding: "LINEAR16",
        sample_rate_hertz: INWORLD_PCM_SAMPLE_RATE,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("InWorld TTS failed:", res.status, res.statusText, body);
    return false;
  }

  if (!res.body) return false;

  const ctx = new AudioContext({ sampleRate: INWORLD_PCM_SAMPLE_RATE });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let nextStartTime = ctx.currentTime;
  let lastSource: AudioBufferSourceNode | null = null;
  let leftover: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let lineBuf = "";

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let parsed: { result?: { audioContent?: string } };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return;
    }

    const b64 = parsed.result?.audioContent;
    if (!b64) return;

    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    // Strip RIFF/WAV header if present (can appear on every chunk)
    const pcm =
      raw.length > RIFF_HEADER_SIZE &&
      raw[0] === 0x52 &&
      raw[1] === 0x49 &&
      raw[2] === 0x46 &&
      raw[3] === 0x46
        ? raw.slice(RIFF_HEADER_SIZE)
        : raw;

    if (pcm.length === 0) return;

    let data: Uint8Array<ArrayBufferLike>;
    [data, leftover] = alignPcm(leftover, pcm);
    if (data.length === 0) return;

    const result = schedulePcmChunk(
      ctx,
      data,
      nextStartTime,
      INWORLD_PCM_SAMPLE_RATE,
    );
    nextStartTime = result.nextStartTime;
    lastSource = result.source;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    lineBuf += decoder.decode(value, { stream: true });
    const lines = lineBuf.split("\n");
    lineBuf = lines.pop() ?? "";

    for (const line of lines) {
      processLine(line);
    }
  }

  // Process any remaining data that wasn't terminated with a newline
  if (lineBuf.trim()) {
    processLine(lineBuf);
  }

  await waitForPlayback(ctx, lastSource);
  return true;
}

// ── Public API ──────────────────────────────────────────

export async function speakAnalysis(
  text: string,
  voice: string,
): Promise<boolean> {
  if (DISABLE_TTS) {
    console.log("[TTS] disabled, skipping");
    await new Promise((r) => setTimeout(r, 200));
    return false;
  }
  if (INWORLD_API_KEY) {
    console.log(`[TTS] using inworld, voice=${voice}`);
    return speakInworld(text, voice);
  }
  console.warn("[TTS] INWORLD_API_KEY missing, skipping");
  await new Promise((r) => setTimeout(r, 200));
  return false;
}
