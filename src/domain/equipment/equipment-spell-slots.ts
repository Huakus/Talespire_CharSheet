import type { CharacterV2 } from "../character/character-v2";
import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { inventoryEquipmentDefinition } from "./equipment-live";

export function equipmentSlotCapacity(item: CharacterInventoryItemV2, level: number): number {
  if (!item.rules || item.quantity < 1 || !item.equipped || item.requiresAttunement && !item.attuned) return 0;
  return (inventoryEquipmentDefinition(item)?.capabilities ?? []).filter((cap) => cap.activation === "passive").flatMap((cap) => cap.effects).reduce((sum, effect) => sum + (effect.kind === "spell-slot-capacity" && effect.level === level ? effect.amount : 0), 0);
}
export function projectEquipmentSpellSlots(character: CharacterV2, level: number): { maximum: number; used: number } {
  const base = character.spellcasting.slots[String(level)] ?? { maximum: 0, used: 0 };
  return character.inventory.reduce((state, item) => {
    const capacity = equipmentSlotCapacity(item, level);
    return { maximum: state.maximum + capacity, used: state.used + Math.min(capacity, item.rules?.slotUsage[String(level)] ?? 0) };
  }, { ...base });
}
/** Spend the source slot in place; removing or transferring the garment never refills it. */
export function spendEquipmentSpellSlot(character: CharacterV2, level: number): boolean {
  const item = character.inventory.find((entry) => equipmentSlotCapacity(entry, level) > (entry.rules?.slotUsage[String(level)] ?? 0));
  if (!item?.rules) return false;
  item.rules.slotUsage[String(level)] = (item.rules.slotUsage[String(level)] ?? 0) + 1;
  return true;
}
export function resetEquipmentSlots(item: CharacterInventoryItemV2, reset: string, character?: CharacterV2): CharacterInventoryItemV2 {
  if (!item.rules) return item;
  const pact = character?.builder?.classKey === "warlock" || /brujo|bruja|warlock/i.test(character?.identity.className ?? "");
  if (reset !== "long-rest" && !(reset === "short-rest" && pact)) return item;
  return { ...item, rules: { ...item.rules, slotUsage: {} } };
}
