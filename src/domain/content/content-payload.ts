import { z } from "zod";
import type { SpellDefinition } from "../character/character-spell-model";
import { CharacterInventoryItemV2Schema, CharacterInventoryItemDraftSchema } from "../character/character-inventory-model";
import type { EquipmentCatalogDraft } from "../equipment/equipment-catalog";
import { GmChecklistItemSchema, type GmChecklistItem, type GmShop } from "../gm/gm-global-content";
import { normalizeMerchantInteraction } from "../commerce/merchant-interaction";
import type { MonsterDefinition } from "../monsters/monster-catalog";
import {
  spellComponentNames,
  spellDamageTypeKeys,
  spellSchoolKey,
} from "../spells/spell-catalog";

export const CONTENT_PAYLOAD_SCHEMA_VERSION = 1 as const;

const ContentPayloadMetadataSchema = z.object({
  schemaVersion: z.literal(CONTENT_PAYLOAD_SCHEMA_VERSION),
  kind: z.enum(["spell", "equipment", "monster", "shop", "checklist"]),
  language: z.literal("es"),
});

export const SpellContentPayloadSchema = ContentPayloadMetadataSchema.extend({
  kind: z.literal("spell"),
  name: z.string().min(1),
  level: z.number().int().min(0).max(9),
  description: z.string(),
  higherLevels: z.string(),
  range: z.string(),
  components: z.array(z.string().min(1)),
  material: z.string(),
  ritual: z.boolean(),
  duration: z.string(),
  concentration: z.boolean(),
  castingTime: z.string(),
  school: z.string(),
  classes: z.array(z.string().min(1)),
  attackType: z.enum(["attack", "save", "none"]),
  saveAbility: z.string(),
  damageExpression: z.string(),
  upcastDamageExpression: z.string(),
  addAbilityModifier: z.boolean(),
  damageTypes: z.array(z.string().min(1)),
  year: z.string(),
});

const EquipmentDefinitionSchema = CharacterInventoryItemDraftSchema.omit({
  order: true,
  group: true,
  catalog: true,
}).extend({ rarity: z.string() });

export const EquipmentContentPayloadSchema = ContentPayloadMetadataSchema.extend({
  kind: z.literal("equipment"),
  ...EquipmentDefinitionSchema.shape,
});

const MonsterFeatureSchema = z.object({
  name: z.string(),
  content: z.string(),
  usage: z.string(),
});

const MonsterInventoryPayloadSchema = CharacterInventoryItemV2Schema.omit({ catalog: true });

export const MonsterContentPayloadSchema = ContentPayloadMetadataSchema.extend({
  kind: z.literal("monster"),
  id: z.string(),
  name: z.string().min(1),
  type: z.string(),
  size: z.string(),
  alignment: z.string(),
  challenge: z.string(),
  armorClass: z.number().int(),
  hitPoints: z.number().int().nonnegative(),
  hitPointFormula: z.string(),
  initiativeModifier: z.number().int(),
  initiativeAdvantage: z.boolean(),
  speed: z.array(z.string()),
  abilities: z.record(z.string(), z.number().int()),
  saves: z.array(z.string()),
  skills: z.array(z.string()),
  senses: z.array(z.string()),
  languages: z.array(z.string()),
  damageVulnerabilities: z.array(z.string()),
  damageResistances: z.array(z.string()),
  damageImmunities: z.array(z.string()),
  conditionImmunities: z.array(z.string()),
  traits: z.array(MonsterFeatureSchema),
  actions: z.array(MonsterFeatureSchema),
  reactions: z.array(MonsterFeatureSchema),
  legendaryActions: z.array(MonsterFeatureSchema),
  spells: z.array(z.string()),
  inventory: z.array(MonsterInventoryPayloadSchema),
});

export const ShopContentPayloadSchema = ContentPayloadMetadataSchema.extend({
  kind: z.literal("shop"),
  name: z.string().min(1),
  npcId: z.string().optional(),
  categories: z.record(z.string(), z.array(z.string().min(1))),
  interactions: z.object({
    interaction: z.boolean(),
    negotiation: z.boolean(),
    intimidation: z.boolean(),
    barter: z.boolean(),
    loot: z.boolean(),
    steal: z.boolean(),
    assault: z.boolean(),
    plantEvidence: z.boolean(),
    reputation: z.number().int(),
    difficulty: z.number().int(),
    commissionPercent: z.number().finite().min(0).max(100),
    negotiationStep: z.number().finite().min(0).max(100),
    intimidationReputationLoss: z.number().int().nonnegative(),
    fundsCopper: z.number().int().nonnegative(),
    theftsThisInteraction: z.number().int().nonnegative(),
    assaultMaxItems: z.number().int().positive(),
    assaultMaxWeight: z.number().finite().positive(),
    state: z.enum(["active", "unconscious", "dead"]),
  }),
});

export const ChecklistContentPayloadSchema = ContentPayloadMetadataSchema.extend({
  kind: z.literal("checklist"),
  ...GmChecklistItemSchema.shape,
});

export const CampaignContentPayloadSchema = z.discriminatedUnion("kind", [
  SpellContentPayloadSchema,
  EquipmentContentPayloadSchema,
  MonsterContentPayloadSchema,
  ShopContentPayloadSchema,
  ChecklistContentPayloadSchema,
]);

export type CanonicalContentKind = z.infer<typeof ContentPayloadMetadataSchema>["kind"];

/**
 * Legacy payloads have no schemaVersion and are intentionally returned as-is
 * for the kind-specific adapters. Versioned payloads must satisfy the complete
 * canonical contract and agree with the table discriminator.
 */
export function parseCampaignContentPayload(expectedKind: CanonicalContentKind, input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("El payload de contenido debe ser un objeto JSON.");
  const source = input as Record<string, unknown>;
  if (source.schemaVersion === undefined) return source;
  const parsed = CampaignContentPayloadSchema.parse(source);
  if (parsed.kind !== expectedKind) throw new Error(`El payload ${parsed.kind} no corresponde a una fila ${expectedKind}.`);
  return parsed;
}

const metadata = <Kind extends "spell" | "equipment" | "monster" | "shop" | "checklist">(kind: Kind) => ({
  schemaVersion: CONTENT_PAYLOAD_SCHEMA_VERSION,
  kind,
  language: "es" as const,
});

export function serializeSpellContentPayload(value: SpellDefinition): Record<string, unknown> {
  return SpellContentPayloadSchema.parse({
    ...metadata("spell"),
    ...value,
    catalog: undefined,
    components: spellComponentNames(value.components),
    classes: value.classes,
    school: spellSchoolKey(value.school),
    damageTypes: spellDamageTypeKeys(value.damageType),
    damageType: undefined,
  });
}

export function serializeEquipmentContentPayload(value: EquipmentCatalogDraft): Record<string, unknown> {
  const { catalog: _catalog, ...definition } = value;
  return EquipmentContentPayloadSchema.parse({ ...metadata("equipment"), ...definition });
}

export function serializeMonsterContentPayload(value: MonsterDefinition): Record<string, unknown> {
  const { catalog: _catalog, ...definition } = value;
  return MonsterContentPayloadSchema.parse({
    ...metadata("monster"),
    ...definition,
    size: definition.size ?? "",
    alignment: definition.alignment ?? "",
    inventory: definition.inventory.map(({ catalog: _itemCatalog, ...item }) => item),
  });
}

export function serializeShopContentPayload(value: GmShop): Record<string, unknown> {
  const { tags: _tags, inventory: _inventory, ...definition } = value;
  return ShopContentPayloadSchema.parse({
    ...metadata("shop"),
    ...definition,
    interactions: normalizeMerchantInteraction(value.interactions),
  });
}

export function serializeChecklistContentPayload(value: GmChecklistItem): Record<string, unknown> {
  return ChecklistContentPayloadSchema.parse({ ...metadata("checklist"), ...value });
}
