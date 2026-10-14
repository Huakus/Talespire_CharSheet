import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
export const DruidCircleSchema = z.enum(["land","moon","dreams","shepherd"]);
export const DruidLandSchema = z.enum(["arctic","forest","coast","desert","underdark","mountain","swamp","grassland"]);
const DruidChallengeSchema = z.number().refine((n) => [0,0.125,0.25,0.5,1,2,3,4,5,6].includes(n),"Elegí un VD válido de 0 a 6.");
export const DruidChoicesSchema = z.object({
  circle: DruidCircleSchema.nullable().default(null),land: DruidLandSchema.nullable().default(null),
  cantrips: z.array(z.string()).max(2).default([]),bonusCantrip: z.string().default(""),
  prepared: z.array(z.string()).max(30).nullable().default(null),
}).prefault({});
export const DruidFormSchema = z.object({
  name: z.string().trim().min(1).max(100),kind: z.enum(["beast","air","earth","fire","water"]),
  challenge: DruidChallengeSchema,swim: z.boolean(),fly: z.boolean(),
  maximumHp: z.number().int().positive().max(10000),currentHp: z.number().int().nonnegative().max(10000),
  hoursRemaining: z.number().nonnegative().max(10),notes: z.string().max(6000).default(""),
}).refine((f) => f.currentHp <= f.maximumHp,{ message: "Los PG de forma no pueden superar el máximo." });
export const DruidRuntimeSchema = z.object({
  form: DruidFormSchema.nullable().default(null),
  resourceIds: z.record(z.string(),z.string().regex(STABLE_ID_PATTERN)).default(() => ({})),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),payload: z.string() })).default([]),
}).prefault({});
export const DruidActionSchema = z.discriminatedUnion("kind",[
  z.object({ kind: z.literal("prepare"),keys: z.array(z.string()).max(30),afterLongRest: z.literal(true) }),
  z.object({ kind: z.literal("wild-shape"),name: z.string().trim().min(1).max(100),formKind: z.enum(["beast","air","earth","fire","water"]),challenge: DruidChallengeSchema,swim: z.boolean(),fly: z.boolean(),maximumHp: z.number().int().min(1).max(10000),seenBefore: z.literal(true),notes: z.string().max(6000).default("") }),
  z.object({ kind: z.literal("revert") }),
  z.object({ kind: z.literal("elapsed-hours"),hours: z.number().positive().max(1000) }),
  z.object({ kind: z.literal("natural-recovery"),slots: z.array(z.number().int().min(1).max(5)).min(1).max(10),afterShortRest: z.literal(true) }),
  z.object({ kind: z.literal("moon-heal"),slot: z.number().int().min(1).max(9),healing: z.number().int().positive() }),
  z.object({ kind: z.literal("balm"),dice: z.number().int().min(1).max(10),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("hidden-path"),target: z.enum(["self","other"]),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("dream-walker"),spell: z.enum(["dream","scrying","teleportation-circle"]),afterShortRest: z.literal(true),hasPlanarRest: z.boolean().default(true) }),
  z.object({ kind: z.literal("spirit"),spirit: z.enum(["bear","hawk","unicorn"]),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("faithful-summons"),triggerConfirmed: z.literal(true) }),
]);
export type DruidCircle = z.infer<typeof DruidCircleSchema>;
export type DruidLand = z.infer<typeof DruidLandSchema>;
export type DruidAction = z.input<typeof DruidActionSchema>;
