import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { CharacterInventoryItemV2Schema } from "../character/character-inventory-model";
import { EquipmentDefinitionDraftSchema, type EquipmentDefinitionDraft } from "./equipment-definition";
import { equipmentPlainDescription, inventoryEquipmentDefinition, bindReviewedEquipment } from "./equipment-live";
import type { CatalogMetadata } from "../content/catalog-metadata";
import type { JsonObject } from "../../shared/json";

/** Update verified text while preserving the entire owned-instance state. */
export function refreshEquipmentEditorialDefinition(
  item: CharacterInventoryItemV2,
  definition: EquipmentDefinitionDraft,
  previousCatalogName: string,
  catalog: CatalogMetadata | null,
): CharacterInventoryItemV2 {
  const old = inventoryEquipmentDefinition(item), nextDefinition = EquipmentDefinitionDraftSchema.parse(definition);
  if (!old || !item.rules || old.id !== nextDefinition.id) throw new Error("EDITORIAL_IDENTITY_CHANGED");
  for (const key of ["capabilities", "resources", "requirements", "weapon", "armor", "properties", "weight", "economy", "magical", "consumable", "rarity", "subtypes"] as const) {
    if (JSON.stringify(old[key]) !== JSON.stringify(nextDefinition[key])) throw new Error("EDITORIAL_MECHANICS_CHANGED:" + key);
  }
  if (old.category !== nextDefinition.category && !(old.category === "adventuring-gear" && nextDefinition.category === "tool")) throw new Error("EDITORIAL_CATEGORY_CHANGED");
  const result = structuredClone(item);
  result.rules = { ...result.rules!, definition: JSON.parse(JSON.stringify(nextDefinition)) as JsonObject };
  result.description = equipmentPlainDescription(nextDefinition);
  // Refresh literal source tables in generated capabilities, retaining custom prose and all state.
  result.features = result.features.map(feature => {
    const cap = old.capabilities.find(c => c.id === feature.id);
    if (!cap) return feature;
    let description = feature.description;
    for (const block of old.description) {
      if (block.type !== "table" || !cap.textBlockIds.includes(block.id)) continue;
      const replacement = nextDefinition.description.find(b => b.id === block.id);
      if (replacement?.type !== "table") continue;
      description = description.replaceAll(block.rows.map(row => row.join(" · ")).join("\n"), replacement.rows.map(row => row.join(" · ")).join("\n"));
    }
    return description === feature.description ? feature : { ...feature, description };
  });
  result.category = nextDefinition.category ?? result.category;
  if (result.name === previousCatalogName) result.name = nextDefinition.name;
  result.catalog = catalog;
  CharacterInventoryItemV2Schema.parse(result);
  return result;
}

/** Replace a verified placeholder with slot recovery while retaining the existing daily counter. */
export function refreshEquipmentSlotRecoveryDefinition(item: CharacterInventoryItemV2, definition: EquipmentDefinitionDraft, previousCatalogName: string, catalog: CatalogMetadata | null): CharacterInventoryItemV2 {
  definition = EquipmentDefinitionDraftSchema.parse(definition);
  const old = inventoryEquipmentDefinition(item);
  if (!old || !item.rules) throw new Error("SLOT_RECOVERY_MISSING_DEFINITION");
  const changed = definition.capabilities.filter(cap => JSON.stringify(cap) !== JSON.stringify(old.capabilities.find(c => c.id === cap.id)));
  if (changed.length !== 1 || definition.capabilities.length !== old.capabilities.length) throw new Error("SLOT_RECOVERY_SCOPE_CHANGED");
  const capability = changed[0]!, previous = old.capabilities.find(c => c.id === capability.id);
  if (capability.effects.length !== 1 || capability.effects[0]?.kind !== "spell-slot-recovery" || !previous?.effects.some(e => e.kind === "unmodeled") || JSON.stringify(previous.costs) !== JSON.stringify(capability.costs) || previous.consumeQuantity !== capability.consumeQuantity) throw new Error("SLOT_RECOVERY_MECHANICS_CHANGED");
  const shadow = structuredClone(item);
  shadow.rules!.definition = JSON.parse(JSON.stringify({ ...old, capabilities: definition.capabilities }));
  const next = refreshEquipmentEditorialDefinition(shadow, definition, previousCatalogName, catalog);
  const { rules: _rules, ...withoutRules } = item;
  const generated = bindReviewedEquipment({ ...withoutRules, features: [] }, definition).features.find(f => f.id === capability.id);
  const oldFeature = item.features.find(f => f.id === capability.id);
  if (!generated || !oldFeature || generated.chargeCost !== oldFeature.chargeCost) throw new Error("SLOT_RECOVERY_COUNTER_CHANGED");
  next.features = item.features.map(f => f.id === capability.id ? { ...generated, order: f.order, active: f.active, toggleable: f.toggleable, uses: f.uses, bonuses: f.bonuses } : f);
  return CharacterInventoryItemV2Schema.parse(next);
}

/** Reconcile the obsolete adapter label after native potion healing is tested. */
export function refreshEquipmentHealingExecution(item: CharacterInventoryItemV2, definition: EquipmentDefinitionDraft, previousCatalogName: string, catalog: CatalogMetadata | null): CharacterInventoryItemV2 {
  const old = inventoryEquipmentDefinition(item), reviewed = EquipmentDefinitionDraftSchema.parse(definition);
  if (!old || !item.rules || old.capabilities.length !== reviewed.capabilities.length) throw new Error("HEALING_EXECUTION_SCOPE_CHANGED");
  for (const cap of reviewed.capabilities) {
    const previous = old.capabilities.find(c => c.id === cap.id);
    if (!previous || JSON.stringify({ ...cap, execution: previous.execution }) !== JSON.stringify(previous) || cap.effects.length !== 1 || cap.effects[0]?.kind !== "healing" || cap.consumeQuantity !== 1 || cap.execution.mode !== "automatic" || cap.execution.handler !== "equipment-potion-healing") throw new Error("HEALING_EXECUTION_MECHANICS_CHANGED");
  }
  const shadow = structuredClone(item); shadow.rules!.definition = JSON.parse(JSON.stringify({ ...old, capabilities: reviewed.capabilities }));
  const next = refreshEquipmentEditorialDefinition(shadow, reviewed, previousCatalogName, catalog);
  next.features = next.features.map(f => ({ ...f, description: f.description.replace("Resolución asistida: aplicar las condiciones y resultados descritos; el botón registra el gasto cuando corresponda. Las automatizaciones pendientes se detallan en el objeto.", "").trim() }));
  return CharacterInventoryItemV2Schema.parse(next);
}
