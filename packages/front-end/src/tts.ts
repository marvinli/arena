const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY as string | undefined;
const DISABLE_TTS = import.meta.env.VITE_DISABLE_TTS === "true";

const PCM_SAMPLE_RATE = 24000;

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

  if (!res.body) {
    return;
  }

  const ctx = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
  const reader = res.body.getReader();

  // Schedule PCM chunks for sequential playback
  let nextStartTime = ctx.currentTime;
  let leftover = new Uint8Array(0);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    // Prepend any leftover odd byte from previous chunk
    let data: Uint8Array;
    if (leftover.length > 0) {
      data = new Uint8Array(leftover.length + value.length);
      data.set(leftover);
      data.set(value, leftover.length);
      leftover = new Uint8Array(0);
    } else {
      data = value;
    }

    // PCM is 16-bit (2 bytes per sample); save trailing odd byte
    if (data.length % 2 !== 0) {
      leftover = data.slice(-1);
      data = data.slice(0, -1);
    }

    const int16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, PCM_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Schedule right after the previous chunk ends
    const startAt = Math.max(nextStartTime, ctx.currentTime);
    source.start(startAt);
    nextStartTime = startAt + buffer.duration;
  }

  // Wait for all scheduled audio to finish
  const remaining = nextStartTime - ctx.currentTime;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining * 1000));
  }
  await ctx.close();
}

export async function speakAnalysis(
  text: string,
  voice: string,
): Promise<void> {
  if (DISABLE_TTS || !OPENAI_API_KEY) return;
  return speakOpenAI(text, voice);
}
