import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
export const WarlockPatronSchema = z.enum(["archfey","fiend","great-old-one","celestial","hexblade"]);
export const PactBoonSchema = z.enum(["blade","chain","tome"]);
export const WarlockChoicesSchema = z.object({
  patron: WarlockPatronSchema.nullable().default(null), story: z.string().max(2000).default(""),
  cantrips: z.array(z.string()).max(2).default([]), learn: z.array(z.string()).max(2).default([]),
  replaceSpell: z.object({ oldKey: z.string(),newKey: z.string() }).nullable().default(null),
  invocations: z.array(z.string()).max(2).default([]),
  replaceInvocation: z.object({ oldKey: z.string(),newKey: z.string() }).nullable().default(null),
  boon: PactBoonSchema.nullable().default(null), tomeCantrips: z.array(z.string()).max(3).default([]),
  rituals: z.array(z.string()).max(2).default([]), arcanum: z.string().default(""), pactWeapon: z.string().default(""),
}).prefault({});
export const WarlockRuntimeSchema = z.object({
  bookAvailable: z.boolean().default(true),
  copiedRituals: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),key: z.string(),gold: z.number().nonnegative(),hours: z.number().nonnegative() })).default([]),
  resistance: z.string().nullable().default(null),
  pactWeaponKey: z.string().default(""), pactWeaponId: z.string().nullable().default(null),
  hexWeaponId: z.string().nullable().default(null),
  pactWeaponAppliedBonus: z.number().int().min(0).max(1).default(0),
  resourceIds: z.record(z.string(),z.string()).default(() => ({})),
  influenceProficiencies: z.record(z.string(),z.number().int().min(0).max(2)).default(() => ({})),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),payload: z.string() })).default([]),
});
export const WarlockActionSchema = z.discriminatedUnion("kind",[
  z.object({ kind: z.literal("healing-light"),dice: z.number().int().min(1).max(21) }),
  z.object({ kind: z.literal("eldritch-smite"), pactWeaponHit: z.literal(true),oncePerTurn: z.literal(true) }),
  z.object({ kind: z.literal("hex-weapon"),id: z.string().regex(STABLE_ID_PATTERN),afterLongRest: z.literal(true) }),
  z.object({ kind: z.literal("eldritch-master"),minutes: z.number().min(1) }),
  z.object({ kind: z.literal("dark-blessing"),hostileReducedToZero: z.literal(true) }),
  z.object({ kind: z.literal("resistance"),damageType: z.enum(["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"]),afterRest: z.literal(true) }),
  z.object({ kind: z.literal("book-access"),available: z.boolean() }),
  z.object({ kind: z.literal("replace-book"),hours: z.number().min(1) }),
  z.object({ kind: z.literal("copy-ritual"),key: z.string(),sourceAvailable: z.literal(true),scrollCheckSucceeded: z.boolean().default(true) }),
  z.object({ kind: z.literal("pact-weapon"),key: z.string() }),
]);
export type WarlockChoices = z.infer<typeof WarlockChoicesSchema>;
export type WarlockPatron = z.infer<typeof WarlockPatronSchema>;
export type PactBoon = z.infer<typeof PactBoonSchema>;
export type WarlockRuntime = z.infer<typeof WarlockRuntimeSchema>;
export type WarlockAction = z.input<typeof WarlockActionSchema>;
