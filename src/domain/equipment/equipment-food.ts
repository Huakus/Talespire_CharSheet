import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { inventoryEquipmentDefinition } from "./equipment-live";
export function equipmentFoodCapability(item: Pick<CharacterInventoryItemV2,"rules">) {
  for(const capability of inventoryEquipmentDefinition(item)?.capabilities??[]){const effect=capability.effects.find(e=>e.kind==='food');if(effect?.kind==='food')return{capability,days:effect.days};}
  return null;
}
