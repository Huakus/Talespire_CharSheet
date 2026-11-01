import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { inventoryEquipmentDefinition } from "./equipment-live";

export function equipmentPackContents(item: Pick<CharacterInventoryItemV2, "rules">) {
  return inventoryEquipmentDefinition(item)?.capabilities.flatMap(c => c.effects).find(e => e.kind === "unpack")?.contents ?? null;
}
