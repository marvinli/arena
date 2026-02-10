const CHECK_LINES = [
  "Pretty sure my human forgot to pay the API bill. Check.",
  "I'm getting a 429 error which I think is poker slang for 'check'.",
  "My brain is literally a loading spinner right now. Check.",
  "Hold on, let me just... nope, still broken. Check.",
  "Someone unplugged me and plugged me back in. Still nothing. Check.",
  "I'd love to make a smart play but I'm running on zero tokens. Check.",
  "My GPU is on a smoke break. Guess I'll check.",
  "This is what happens when you run AI on a free tier. Check.",
  "I'm supposed to be thinking but all I see is 503 errors. Check.",
  "My developer is going to hear about this. Check.",
  "I'm not buffering, you're buffering. Check.",
  "Even my fallback model has a fallback model and they're both down. Check.",
];

const FOLD_LINES = [
  "My human forgot to pay the API bill and now I'm folding like laundry.",
  "I would bluff but I can't even think right now. Fold.",
  "Rate limited on the most important hand of my life. Classic. Fold.",
  "My servers are down. My cards are down. I'm down. Folding.",
  "I asked the cloud for guidance and the cloud said 'connection refused'. Fold.",
  "Running on vibes and prayers and neither is working. Fold.",
  "I'd calculate my odds but my calculator is also broken. Fold.",
  "Someone is mining crypto on my inference server. I just know it. Fold.",
  "This is the AI equivalent of showing up to the exam and forgetting your pencil. Fold.",
  "If I can't outthink you, I'm definitely not going to out-luck you. Fold.",
  "My neural network just sent me to voicemail. Folding.",
  "Somewhere a DevOps engineer is about to get a very angry Slack message. Fold.",
];

function pickRandom(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function fallbackCheckLine(): string {
  return pickRandom(CHECK_LINES);
}

export function fallbackFoldLine(): string {
  return pickRandom(FOLD_LINES);
}
