import type { PlayerConfig, TournamentInfo } from "./agent-runner.js";
import { PERSONA_PROMPTS } from "./prompts/personas/index.js";
import { SYSTEM_PROMPT_TEMPLATE } from "./prompts/system.js";

function buildTournamentSection(info: TournamentInfo): string {
  const lines: string[] = [
    "Tournament structure:",
    `- Starting chips: ${info.startingChips}`,
    "- Winner takes all — last player standing wins",
  ];

  if (info.blindSchedule && info.handsPerLevel) {
    lines.push(
      `- Blind schedule (blinds increase every ${info.handsPerLevel} hands):`,
    );
    for (let i = 0; i < info.blindSchedule.length; i++) {
      const level = info.blindSchedule[i];
      const startHand = i * info.handsPerLevel + 1;
      const endHand = (i + 1) * info.handsPerLevel;
      const isLast = i === info.blindSchedule.length - 1;
      const handRange = isLast
        ? `hands ${startHand}+`
        : `hands ${startHand}-${endHand}`;
      lines.push(
        `  Level ${i + 1}: ${level.smallBlind}/${level.bigBlind} (${handRange})`,
      );
    }
  }

  return `${lines.join("\n")}\n\n`;
}

export function buildSystemPrompt(
  config: PlayerConfig,
  tournamentInfo?: TournamentInfo,
  personaKey?: string,
): string {
  const tournamentSection = tournamentInfo
    ? buildTournamentSection(tournamentInfo)
    : "";

  const persona = personaKey ? PERSONA_PROMPTS[personaKey] : undefined;
  const personaStrategy = persona ? persona.strategy : "";
  const personaCommentary = persona ? persona.commentary : "";

  const voiceDirective = config.voiceDirective ?? "";

  return SYSTEM_PROMPT_TEMPLATE.replaceAll("{{name}}", config.name)
    .replace("{{bio}}", config.bio ?? "")
    .replace("{{voiceDirective}}", voiceDirective)
    .replace("{{personaStrategy}}", personaStrategy)
    .replace("{{personaCommentary}}", personaCommentary)
    .replace("{{tournamentSection}}", tournamentSection);
}
