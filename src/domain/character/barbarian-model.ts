import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
export const BarbarianPathSchema = z.enum(["berserker","totem-warrior","ancestral-guardian","storm-herald","zealot"]);
export const TotemAnimalSchema = z.enum(["bear","eagle","wolf"]);
export const StormEnvironmentSchema = z.enum(["desert","sea","tundra"]);
export const BarbarianChoicesSchema = z.object({
  path: BarbarianPathSchema.nullable().default(null),
  totem: TotemAnimalSchema.nullable().default(null),
  storm: StormEnvironmentSchema.nullable().default(null),
  divineDamage: z.enum(["radiant","necrotic"]).nullable().default(null),
}).prefault({});
export const BarbarianRuntimeSchema = z.object({
  raging: z.boolean().default(false),frenzy: z.boolean().default(false),
  rageTurns: z.number().int().min(0).max(10).default(0),
  reckless: z.boolean().default(false),focusUsed: z.boolean().default(false),
  relentlessDc: z.number().int().min(10).default(10),
  relentlessPending: z.boolean().default(false),
  storm: StormEnvironmentSchema.nullable().default(null),
  resourceIds: z.record(z.string(),z.string()).default(() => ({})),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),payload: z.string() })).default([]),
});
export const BarbarianActionSchema = z.discriminatedUnion("kind",[
  z.object({ kind: z.literal("rage"),frenzy: z.boolean().default(false) }),
  z.object({ kind: z.literal("end-rage") }),
  z.object({ kind: z.literal("end-turn"),attackedHostile: z.boolean(),tookDamage: z.boolean() }),
  z.object({ kind: z.literal("reckless"),firstAttackOfTurn: z.literal(true) }),
  z.object({ kind: z.literal("end-reckless") }),
  z.object({ kind: z.literal("relentless-rage"),saveTotal: z.number().int(),notInstantDeath: z.literal(true) }),
  z.object({ kind: z.literal("fanatical-focus"),failedSave: z.literal(true) }),
  z.object({ kind: z.literal("zealous-presence") }),
]);
export type BarbarianPath = z.infer<typeof BarbarianPathSchema>;
export type TotemAnimal = z.infer<typeof TotemAnimalSchema>;
export type StormEnvironment = z.infer<typeof StormEnvironmentSchema>;
export type BarbarianAction = z.input<typeof BarbarianActionSchema>;
