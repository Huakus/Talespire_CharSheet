import type { z } from "zod";
import { RollModeSchema } from "../../domain/character/character-checks";

export interface DiceRollRequest {
  name: string;
  /** Stable routing metadata, never included in the dice label. */
  characterId?: string;
  correlationId?: string;
  expressions: string[];
  mode: z.infer<typeof RollModeSchema>;
  abilityCheck?: { modifier: number; minimum: number };
}

export interface DiceRollResult {
  kind: "rolled" | "submitted";
  summary: string;
  totals: number[];
}

export interface DiceRoller {
  roll(request: DiceRollRequest): Promise<DiceRollResult>;
}
