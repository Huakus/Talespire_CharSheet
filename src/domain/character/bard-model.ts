import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
export const BardRuntimeSchema = z.object({
  inspirationId: z.string().regex(STABLE_ID_PATTERN).nullable().default(null),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),payload: z.string() })).default([]),
});
export const BardActionSchema = z.discriminatedUnion("kind",[
  z.object({ kind: z.literal("inspiration"),use: z.enum(["inspire","cutting-words","peerless","mantle-inspiration","flourish","master-flourish","psychic-blades"]),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("superior"),rolledInitiative: z.literal(true) }),
]);
export type BardAction = z.input<typeof BardActionSchema>;
export const BardCollegeSchema = z.enum(["lore","valor","glamour","swords","whispers"]);
export const BardChoicesSchema = z.object({
  college: BardCollegeSchema.nullable().default(null),
  instruments: z.array(z.string()).max(3).default([]),
  skills: z.array(z.string()).max(3).default([]),
  expertise: z.array(z.string()).max(2).default([]),
  style: z.enum(["dueling","two-weapon"]).nullable().default(null),
  cantrips: z.array(z.string()).max(2).default([]),
  learn: z.array(z.string()).max(4).default([]),
  secrets: z.array(z.string()).max(2).default([]),
  replaceSpell: z.object({ oldKey: z.string(),newKey: z.string() }).nullable().default(null),
}).prefault({});
export type BardCollege = z.infer<typeof BardCollegeSchema>;
export type BardChoices = z.infer<typeof BardChoicesSchema>;
