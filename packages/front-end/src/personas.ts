export interface PersonaMeta {
  name: string;
  emoji: string;
  color: string;
  tags: string[];
}

export const PERSONAS: Record<string, PersonaMeta> = {
  shark: {
    name: "Shark",
    emoji: "\u{1F988}",
    color: "#3B82F6",
    tags: ["Tight", "Aggressive", "Predatory"],
  },
  maniac: {
    name: "Maniac",
    emoji: "\u{1F92A}",
    color: "#EF4444",
    tags: ["Loose", "Aggressive", "Chaotic"],
  },
  rock: {
    name: "Rock",
    emoji: "\u{1FAA8}",
    color: "#6B7280",
    tags: ["Tight", "Passive", "Patient"],
  },
  fish: {
    name: "Fish",
    emoji: "\u{1F41F}",
    color: "#06B6D4",
    tags: ["Loose", "Passive", "Optimistic"],
  },
  snake: {
    name: "Snake",
    emoji: "\u{1F40D}",
    color: "#22C55E",
    tags: ["Deceptive", "Trappy", "Sneaky"],
  },
  robot: {
    name: "Robot",
    emoji: "\u{1F916}",
    color: "#8B5CF6",
    tags: ["Balanced", "Precise", "Analytical"],
  },
  degen: {
    name: "Degen",
    emoji: "\u{1F3B0}",
    color: "#F59E0B",
    tags: ["Reckless", "Aggressive", "Dramatic"],
  },
  grinder: {
    name: "Grinder",
    emoji: "\u2699\uFE0F",
    color: "#78716C",
    tags: ["Solid", "Methodical", "Fundamental"],
  },
};
