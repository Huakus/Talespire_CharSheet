import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";

export const ClericDomainSchema = z.enum(["knowledge", "life", "light", "nature", "tempest", "trickery", "war", "forge", "grave"]);
export const ClericChoicesSchema = z.object({
  domain: ClericDomainSchema.nullable().default(null),
  deity: z.string().max(500).default(""),
  cantrips: z.array(z.string()).max(3).default([]),
  prepared: z.array(z.string()).max(30).nullable().default(null),
  skills: z.array(z.string()).max(2).default([]),
  languages: z.array(z.string()).max(2).default([]),
  natureCantrip: z.string().default(""),
}).prefault({});
export const ClericRuntimeSchema = z.object({
  resourceIds: z.record(z.string(), z.string().regex(STABLE_ID_PATTERN)).default(() => ({})),
  interventionCooldownDays: z.number().int().min(0).max(7).default(0),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN), payload: z.string() })).default([]),
}).prefault({});
export const ClericActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prepare"), keys: z.array(z.string()).max(30), afterLongRest: z.literal(true) }),
  z.object({ kind: z.literal("channel"), key: z.string() }),
  z.object({ kind: z.literal("intervention"), roll: z.number().int().min(1).max(100).nullable().default(null) }),
  z.object({ kind: z.literal("elapsed-days"), days: z.number().int().min(1).max(365) }),
]);
export type ClericDomain = z.infer<typeof ClericDomainSchema>;
export type ClericChoices = z.infer<typeof ClericChoicesSchema>;
export type ClericAction = z.input<typeof ClericActionSchema>;
