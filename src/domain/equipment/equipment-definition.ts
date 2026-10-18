import { z } from "zod";
import { LosslessJsonObjectSchema } from "../../shared/lossless-json";
import { DAMAGE_TYPES, EQUIPMENT_RARITIES } from "./equipment-constants";
import { SpellcastingAbilitySchema } from "../character/character-spell-model";
import { parseDiceExpression } from "../dice/dice-expression";

/** Preparation contract. Deliberately separate from active version-1 content. */
const Key = z.string().min(1).refine((value) => value.trim().length > 0, "El valor no puede estar vacío.");
const Amount = z.number().finite().nonnegative();
const Dice = Key.refine((text) => { try { parseDiceExpression(text); return true; } catch { return false; } }, "Expresión de dados inválida.");
export const EquipmentSourceSchema = z.strictObject({
  id: Key,
  kind: z.enum(["book", "srd", "campaign", "legacy"]),
  title: Key,
  language: z.enum(["es", "en", "unknown"]),
  rulesEdition: z.literal("2014").nullable(),
  locator: Key.nullable(),
  verified: z.boolean(),
});

const BlockMetadata = {
  id: Key,
  section: z.enum(["description", "rules", "flavor", "gm-notes"]),
  provenance: z.enum(["official-spanish", "reviewed-translation", "campaign", "unreviewed"]),
  sourceIds: z.array(Key).min(1),
};
export const EquipmentTextBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...BlockMetadata, type: z.literal("paragraph"), text: Key }),
  z.strictObject({ ...BlockMetadata, type: z.literal("list"), ordered: z.boolean(), items: z.array(Key).min(1) }),
  z.strictObject({ ...BlockMetadata, type: z.literal("table"), columns: z.array(Key).min(1), rows: z.array(z.array(z.string())).min(1) }).refine((table) => table.rows.every((row) => row.length === table.columns.length), "La tabla debe conservar todas sus columnas."),
]);

export const EquipmentRequirementsSchema = z.strictObject({
  attunement: z.boolean().nullable(),
  bearer: z.array(z.strictObject({ kind: z.enum(["class", "spellcaster", "proficiency", "alignment", "other"]), keys: z.array(Key), explanation: Key })),
  presence: z.enum(["possessed", "worn", "held", "equipped", "other"]),
  explanation: z.string(),
});

const RecoveryAmount = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("full") }),
  z.strictObject({ kind: z.literal("fixed"), amount: z.number().int().positive() }),
  z.strictObject({ kind: z.literal("roll"), expression: Dice }),
]);
export const EquipmentResourceDefinitionSchema = z.strictObject({
  id: Key, name: Key,
  kind: z.enum(["charges", "uses", "finite", "components", "spell-storage"]),
  maximum: z.number().int().positive().nullable(),
  unit: Key,
  recovery: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("none") }),
    z.strictObject({ kind: z.literal("unknown") }),
    z.strictObject({ kind: z.literal("event"), event: z.enum(["short-rest", "long-rest", "dawn", "dusk", "other"]), explanation: z.string(), amount: RecoveryAmount }),
  ]),
  exhaustion: z.string(),
});

const EffectMetadata = { id: Key, condition: z.string() };
export const EquipmentEffectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...EffectMetadata, kind: z.literal("bonus"), target: Key, operation: z.enum(["add", "set", "minimum"]), value: z.number().finite() }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("damage"), expression: Dice, damageType: z.enum(DAMAGE_TYPES), timing: z.enum(["base", "versatile", "on-hit", "critical", "activation", "other"]) }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("healing"), expression: Dice, target: Key }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("class-resource"), resource: z.literal("bard-inspiration"), operation: z.literal("restore"), amount: z.number().int().positive() }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("spell"), spellKey: Key, level: z.number().int().min(0).max(9), ability: SpellcastingAbilitySchema.nullable(), saveDc: z.number().int().nonnegative().nullable(), attackBonus: z.number().int().nullable(), components: z.enum(["normal", "waived", "custom"]), explanation: z.string() }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("condition"), conditionKey: Key, operation: z.enum(["add", "remove", "prevent"]) }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("defense"), defense: z.enum(["resistance", "immunity", "vulnerability", "advantage", "disadvantage"]), target: Key }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("movement"), mode: Key, operation: z.enum(["add", "set", "minimum"]), feet: Amount }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("storage"), resourceId: Key, content: z.enum(["spells", "items"]), explanation: Key }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("spell-slot-capacity"), level: z.number().int().min(1).max(9), amount: z.number().int().positive(), pool: z.literal("inherit"), recovery: z.literal("inherit"), explanation: Key }),
  z.strictObject({ ...EffectMetadata, kind: z.literal("narrative"), instructions: Key }),
  // Preserve unusual mechanics in drafts instead of inventing an adapter or discarding them.
  z.strictObject({ ...EffectMetadata, kind: z.literal("unmodeled"), explanation: Key, original: LosslessJsonObjectSchema }),
]);

export const EquipmentCapabilitySchema = z.strictObject({
  id: Key, name: Key,
  activation: z.enum(["passive", "action", "bonus-action", "reaction", "trigger", "other"]),
  trigger: z.string(),
  requirements: EquipmentRequirementsSchema,
  target: z.string(), range: z.string(), duration: z.string(), concentration: z.union([z.boolean(), z.literal("spell-dependent")]),
  costs: z.array(z.strictObject({ resourceId: Key, amount: z.number().int().positive() })),
  consumeQuantity: z.number().int().nonnegative(),
  effects: z.array(EquipmentEffectSchema).min(1),
  execution: z.strictObject({
    mode: z.enum(["automatic", "assisted", "narrative", "unsupported"]),
    handler: Key.nullable(), explanation: z.string(),
    pendingAutomation: z.array(Key).default([]),
  }),
  textBlockIds: z.array(Key).min(1),
});

const Price = z.strictObject({ quantity: Amount, unit: z.enum(["cp", "sp", "ep", "gp", "pp"]) });
export const EquipmentDefinitionDraftSchema = z.strictObject({
  format: z.literal("equipment-definition-draft"),
  schemaVersion: z.literal(1),
  id: Key,
  revision: z.number().int().nonnegative(),
  language: z.literal("es"),
  name: Key, aliases: z.array(Key), baseDefinitionId: Key.nullable(),
  origin: z.enum(["official", "campaign", "unknown"]),
  sources: z.array(EquipmentSourceSchema),
  category: z.enum(["adventuring-gear", "weapon", "armor", "shield", "tool", "ammunition", "potion", "scroll", "wand", "staff", "rod", "ring", "wondrous-item", "mount", "vehicle", "tack", "other"]).nullable(),
  subtypes: z.array(Key),
  magical: z.boolean().nullable(),
  rarity: z.enum(EQUIPMENT_RARITIES).nullable(),
  consumable: z.boolean().nullable(),
  properties: z.array(Key),
  weight: z.strictObject({ value: Amount, unit: z.enum(["lb", "kg"]) }).nullable(),
  economy: z.strictObject({ basePrice: Price.nullable(), campaignPrice: Price.nullable(), explanation: z.string() }),
  description: z.array(EquipmentTextBlockSchema),
  requirements: EquipmentRequirementsSchema,
  weapon: z.strictObject({ category: z.enum(["simple", "martial", "other"]), meleeReachFeet: Amount.nullable(), thrown: z.boolean(), rangeFeet: z.strictObject({ normal: Amount, long: Amount.nullable() }).nullable(), attackBonus: z.number().int(), damageBonus: z.number().int(), damageMode: z.enum(["components", "none"]).optional(), baseDamage: z.array(EquipmentEffectSchema) }).nullable(),
  armor: z.strictObject({ category: z.enum(["light", "medium", "heavy", "shield"]), baseArmorClass: z.number().int().nonnegative(), dexterity: z.enum(["none", "full", "capped"]), dexterityCap: z.number().int().nonnegative().nullable(), strengthMinimum: z.number().int().nonnegative().nullable(), stealthDisadvantage: z.boolean(), armorClassBonus: z.number().int() }).nullable(),
  resources: z.array(EquipmentResourceDefinitionSchema),
  capabilities: z.array(EquipmentCapabilitySchema),
  recoverySourceIds: z.array(Key),
  review: z.strictObject({ identity: z.boolean(), information: z.boolean(), editorial: z.boolean(), mechanics: z.boolean(), unresolved: z.array(Key) }),
});

export type EquipmentDefinitionDraft = z.infer<typeof EquipmentDefinitionDraftSchema>;
export type EquipmentCapability = z.infer<typeof EquipmentCapabilitySchema>;
export interface EquipmentCompletionPolicy {
  formatSupported: boolean;
  allowReviewedTranslations: boolean;
  allowAssistedEffects: boolean;
  allowedSourceIds: ReadonlySet<string>;
  /** Actual verified adapters, not a claim made by the content author. */
  handlers: ReadonlyMap<string, { mode: "automatic" | "assisted"; effectKinds: ReadonlySet<string> }>;
}

/** Reports blockers; parsing a valid draft never certifies it as definitive. */
export function equipmentCompletionIssues(input: unknown, policy: EquipmentCompletionPolicy): string[] {
  const parsed = EquipmentDefinitionDraftSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  const value = parsed.data, issues: string[] = [];
  if (!policy.formatSupported) issues.push("El formato nuevo aún no está integrado para su uso en el symbiote.");
  const unique = (ids: string[], kind: string): void => { if (new Set(ids).size !== ids.length) issues.push(`${kind}: identificadores repetidos.`); };
  unique(value.sources.map((s) => s.id), "sources"); unique(value.description.map((b) => b.id), "description");
  unique(value.resources.map((r) => r.id), "resources"); unique(value.capabilities.map((c) => c.id), "capabilities");
  const sourceIds = new Set(value.sources.map((s) => s.id)), blockIds = new Set(value.description.map((b) => b.id)), resourceIds = new Set(value.resources.map((r) => r.id));
  if (value.baseDefinitionId === value.id) issues.push("Una variante no puede ser su propia base.");
  if (value.origin === "unknown" || value.category === null || value.magical === null || value.rarity === null || value.consumable === null || value.requirements.attunement === null) issues.push("Faltan datos de clasificación, procedencia o sintonización.");
  if (!value.sources.some((s) => s.verified && s.kind !== "legacy" && policy.allowedSourceIds.has(s.id))) issues.push("Falta una fuente verificada y admitida.");
  if (value.description.length === 0) issues.push("Falta el contenido descriptivo o la tabla de datos de la fuente.");
  if (value.recoverySourceIds.length === 0) issues.push("Falta vincular la recuperación de información con sus originales.");
  for (const block of value.description) {
    if (block.sourceIds.some((id) => !sourceIds.has(id))) issues.push(`${block.id}: fuente inexistente.`);
    if (block.provenance === "unreviewed" || (block.provenance === "reviewed-translation" && !policy.allowReviewedTranslations)) issues.push(`${block.id}: traducción o texto pendiente según el criterio acordado.`);
    if (block.provenance === "official-spanish" && !block.sourceIds.some((id) => value.sources.some((s) => s.id === id && s.language === "es" && s.verified && ["book", "srd"].includes(s.kind)))) issues.push(`${block.id}: no hay una fuente española oficial verificada.`);
  }
  if (value.category === "weapon" && value.weapon === null) issues.push("Faltan las estadísticas del arma.");
  if (["armor", "shield"].includes(value.category ?? "") && value.armor === null) issues.push("Faltan las estadísticas de la armadura o escudo.");
  if (value.weapon?.baseDamage.some((effect) => effect.kind !== "damage")) issues.push("El daño base debe contener exclusivamente componentes de daño.");
  if (value.weapon && value.weapon.baseDamage.length === 0 && value.weapon.damageMode !== "none") issues.push("Falta el daño base o indicar expresamente que el arma no causa daño.");
  if (value.weapon?.damageMode === "none" && (value.weapon.baseDamage.length || value.weapon.damageBonus)) issues.push("Un arma sin daño no puede tener componentes ni bonificador de daño aplicables.");
  if (value.armor?.dexterity === "capped" && value.armor.dexterityCap === null) issues.push("Falta el límite de Destreza de la armadura.");
  for (const resource of value.resources) {
    if (resource.maximum === null || resource.recovery.kind === "unknown") issues.push(`${resource.id}: recurso incompleto.`);
  }
  for (const capability of value.capabilities) {
    unique(capability.effects.map((effect) => effect.id), capability.id);
    if (capability.requirements.attunement === null) issues.push(`${capability.id}: requisitos incompletos.`);
    if (["trigger", "reaction"].includes(capability.activation) && !capability.trigger.trim()) issues.push(`${capability.id}: falta el disparador de la capacidad.`);
    if (capability.textBlockIds.some((id) => !blockIds.has(id))) issues.push(`${capability.id}: texto de reglas inexistente.`);
    for (const cost of capability.costs) if (!resourceIds.has(cost.resourceId)) issues.push(`${capability.id}: recurso de coste inexistente.`);
    for (const resourceId of new Set(capability.costs.map((cost) => cost.resourceId))) {
      const maximum = value.resources.find((resource) => resource.id === resourceId)?.maximum;
      const total = capability.costs.filter((cost) => cost.resourceId === resourceId).reduce((sum, cost) => sum + cost.amount, 0);
      if (maximum !== null && maximum !== undefined && total > maximum) issues.push(`${capability.id}: el coste supera la capacidad del recurso.`);
    }
    for (const effect of capability.effects) {
      if (effect.kind === "unmodeled") issues.push(`${capability.id}: mecánica aún sin representar.`);
      if (effect.kind === "storage" && !resourceIds.has(effect.resourceId)) issues.push(`${capability.id}: almacenamiento sin recurso.`);
    }
    const execution = capability.execution;
    if (execution.mode === "automatic" && execution.pendingAutomation.length) issues.push(`${capability.id}: una capacidad automática no puede ocultar automatizaciones pendientes.`);
    if (execution.mode === "assisted" && (!execution.pendingAutomation.length || !execution.explanation.trim())) issues.push(`${capability.id}: la asistencia debe explicar el procedimiento y lo que falta automatizar.`);
    if (execution.mode === "unsupported") issues.push(`${capability.id}: falta soporte de ejecución.`);
    else if (execution.mode === "narrative") {
      if (capability.effects.some((e) => e.kind !== "narrative")) issues.push(`${capability.id}: una resolución narrativa no aplica efectos de ficha.`);
      if (capability.costs.length || capability.consumeQuantity) issues.push(`${capability.id}: el consumo de recursos necesita un adaptador automático o asistido.`);
    } else {
      const handler = execution.handler === null ? undefined : policy.handlers.get(execution.handler);
      if (!handler || handler.mode !== execution.mode || capability.effects.some((e) => !handler.effectKinds.has(e.kind))) issues.push(`${capability.id}: adaptador no implementado o incompatible.`);
      if (execution.mode === "assisted" && !policy.allowAssistedEffects) issues.push(`${capability.id}: se requiere automatización según el criterio acordado.`);
    }
  }
  if (!value.review.identity || !value.review.information || !value.review.editorial || !value.review.mechanics || value.review.unresolved.length) issues.push("La revisión tiene decisiones o comprobaciones pendientes.");
  return issues;
}

export function serializeEquipmentDefinitionDraft(input: unknown): string {
  return JSON.stringify(EquipmentDefinitionDraftSchema.parse(input));
}
export function parseEquipmentDefinitionDraft(text: string): EquipmentDefinitionDraft {
  return EquipmentDefinitionDraftSchema.parse(JSON.parse(text));
}
