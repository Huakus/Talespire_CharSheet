import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";

export const RogueArchetypeSchema = z.enum(["thief","assassin","arcane-trickster","inquisitive","mastermind","scout","swashbuckler"]);
export const RogueChoicesSchema = z.object({
  archetype: RogueArchetypeSchema.nullable().default(null),
  expertise: z.array(z.string()).max(2).default([]),
  tools: z.array(z.string()).max(3).default([]),
  languages: z.array(z.string()).max(2).default([]),
  cantrips: z.array(z.string()).max(2).default([]),
  learn: z.array(z.object({ key: z.string(),unrestricted: z.boolean() })).max(3).default([]),
  replace: z.object({ oldKey: z.string(),newKey: z.string() }).nullable().default(null),
}).prefault({});
export const RogueRuntimeSchema = z.object({
  expertise: z.array(z.string()).default([]),
  resourceIds: z.record(z.string(),z.string()).default(() => ({})),
  stolenSpell: z.string().nullable().default(null),
  stolenHoursRemaining: z.number().min(0).max(8).default(0),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),payload: z.string() })).default([]),
});
export const RogueActionSchema = z.discriminatedUnion("kind",[
  z.object({ kind: z.literal("spell-thief"),key: z.string(),targetedOrIncluded: z.literal(true),targetFailedSave: z.boolean() }),
  z.object({ kind: z.literal("pass-time"),hours: z.number().positive() }),
]);
export type RogueArchetype = z.infer<typeof RogueArchetypeSchema>;
export type RogueAction = z.input<typeof RogueActionSchema>;
