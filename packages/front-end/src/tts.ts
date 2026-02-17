const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY as string | undefined;
const INWORLD_API_KEY = import.meta.env.INWORLD_API_KEY as string | undefined;
const TTS_PROVIDER =
  (import.meta.env.TTS_PROVIDER as string | undefined) ?? "openai";
const DISABLE_TTS = import.meta.env.VITE_DISABLE_TTS === "true";

console.log(
  "[TTS] config:",
  "provider=" + TTS_PROVIDER,
  "inworldKey=" +
    (INWORLD_API_KEY ? `set(${INWORLD_API_KEY.length}chars)` : "MISSING"),
  "openaiKey=" +
    (OPENAI_API_KEY ? `set(${OPENAI_API_KEY.length}chars)` : "MISSING"),
  "disabled=" + DISABLE_TTS,
);

const OPENAI_PCM_SAMPLE_RATE = 24000;
const INWORLD_PCM_SAMPLE_RATE = 48000;

// ── Shared PCM playback ─────────────────────────────────

function schedulePcmChunk(
  ctx: AudioContext,
  data: Uint8Array,
  nextStartTime: number,
  sampleRate: number,
): number {
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
  return startAt + buffer.duration;
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

async function waitForPlayback(ctx: AudioContext, nextStartTime: number) {
  const remaining = nextStartTime - ctx.currentTime;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining * 1000));
  }
  await ctx.close();
}

// ── OpenAI TTS ──────────────────────────────────────────

/**
 * Stream OpenAI TTS: request raw PCM, pipe chunks to Web Audio API
 * so playback starts as soon as the first chunk arrives.
 */
async function speakOpenAI(text: string, voice: string): Promise<void> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      response_format: "pcm",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("OpenAI TTS failed:", res.status, res.statusText, body);
    return;
  }

  if (!res.body) return;

  const ctx = new AudioContext({ sampleRate: OPENAI_PCM_SAMPLE_RATE });
  const reader = res.body.getReader();

  let nextStartTime = ctx.currentTime;
  let leftover: Uint8Array<ArrayBufferLike> = new Uint8Array(0);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    let data: Uint8Array<ArrayBufferLike>;
    [data, leftover] = alignPcm(leftover, value);
    if (data.length === 0) continue;

    nextStartTime = schedulePcmChunk(
      ctx,
      data,
      nextStartTime,
      OPENAI_PCM_SAMPLE_RATE,
    );
  }

  await waitForPlayback(ctx, nextStartTime);
}

// ── InWorld TTS ─────────────────────────────────────────

const RIFF_HEADER_SIZE = 44;

/**
 * Stream InWorld TTS: newline-delimited JSON with base64 LINEAR16 audio.
 * Each line is `{ "result": { "audioContent": "<base64>" } }`.
 */
async function speakInworld(text: string, voice: string): Promise<void> {
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
    return;
  }

  if (!res.body) return;

  const ctx = new AudioContext({ sampleRate: INWORLD_PCM_SAMPLE_RATE });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let nextStartTime = ctx.currentTime;
  let leftover: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let lineBuf = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    lineBuf += decoder.decode(value, { stream: true });
    const lines = lineBuf.split("\n");
    lineBuf = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: { result?: { audioContent?: string } };
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }

      const b64 = parsed.result?.audioContent;
      if (!b64) continue;

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

      if (pcm.length === 0) continue;

      let data: Uint8Array<ArrayBufferLike>;
      [data, leftover] = alignPcm(leftover, pcm);
      if (data.length === 0) continue;

      nextStartTime = schedulePcmChunk(
        ctx,
        data,
        nextStartTime,
        INWORLD_PCM_SAMPLE_RATE,
      );
    }
  }

  await waitForPlayback(ctx, nextStartTime);
}

// ── Public API ──────────────────────────────────────────

export async function speakAnalysis(
  text: string,
  voice: string,
): Promise<void> {
  if (DISABLE_TTS) {
    console.log("[TTS] disabled, skipping");
    await new Promise((r) => setTimeout(r, 200));
    return;
  }
  if (TTS_PROVIDER === "inworld" && INWORLD_API_KEY) {
    console.log("[TTS] using inworld, voice=" + voice);
    return speakInworld(text, voice);
  }
  if (OPENAI_API_KEY) {
    console.log("[TTS] using openai, voice=" + voice);
    return speakOpenAI(text, voice);
  }
  console.warn(
    "[TTS] no provider available, skipping. provider=" + TTS_PROVIDER,
    "inworldKey=" + !!INWORLD_API_KEY,
    "openaiKey=" + !!OPENAI_API_KEY,
  );
  await new Promise((r) => setTimeout(r, 200));
}
