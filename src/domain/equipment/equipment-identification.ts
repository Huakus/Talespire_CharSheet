import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";

export interface ItemIdentification { identified: boolean; name: string; appearance: string; }
export function itemIsIdentified(item: { name?: string; identification?: ItemIdentification }): boolean {
  return item.identification?.identified !== false;
}
export function assertItemIdentified(item: { name?: string; identification?: ItemIdentification }): void {
  if (!itemIsIdentified(item)) throw new Error("El GM debe identificar el objeto antes de usarlo.");
}
/** A presentation copy only. Never save this projection over the real item. */
export function unidentifiedItemView(item: CharacterInventoryItemV2): CharacterInventoryItemV2 {
  if (itemIsIdentified(item)) return item;
  const { rules: _rules, ...visible } = item;
  return { ...visible, name: item.identification?.name.trim() || "Objeto sin identificar", description: item.identification?.appearance ?? "",
    category: "", properties: [], cost: { quantity: 0, unit: "gp" }, equipped: false, attuned: false, requiresAttunement: false,
    usable: false, consumable: false, charges: null, armor: null, weapon: null, bonuses: [], features: [], effect: { active: false, description: "" },
    catalog: null };
}
