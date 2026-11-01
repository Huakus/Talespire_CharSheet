import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
import type { CharacterV2 } from "../character/character-v2";

export const EquipmentActiveEffectSchema = z.object({
  id: z.string().regex(STABLE_ID_PATTERN),
  kind: z.enum(["alchemist-fire", "potion-poison", "concentration-check"]),
  sourceItemId: z.string().regex(STABLE_ID_PATTERN), sourceName: z.string().min(1),
  conditionId: z.string().regex(STABLE_ID_PATTERN).nullable(),
  dice: z.number().int().min(1).max(3), phase: z.enum(["start", "end"]),
  concentrationDc: z.number().int().positive().nullable(),
});

/** Remove only effects whose own condition was cured, never another source's condition. */
export function reconcileEquipmentActiveEffects(character: CharacterV2): void {
  if (!character.combat.conditions.some(c => c.key === "concentration")) for (const e of character.equipmentEffects) e.concentrationDc = null;
  character.equipmentEffects = character.equipmentEffects.filter(e => !e.conditionId || character.combat.conditions.some(c => c.id === e.conditionId));
  character.equipmentEffects = character.equipmentEffects.filter(e => e.kind !== "concentration-check" || e.concentrationDc !== null);
}
