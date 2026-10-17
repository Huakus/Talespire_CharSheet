import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
export const MonkTraditionSchema = z.enum(["open-hand","shadow","four-elements","drunken-master","kensei","sun-soul"]);
export const PaladinOathSchema = z.enum(["devotion","ancients","vengeance","conquest","redemption"]);
export const MonkChoicesSchema = z.object({
  tradition: MonkTraditionSchema.nullable().default(null),tool: z.string().default(""),
  weapons: z.array(z.string()).max(2).default([]),brush: z.enum(["calligrapher","painter"]).nullable().default(null),
  disciplines: z.array(z.string()).max(1).default([]),
  replacement: z.object({ oldKey: z.string(),newKey: z.string() }).nullable().default(null),
}).prefault({});
export const PaladinChoicesSchema = z.object({
  oath: PaladinOathSchema.nullable().default(null),style: z.enum(["defense","dueling","great-weapon","protection"]).nullable().default(null),
  prepared: z.array(z.string()).max(30).nullable().default(null),
}).prefault({});
export const MartialRuntimeSchema = z.object({
  resourceIds: z.record(z.string(),z.string().regex(STABLE_ID_PATTERN)).default(() => ({})),
  effects: z.array(z.object({ key: z.string(),remainingMinutes: z.number().nonnegative(),target: z.string().default(""),amount: z.number().default(0) })).default([]),
  lastResult: z.string().default(""),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),payload: z.string() })).default([]),
}).prefault({});
export const MartialActionSchema = z.discriminatedUnion("kind",[
  z.object({ kind: z.literal("feature"),key: z.string().min(1),amount: z.number().int().min(0).max(100).default(0),target: z.string().max(120).default(""),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("smite"),slotLevel: z.number().int().min(1).max(9),undeadOrFiend: z.boolean(),critical: z.boolean(),meleeWeaponHit: z.literal(true) }),
  z.object({ kind: z.literal("lay-hands"),points: z.number().int().min(0).max(100),cures: z.number().int().min(0).max(20),neutralizePoison: z.boolean().default(false),self: z.boolean(),validLivingTarget: z.literal(true) }),
  z.object({ kind: z.literal("prepare"),keys: z.array(z.string()).max(30),afterLongRest: z.literal(true) }),
  z.object({ kind: z.literal("elapsed"),minutes: z.number().nonnegative() }),
  z.object({ kind: z.literal("end-effect"),key: z.string() }),
  z.object({ kind: z.literal("initiative") }),
]);
export type MartialAction = z.input<typeof MartialActionSchema>;
