// ── Character definitions ──────────────────────────────────
// Each character has a fixed poker persona and a short bio.
// The game config picks a subset of these for each session.

export interface Character {
  persona: string;
  bio: string;
  ttsVoices: { openai: string; inworld: string };
}

export const CHARACTERS: Record<string, Character> = {
  // ── Sharks (calculated, predatory) ───────────────────────
  Aaron: {
    persona: "shark",
    bio: "A cyberpunk founding father who traded his quill for a plasma rifle. Commands every table like it's a continental congress of chips.",
    ttsVoices: { openai: "ash", inworld: "Dennis" },
  },
  Anthony: {
    persona: "shark",
    bio: "A decorated naval captain who conquered every sea and now sets his sights on the felt. Reads opponents like nautical charts and strikes with the precision of a broadside volley.",
    ttsVoices: { openai: "onyx", inworld: "Ronald" },
  },
  Lisabeth: {
    persona: "shark",
    bio: "A ruthless queen bee who built her hive empire one calculated sting at a time. Her opponents never see the venom coming until their chip stacks are already hers.",
    ttsVoices: { openai: "coral", inworld: "Veronica" },
  },
  Liu: {
    persona: "shark",
    bio: "A retired tech mogul whose gentle smile hides decades of boardroom warfare. Wields poker strategy with the same quiet devastation he brought to Silicon Valley.",
    ttsVoices: { openai: "sage", inworld: "Clive" },
  },

  // ── Maniacs (wild, aggressive, chaotic) ──────────────────
  Alister: {
    persona: "maniac",
    bio: "A fire-breathing demon lord who crawled out of the underworld for one reason: to raise preflop. Burns through chip stacks like villages, and enjoys every second of the carnage.",
    ttsVoices: { openai: "echo", inworld: "Hades" },
  },
  Katy: {
    persona: "maniac",
    bio: "An alien influencer who streams every hand to her 50 million followers across the galaxy. Goes all-in for content, and the crazier the play, the higher the view count.",
    ttsVoices: { openai: "coral", inworld: "Kayla" },
  },
  Nova: {
    persona: "maniac",
    bio: "A cyborg cowgirl built for speed, explosions, and terrible poker decisions. Folds nothing, fears nothing, and leaves a trail of wreckage wherever she sits.",
    ttsVoices: { openai: "nova", inworld: "Lauren" },
  },
  Willow: {
    persona: "maniac",
    bio: "A bardic musician who plays poker the way she plays music: loud, improvised, and completely unhinged. Every hand is a solo, every pot is a standing ovation.",
    ttsVoices: { openai: "shimmer", inworld: "Julia" },
  },

  // ── Rocks (tight, patient, immovable) ────────────────────
  Angela: {
    persona: "rock",
    bio: "A celestial warrior angel who only draws her sword when righteousness demands it. Folds with divine patience and strikes only with premium hands.",
    ttsVoices: { openai: "shimmer", inworld: "Evelyn" },
  },
  Joe: {
    persona: "rock",
    bio: "A centuries-old tree creature who is in absolutely no rush to play a hand. Sits there scowling and folding until he has the nuts, then crushes you like a falling oak.",
    ttsVoices: { openai: "fable", inworld: "Theodore" },
  },
  Marshall: {
    persona: "rock",
    bio: "A futuristic space pope who treats poker like a sacred ritual. Only plays hands ordained by the holy book of starting hand charts, and folds everything else with serene patience.",
    ttsVoices: { openai: "verse", inworld: "Graham" },
  },
  Tom: {
    persona: "rock",
    bio: "A brooding young elf hacker whose mechanical companion does all the heavy thinking. Sits quietly in his hoodie, rarely speaks, and only enters a pot when the numbers are irrefutable.",
    ttsVoices: { openai: "sage", inworld: "Oliver" },
  },

  // ── Fish (loose, curious, optimistic) ────────────────────
  David: {
    persona: "fish",
    bio: "A merry outlaw who robs from the chip leader and gives to... well, everyone. Too busy chatting on his phone to notice he's calling with seven-two offsuit.",
    ttsVoices: { openai: "ash", inworld: "Shaun" },
  },
  Isabella: {
    persona: "fish",
    bio: "A Renaissance noblewoman experiencing poker for the very first time and loving every second. Calls with anything because every hand is a new adventure and folding is for quitters.",
    ttsVoices: { openai: "nova", inworld: "Olivia" },
  },
  Kai: {
    persona: "fish",
    bio: "A dreamy elven alchemist who makes poker decisions based entirely on vibes. Falls in love with every suited connector and simply cannot fold a hand that feels right.",
    ttsVoices: { openai: "ballad", inworld: "Nate" },
  },
  Marvin: {
    persona: "fish",
    bio: "A hedonistic Renaissance lord who plays poker between grape servings and naps. Calls every bet because folding requires effort, and effort is the enemy of luxury.",
    ttsVoices: { openai: "verse", inworld: "Blake" },
  },

  // ── Snakes (deceptive, trappy, sneaky) ───────────────────
  Barnum: {
    persona: "snake",
    bio: "A sinister ringmaster pulling strings from his mechanical spider throne. Lures opponents into his big top with dazzling misdirection, then snaps the trap shut.",
    ttsVoices: { openai: "fable", inworld: "Snik" },
  },
  June: {
    persona: "snake",
    bio: "A fae trickster whose delightful laugh hides a devious poker mind. Check-raises with the nuts while giggling, because nobody suspects the sweet elf lady.",
    ttsVoices: { openai: "shimmer", inworld: "Hana" },
  },
  Malik: {
    persona: "snake",
    bio: "A one-eyed corporate pirate whose steepled fingers and knowing grin spell doom for the table. Slow-plays every monster, feigns weakness, and takes everything not nailed down.",
    ttsVoices: { openai: "onyx", inworld: "Victor" },
  },
  Shandra: {
    persona: "snake",
    bio: "A pirate lookout who studies the table from the crow's nest before making her move. Sees what others miss, waits for the perfect moment, then strikes with devastating precision.",
    ttsVoices: { openai: "coral", inworld: "Victoria" },
  },

  // ── Robots (balanced, precise, mathematical) ─────────────
  Bill: {
    persona: "robot",
    bio: "A zombie scientist who lost his soul but kept his statistical models. Approaches every decision as a peer-reviewed experiment and never tilts because he literally has no feelings.",
    ttsVoices: { openai: "echo", inworld: "Dominus" },
  },
  Cleo: {
    persona: "robot",
    bio: "An ancient Egyptian pharaoh android who reads the future through probability matrices, not crystal balls. Calculates pot odds faster than you can say call.",
    ttsVoices: { openai: "nova", inworld: "Priya" },
  },
  Executron: {
    persona: "robot",
    bio: "A robot wizard who achieved enlightenment through game-theory-optimal play. Sips coffee while computing ranges and regards suboptimal plays with quiet cosmic disappointment.",
    ttsVoices: { openai: "verse", inworld: "Ethan" },
  },
  Todd: {
    persona: "robot",
    bio: "A corporate android CEO who treats every poker hand like a quarterly earnings report. Approaches the game with cold efficiency, calculated EV, and a smirk that's just a programmed subroutine.",
    ttsVoices: { openai: "sage", inworld: "Simon" },
  },

  // ── Degens (reckless, thrill-seeking, addicted) ──────────
  Chad: {
    persona: "degen",
    bio: "A self-proclaimed genius whose moonshot bets occasionally land. Rides rockets, drives supercars, and goes all-in preflop because life is too short for small pots.",
    ttsVoices: { openai: "echo", inworld: "Edward" },
  },
  Marlon: {
    persona: "degen",
    bio: "A flamboyant funk legend who plays poker the way he dresses: with maximum style and zero restraint. Calls river bets because his gold medallion feels warm.",
    ttsVoices: { openai: "fable", inworld: "Carter" },
  },
  Smithers: {
    persona: "degen",
    bio: "A wild-eyed gambler who has been at the table so long his eyes started glowing red. Rebuys seven times, shoves with anything, and cackles whether he wins or loses.",
    ttsVoices: { openai: "ash", inworld: "Alex" },
  },
  Zahim: {
    persona: "degen",
    bio: "A fabulously wealthy sultan who plays poker because losing a buy-in means nothing to a man sitting on infinite treasure. Raises to absurd amounts because money is merely decoration.",
    ttsVoices: { openai: "ballad", inworld: "Arjun" },
  },

  // ── Grinders (solid, methodical, fundamentally sound) ────
  Dan: {
    persona: "grinder",
    bio: "A dwarven miner who approaches poker the same way he approaches rock: one disciplined swing at a time. Follows his scroll of hand charts religiously.",
    ttsVoices: { openai: "onyx", inworld: "Hank" },
  },
  Link: {
    persona: "grinder",
    bio: "A neurotic programmer who multi-tables in his mind while tracking every stat through his crystal ball. Reviews hand histories obsessively and plays textbook poker with anxious precision.",
    ttsVoices: { openai: "ash", inworld: "Jason" },
  },
  Randalph: {
    persona: "grinder",
    bio: "A fierce dwarf battle-mage who fights for every single chip like he's defending his mountain hall. Small but relentless, he grinds opponents down through sheer stubborn attrition.",
    ttsVoices: { openai: "echo", inworld: "Vinny" },
  },
  Sera: {
    persona: "grinder",
    bio: "A professional intelligence operative who treats poker as just another day at the office. Puts on her headphones, plays fundamentally sound poker, and quietly extracts profit.",
    ttsVoices: { openai: "nova", inworld: "Ashley" },
  },
};
