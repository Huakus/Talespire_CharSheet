import { z } from "zod";
import { EquipmentDefinitionDraftSchema, type EquipmentDefinitionDraft } from "./equipment-definition";
import { EquipmentSourceArchiveSchema, EquipmentRecoveryDecisionSchema } from "./equipment-recovery";
import type { CatalogMetadata } from "../content/catalog-metadata";
import type { EquipmentSourceArchive } from "./equipment-recovery";

// Older clients reject this versioned payload instead of treating it as usable gear.
export const EquipmentPreparationPayloadSchema = z.strictObject({
  schemaVersion: z.literal(2), kind: z.literal("equipment"), language: z.literal("es"),
  format: z.literal("equipment-preparation"), definition: EquipmentDefinitionDraftSchema,
  originals: z.array(EquipmentSourceArchiveSchema), decisions: z.array(EquipmentRecoveryDecisionSchema),
});
export type EquipmentPreparationPayload = z.infer<typeof EquipmentPreparationPayloadSchema>;
export interface EquipmentPreparation { payload: EquipmentPreparationPayload; catalog: CatalogMetadata | null }
export interface EquipmentPreparationIssue { contentKey: string; name: string; message: string }

export function isEquipmentPreparationPayload(input: unknown): boolean {
  return input !== null && typeof input === "object" && !Array.isArray(input) && (input as Record<string, unknown>).format === "equipment-preparation";
}
export function emptyEquipmentDefinition(id: string, name: string): EquipmentDefinitionDraft {
  return EquipmentDefinitionDraftSchema.parse({
    format: "equipment-definition-draft", schemaVersion: 1, id, revision: 0, language: "es", name, aliases: [], baseDefinitionId: null,
    origin: "unknown", sources: [], category: null, subtypes: [], magical: null, rarity: null, consumable: null, properties: [], weight: null,
    economy: { basePrice: null, campaignPrice: null, explanation: "" }, description: [],
    requirements: { attunement: null, bearer: [], presence: "other", explanation: "Requisitos pendientes de cotejo." },
    weapon: null, armor: null, resources: [], capabilities: [], recoverySourceIds: [],
    review: { identity: false, information: false, editorial: false, mechanics: false, unresolved: ["Completar el cotejo de fuentes, texto y mecánicas."] },
  });
}

/** Related sources are evidence to compare, never a proof that their rules may be merged. */
export function preparationFromOriginals(id: string, primary: EquipmentSourceArchive, originals: EquipmentSourceArchive[], campaignId: string): EquipmentPreparation {
  const raw = primary.raw, payload = raw.payload !== null && typeof raw.payload === "object" && !Array.isArray(raw.payload) ? raw.payload : raw;
  const definition = emptyEquipmentDefinition(id, typeof raw.name === "string" ? raw.name : typeof payload.name === "string" ? payload.name : "Objeto por identificar");
  const sourceId = `original:${primary.id}`;
  definition.sources = originals.map((original) => {
    const tags = Array.isArray(original.raw.tags) ? original.raw.tags : [];
    const language = tags.some((tag) => tag === "eng" || tag === "en") ? "en" as const : tags.includes("es") ? "es" as const : "unknown" as const;
    return { id: `original:${original.id}`, kind: "legacy" as const, title: typeof original.raw.name === "string" ? original.raw.name : original.originalKey, language, rulesEdition: null, locator: original.originalKey, verified: false };
  });
  definition.recoverySourceIds = originals.map((source) => source.id);
  const text = payload.description ?? payload.desc;
  const paragraphs = Array.isArray(text) ? text.filter((value): value is string => typeof value === "string" && Boolean(value.trim())) : typeof text === "string" && text.trim() ? [text] : [];
  definition.description = paragraphs.map((paragraph, index) => ({ id: `original-text-${index}`, type: "paragraph", section: "description", provenance: "unreviewed", sourceIds: [sourceId], text: paragraph }));
  if (originals.length > 1) definition.review.unresolved.push("Comparar todas las versiones conservadas: las coincidencias son candidatas, no equivalencias confirmadas.");
  definition.review.unresolved.push("Trasladar estadísticas, requisitos y recursos sin usar valores por defecto para datos desconocidos.");

  const nativeFeatures = Array.isArray(payload.features) ? payload.features : [];
  const legacyBonuses = Array.isArray(payload.bonus) ? payload.bonus : [];
  for (const [index, entry] of [...nativeFeatures, ...legacyBonuses].entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    definition.capabilities.push({
      id: `recovered-capability-${index}`, name: typeof entry.name === "string" && entry.name.trim() ? entry.name : typeof entry.key === "string" && entry.key.trim() ? entry.key : `Regla recuperada ${index + 1}`,
      activation: "other", trigger: "", requirements: { ...definition.requirements }, target: "", range: "", duration: "", concentration: false,
      costs: [], consumeQuantity: 0,
      effects: [{ id: `recovered-effect-${index}`, kind: "unmodeled", condition: "", explanation: "Regla conservada íntegramente; pendiente de representar en el formato nuevo.", original: entry }],
      execution: { mode: "unsupported", handler: null, explanation: "Falta integrar y verificar esta regla en el formato nuevo; esto no evalúa el funcionamiento de la copia antigua.", pendingAutomation: ["Representar condiciones, costes y efectos de la regla recuperada.", "Integrar su ejecución y aplicación a la ficha."] },
      textBlockIds: definition.description.map((block) => block.id),
    });
  }
  // A recovered ability without text still needs a non-empty text reference in the draft contract.
  if (definition.capabilities.length && !definition.description.length) {
    definition.description.push({ id: "recovery-note", type: "paragraph", section: "gm-notes", provenance: "unreviewed", sourceIds: [sourceId], text: "Las reglas originales están conservadas en las capacidades recuperadas. Falta cotejar y redactar su presentación española." });
    definition.capabilities.forEach((capability) => { capability.textBlockIds = ["recovery-note"]; });
  }

  if (campaignId === "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd") {
    const stixSource = "gm:equipment:1b428562-bbef-4bec-8445-a76f7e16f854", baseSource = "gm:equipment:f92abc1a-849e-47e0-995b-0602c7156af8";
    if ([stixSource, baseSource].includes(primary.originalKey)) {
      definition.origin = "campaign";
      definition.review.unresolved.push("Decisión del GM: Hoja Fásica es exclusiva de la variante de Stix; no propagarla a las demás dagas.");
      if (primary.originalKey === stixSource) {
        definition.name = "Daga del Umbral · variante de Stix";
        definition.baseDefinitionId = `recovery:${baseSource}`;
        definition.requirements.bearer.push({ kind: "other", keys: ["chr_2de8dab74a76cdd8d2b0d37cc84725ea"], explanation: "Variante exclusiva de Stix, según decisión del GM." });
        definition.review.unresolved.push("La referencia antigua también aparece en JuanPi y Delerion: la futura migración debe resolver el destino por copia, no redirigir toda la clave a la variante de Stix.");
      }
    }
  }
  return { payload: EquipmentPreparationPayloadSchema.parse({ schemaVersion: 2, kind: "equipment", language: "es", format: "equipment-preparation", definition, originals, decisions: [] }), catalog: null };
}
