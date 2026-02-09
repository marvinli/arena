const ELEVENLABS_API_KEY = import.meta.env.ELEVENLABS_API_KEY as
  | string
  | undefined;

export async function speakAnalysis(
  text: string,
  voiceId: string,
): Promise<void> {
  if (!ELEVENLABS_API_KEY || !voiceId) return;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
      }),
    },
  );

  if (!res.ok) {
    console.warn("TTS failed:", res.status, res.statusText);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  return new Promise<void>((resolve) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.play().catch(() => {
      URL.revokeObjectURL(url);
      resolve();
    });
  });
}
