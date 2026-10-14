import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
import { parseDiceExpression } from "../dice/dice-expression";
export const RangerArchetypeSchema = z.enum(["hunter","beast-master","gloom-stalker","horizon-walker","monster-slayer"]);
export const RangerTerrainSchema = z.enum(["arctic","coast","desert","forest","grassland","mountain","swamp","underdark"]);
export const RangerEnemySchema = z.object({
  type: z.enum(["aberrations","beasts","celestials","constructs","dragons","elementals","fey","fiends","giants","monstrosities","oozes","plants","undead","humanoids"]),
  humanoids: z.array(z.string().trim().min(1).max(80)).max(2).default([]),
  language: z.string().trim().max(80).default(""),languageConfirmed: z.boolean().default(false),
});
export const RangerCompanionSchema = z.object({
  name: z.string().trim().min(1).max(100),species: z.string().trim().min(1).max(100),type: z.literal("beast").default("beast"),
  size: z.enum(["tiny","small","medium"]),challenge: z.number().refine((n) => [0,0.125,0.25].includes(n),"El compañero debe ser VD 1/4 o menor."),
  baseHp: z.number().int().positive().max(10000),baseAc: z.number().int().min(1).max(50),
  attackBonus: z.number().int().min(-20).max(50),damage: z.string().trim().min(1).max(100).refine((s) => { try { parseDiceExpression(s);return true; } catch { return false; } },"Ingresá una expresión de daño válida."),
  checks: z.array(z.object({ label: z.string().trim().min(1).max(80),bonus: z.number().int().min(-20).max(50) })).max(24).default([]),
  hitDice: z.number().int().positive().max(100),dieSize: z.union([z.literal(4),z.literal(6),z.literal(8),z.literal(10),z.literal(12),z.literal(20)]),
  notes: z.string().max(6000).default(""),
});
export const RangerChoicesSchema = z.object({
  enemy: RangerEnemySchema.nullable().default(null),terrain: RangerTerrainSchema.nullable().default(null),
  style: z.enum(["archery","defense","dueling","two-weapon"]).nullable().default(null),
  archetype: RangerArchetypeSchema.nullable().default(null),hunter: z.string().default(""),
  ironMind: z.enum(["intelligence","charisma"]).nullable().default(null),
  companion: RangerCompanionSchema.nullable().default(null),
  learn: z.array(z.string()).max(2).default([]),replaceSpell: z.object({ oldKey: z.string(),newKey: z.string() }).nullable().default(null),
}).prefault({});
export const RangerRuntimeSchema = z.object({
  companion: RangerCompanionSchema.nullable().default(null),companionHp: z.number().int().nonnegative().default(0),
  companionDiceRemaining: z.number().int().nonnegative().default(0),
  resourceIds: z.record(z.string(),z.string().regex(STABLE_ID_PATTERN)).default(() => ({})),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),payload: z.string() })).default([]),
}).prefault({});
export const RangerActionSchema = z.discriminatedUnion("kind",[
  z.object({ kind: z.literal("primeval-awareness"),slot: z.number().int().min(1).max(5) }),
  z.object({ kind: z.literal("feature"),key: z.enum(["detect-portal","hunters-sense","magic-nemesis"]),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("companion-damage"),amount: z.number().int().positive() }),
  z.object({ kind: z.literal("companion-heal"),amount: z.number().int().positive(),aliveConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("companion-hit-dice"),dice: z.number().int().positive(),healing: z.number().int().nonnegative(),duringShortRest: z.literal(true) }),
  z.object({ kind: z.literal("bond-companion"),companion: RangerCompanionSchema,previousDead: z.literal(true),nonHostile: z.literal(true),hours: z.number().min(8) }),
]);
export type RangerArchetype = z.infer<typeof RangerArchetypeSchema>;
export type RangerTerrain = z.infer<typeof RangerTerrainSchema>;
export type RangerEnemy = z.infer<typeof RangerEnemySchema>;
export type RangerCompanion = z.infer<typeof RangerCompanionSchema>;
export type RangerAction = z.input<typeof RangerActionSchema>;
