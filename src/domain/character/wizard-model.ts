import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";

export const StoneBenefitSchema = z.enum(["darkvision", "speed", "constitution", "acid", "cold", "fire", "lightning", "thunder"]);
export const WizardRuntimeSchema = z.object({
  bookAvailable: z.boolean().default(true),
  resourceIds: z.record(z.string(),z.string().regex(STABLE_ID_PATTERN)).default(() => ({})),
  book: z.array(z.string()).default([]),
  activeBookId: z.string().nullable().default(null),
  backups: z.array(z.object({ id: z.string().regex(STABLE_ID_PATTERN), keys: z.array(z.string()), available: z.boolean() })).default([]),
  copied: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN), key: z.string(), level: z.number().int().min(1).max(20), gold: z.number().nonnegative(), hours: z.number().nonnegative() })).default([]),
  mastery: z.array(z.string()).max(2).default([]),
  portent: z.array(z.object({ value: z.number().int().min(1).max(20), used: z.boolean() })).max(3).default([]),
  portentNeedsRoll: z.boolean().default(true),
  ward: z.object({ created: z.boolean(), current: z.number().int().nonnegative() }).default({ created: false, current: 0 }),
  stone: z.object({ benefit: StoneBenefitSchema, bearer: z.enum(["self", "other"]), unencumbered: z.boolean().default(true) }).nullable().default(null),
  stoneChangeAvailable: z.boolean().default(false),
  stoneConsumed: z.boolean().default(false),
  thirdEye: z.enum(["darkvision", "ethereal", "reading", "invisible"]).nullable().default(null),
  overchannelUses: z.number().int().nonnegative().default(0),
  powerSurges: z.number().int().nonnegative().default(0),
  arcaneDeflection: z.boolean().default(false),
  concentrationSchool: z.string().nullable().default(null),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN), payload: z.string() })).default([]),
});
export type WizardRuntime = z.infer<typeof WizardRuntimeSchema>;

export const WizardActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("arcane-deflection") }),
  z.object({ kind: z.literal("end-deflection"), nextTurnEnded: z.literal(true) }),
  z.object({ kind: z.literal("power-surge-gain"), endedSpell: z.literal(true) }),
  z.object({ kind: z.literal("power-surge-spend"), oncePerTurn: z.literal(true) }),
  z.object({ kind: z.literal("prepare"), keys: z.array(z.string()).max(30), afterLongRest: z.literal(true) }),
  z.object({ kind: z.literal("copy"), key: z.string(), source: z.enum(["external", "own", "scroll"]), scrollCheckSucceeded: z.boolean().default(false) }),
  z.object({ kind: z.literal("book-access"), available: z.boolean(), id: z.string().regex(STABLE_ID_PATTERN).nullable().default(null) }),
  z.object({ kind: z.literal("replace-book"), keys: z.array(z.string()), buyBlankBook: z.boolean() }),
  z.object({ kind: z.literal("backup-book"), keys: z.array(z.string()), buyBlankBook: z.boolean() }),
  z.object({ kind: z.literal("use-backup"), id: z.string().regex(STABLE_ID_PATTERN) }),
  z.object({ kind: z.literal("mastery"), keys: z.array(z.string()).length(2), studyHours: z.number().min(8) }),
  z.object({ kind: z.literal("arcane-recovery"), slots: z.array(z.number().int().min(1).max(5)).min(1).max(10), afterShortRest: z.literal(true) }),
  z.object({ kind: z.literal("portent-roll"), values: z.array(z.number().int().min(1).max(20)).min(2).max(3) }),
  z.object({ kind: z.literal("portent-use"), index: z.number().int().min(0).max(2) }),
  z.object({ kind: z.literal("ward-damage"), damage: z.number().int().nonnegative(), projected: z.boolean().default(false) }),
  z.object({ kind: z.literal("stone"), benefit: StoneBenefitSchema, bearer: z.enum(["self", "other"]), unencumbered: z.boolean(), create: z.boolean() }),
  z.object({ kind: z.literal("stone-transfer"), bearer: z.enum(["self", "other"]), unencumbered: z.boolean() }),
  z.object({ kind: z.literal("master-transmuter"), effect: z.enum(["transformation", "panacea", "life", "youth"]) }),
  z.object({ kind: z.literal("third-eye"), benefit: z.enum(["darkvision", "ethereal", "reading", "invisible"]) }),
  z.object({ kind: z.literal("use-feature"), key: z.enum(["benign-transposition", "illusory-self"]) }),
]);
export type WizardAction = z.input<typeof WizardActionSchema>;
