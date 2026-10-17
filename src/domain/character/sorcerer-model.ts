import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
export const SorcererOriginSchema = z.enum(["draconic","wild-magic","divine-soul","shadow","storm"]);
export const MetamagicSchema = z.enum(["careful","distant","empowered","extended","heightened","quickened","subtle","twinned"]);
export const SorcererChoicesSchema = z.object({
  origin: SorcererOriginSchema.nullable().default(null),
  ancestry: z.enum(["black","blue","brass","bronze","copper","gold","green","red","silver","white"]).nullable().default(null),
  affinity: z.enum(["good","evil","law","chaos","neutrality"]).nullable().default(null),
  cantrips: z.array(z.string()).max(4).default([]),learn: z.array(z.string()).max(2).default([]),
  metamagic: z.array(MetamagicSchema).max(2).default([]),
  replaceSpell: z.object({ oldKey: z.string(),newKey: z.string() }).nullable().default(null),
}).prefault({});
export const SorcererRuntimeSchema = z.object({
  resourceIds: z.record(z.string(),z.string().regex(STABLE_ID_PATTERN)).default(() => ({})),
  createdSlots: z.record(z.string(),z.number().int().nonnegative()).default(() => ({})),
  wings: z.boolean().default(false),resistanceMinutes: z.number().nonnegative().default(0),
  shadowTurns: z.number().int().min(0).max(10).default(0),sharedFlightMinutes: z.number().nonnegative().default(0),
  presenceTurns: z.number().int().min(0).max(10).default(0),presenceId: z.string().nullable().default(null),
  lastSurge: z.object({ rolls: z.array(z.number().int().min(1).max(100)).min(1).max(2),chosen: z.number().int().min(0).max(1) }).nullable().default(null),
  actions: z.array(z.object({ operationId: z.string().regex(STABLE_ID_PATTERN),payload: z.string() })).default([]),
}).prefault({});
export const SorcererActionSchema = z.discriminatedUnion("kind",[
  z.object({ kind: z.literal("create-slot"),level: z.number().int().min(1).max(5) }),
  z.object({ kind: z.literal("empowered-damage"),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("convert-slot"),level: z.number().int().min(1).max(9) }),
  z.object({ kind: z.literal("feature"),key: z.enum(["tides","bend-luck","favored","empowered-healing","hound","shadow-form","recovery","wind-share"]),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("wings"),active: z.boolean(),armorAccommodates: z.boolean().default(false) }),
  z.object({ kind: z.literal("presence"),effect: z.enum(["awe","fear"]),requirementsConfirmed: z.literal(true) }),
  z.object({ kind: z.literal("strength-grave"),damage: z.number().int().nonnegative(),saveTotal: z.number().int(),radiant: z.boolean(),critical: z.boolean(),notInstantDeath: z.literal(true) }),
  z.object({ kind: z.literal("surge"),rolls: z.array(z.number().int().min(1).max(100)).min(1).max(2),chosen: z.number().int().min(0).max(1),fromTides: z.boolean().default(false),afterClassSpell: z.literal(true),gmApproved: z.literal(true) }),
  z.object({ kind: z.literal("elapsed"),minutes: z.number().nonnegative(),turns: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("end-form") }),
]);
export type SorcererOrigin = z.infer<typeof SorcererOriginSchema>;
export type Metamagic = z.infer<typeof MetamagicSchema>;
export type SorcererAction = z.input<typeof SorcererActionSchema>;
export interface SorcererCastOptions {
  metamagic?: Metamagic[]|undefined;metamagicConfirmed?: boolean|undefined;twinnedEligible?: boolean|undefined;
  elementalResistance?: boolean|undefined;shadowDarkness?: boolean|undefined;
}
