import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { CharacterInventoryItemV2Schema } from "../character/character-inventory-model";
import { EquipmentDefinitionDraftSchema, type EquipmentDefinitionDraft } from "./equipment-definition";
import { equipmentPlainDescription, inventoryEquipmentDefinition } from "./equipment-live";
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
  result.category = nextDefinition.category ?? result.category;
  if (result.name === previousCatalogName) result.name = nextDefinition.name;
  result.catalog = catalog;
  CharacterInventoryItemV2Schema.parse(result);
  return result;
}
