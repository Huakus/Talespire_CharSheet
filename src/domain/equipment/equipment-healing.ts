import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { inventoryEquipmentDefinition } from "./equipment-live";

/** A self-drinking shortcut only for a single, explicit healing effect. */
export function inventoryHealingExpression(item: CharacterInventoryItemV2, featureId: string): string | null {
  const definition=inventoryEquipmentDefinition(item), cap=definition?.capabilities.find((c)=>c.id===featureId);
  if (!definition?.consumable || !cap || cap.consumeQuantity < 1 || cap.effects.length !== 1) return null;
  const effect=cap.effects[0];
  return effect?.kind === "healing" ? effect.expression : null;
}
