import { z } from "zod";
export const MonsterSpellcastingSchema = z.object({
  ability: z.enum(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]).nullable(),
  attackBonus: z.number().int().nullable(),
  saveDc: z.number().int().nonnegative().nullable(),
  casterLevel: z.number().int().min(1).max(30).nullable(),
});
export type MonsterSpellcasting = z.infer<typeof MonsterSpellcastingSchema>;
