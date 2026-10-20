import { CharacterV2Schema, type CharacterV2 } from "../character/character-v2";
import type { EquipmentCatalogDraft } from "./equipment-catalog";
import { bindReviewedEquipment, equipmentPlainDescription, inventoryEquipmentDefinition } from "./equipment-live";

/** Fresh creation prefers the campaign's current row over its bundled offline fallback. */
export function bindGuidedEquipmentCatalog(character: CharacterV2, catalog: readonly EquipmentCatalogDraft[]): CharacterV2 {
  if (!catalog.length) return character;
  const next = structuredClone(character);
  next.inventory = next.inventory.map(item => {
    const source = catalog.find(c => c.catalog?.contentKey === item.catalog?.contentKey);
    const definition = source && inventoryEquipmentDefinition(source);
    if (!source?.catalog || !definition || definition.origin !== "official" || definition.magical !== false || !definition.review.editorial) return item;
    const old = inventoryEquipmentDefinition(item), personalName = !!old && item.name !== old.name;
    const customText = !!old && item.description !== equipmentPlainDescription(old);
    const ids = new Set(old?.capabilities.map(c => c.id) ?? []);
    const { rules: _rules, ...plain } = item;
    const bound = bindReviewedEquipment({ ...plain, features: plain.features.filter(f => !ids.has(f.id)) }, definition, {preserveName: personalName});
    bound.catalog = structuredClone(source.catalog);
    if (customText) bound.description = item.description;
    return bound;
  });
  return CharacterV2Schema.parse(next);
}
