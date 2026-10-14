import { z } from "zod";
import { STABLE_ID_PATTERN } from "../../shared/id";
import { ActivatableEffectSchema } from "./character-effect-model";
import { CatalogMetadataSchema } from "../content/catalog-metadata";
import { RollModeSchema } from "./character-checks";

export const InventoryCostSchema = z.object({
  quantity: z.number().finite().nonnegative(),
  unit: z.string(),
});

export const InventoryChargesSchema = z.object({
  current: z.number().int().nonnegative(),
  maximum: z.number().int().nonnegative(),
  reset: z.string(),
}).refine((charges) => charges.current <= charges.maximum, {
  message: "Current charges cannot exceed maximum charges",
  path: ["current"],
});

export const InventoryArmorSchema = z.object({
  base: z.number().int(),
  dexterityBonus: z.boolean(),
  maximumDexterityBonus: z.number().int().nonnegative().nullable(),
  armorCategory: z.string(),
  stealthDisadvantage: z.boolean(),
  strengthRequirement: z.number().int().nonnegative().nullable().default(null),
});

export const InventoryWeaponSchema = z.object({
  category: z.string(),
  range: z.string(),
  normalRange: z.number().int().nonnegative().nullable(),
  longRange: z.number().int().nonnegative().nullable(),
  damageExpression: z.string(),
  versatileDamageExpression: z.string(),
  damageType: z.string(),
  attackBonus: z.number().int(),
  damageBonus: z.number().int(),
});

export const InventoryBonusSchema = z.object({
  category: z.string(),
  key: z.string(),
  value: z.number().finite(),
  valueSource: z.enum([
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
  ]).nullable().default(null),
  advantage: z.boolean(),
  disadvantage: z.boolean(),
});

export const InventoryFeatureKindSchema = z.enum([
  "passive",
  "activation",
  "action",
  "bonus-action",
  "reaction",
  "other",
]);

export const InventoryFeatureRollSchema = z.object({
  label: z.string(),
  expression: z.string().min(1),
  mode: RollModeSchema.default("normal"),
});

export const InventoryFeatureUsesSchema = z.object({
  current: z.number().int().nonnegative(),
  maximum: z.number().int().positive(),
  reset: z.string(),
}).refine((uses) => uses.current <= uses.maximum, {
  message: "Current feature uses cannot exceed maximum uses",
  path: ["current"],
});

export const InventoryFeatureSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  kind: InventoryFeatureKindSchema,
  name: z.string().min(1),
  description: z.string(),
  active: z.boolean().default(false),
  toggleable: z.boolean().default(false),
  showInActions: z.boolean().default(false),
  chargeCost: z.number().int().nonnegative().default(0),
  uses: InventoryFeatureUsesSchema.nullable().default(null),
  rolls: z.array(InventoryFeatureRollSchema).default([]),
  bonuses: z.array(InventoryBonusSchema).default([]),
});

export const CharacterInventoryItemV2Schema = z.object({
  id: z.string().regex(STABLE_ID_PATTERN),
  order: z.number().int().nonnegative(),
  group: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  unitWeight: z.number().finite().nonnegative(),
  cost: InventoryCostSchema,
  category: z.string(),
  description: z.string(),
  properties: z.array(z.string()),
  equipped: z.boolean(),
  attuned: z.boolean(),
  requiresAttunement: z.boolean(),
  usable: z.boolean(),
  consumable: z.boolean(),
  charges: InventoryChargesSchema.nullable(),
  armor: InventoryArmorSchema.nullable(),
  weapon: InventoryWeaponSchema.nullable(),
  bonuses: z.array(InventoryBonusSchema),
  features: z.array(InventoryFeatureSchema).default([]),
  effect: ActivatableEffectSchema,
  catalog: CatalogMetadataSchema.nullable().default(null),
});

export const CharacterInventoryItemDraftSchema = CharacterInventoryItemV2Schema.omit({
  id: true,
});

export type CharacterInventoryItemV2 = z.infer<typeof CharacterInventoryItemV2Schema>;
export type CharacterInventoryItemDraft = z.infer<typeof CharacterInventoryItemDraftSchema>;
export type InventoryCharges = z.infer<typeof InventoryChargesSchema>;
export type InventoryBonus = z.infer<typeof InventoryBonusSchema>;
export type InventoryFeature = z.infer<typeof InventoryFeatureSchema>;
export type InventoryFeatureKind = z.infer<typeof InventoryFeatureKindSchema>;
export type InventoryFeatureRoll = z.infer<typeof InventoryFeatureRollSchema>;
