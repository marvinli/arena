import { DEGEN_PERSONA } from "./degen.js";
import { FISH_PERSONA } from "./fish.js";
import { GRINDER_PERSONA } from "./grinder.js";
import { MANIAC_PERSONA } from "./maniac.js";
import { ROBOT_PERSONA } from "./robot.js";
import { ROCK_PERSONA } from "./rock.js";
import { SHARK_PERSONA } from "./shark.js";
import { SNAKE_PERSONA } from "./snake.js";

export interface PersonaPrompt {
  strategy: string;
  commentary: string;
}

export const PERSONA_PROMPTS: Record<string, PersonaPrompt> = {
  shark: SHARK_PERSONA,
  maniac: MANIAC_PERSONA,
  rock: ROCK_PERSONA,
  fish: FISH_PERSONA,
  snake: SNAKE_PERSONA,
  robot: ROBOT_PERSONA,
  degen: DEGEN_PERSONA,
  grinder: GRINDER_PERSONA,
};

export const PERSONA_KEYS = Object.keys(PERSONA_PROMPTS);
