import type { CharacterV2 } from "./character-v2";
import type { CharacterSpellV2 } from "./character-spell-model";

/** Item spells bind to an owned item and one of its existing resource-backed features. */
export function itemSpellSource(itemId: string, featureId: string): string {
  return `inventory:${itemId}:${featureId}`;
}
export function itemSpellState(character: CharacterV2, spell: CharacterSpellV2) {
  const match = spell.casting?.kind === "item" ? /^inventory:(inv_[a-f0-9]{32}):(.+)$/.exec(spell.casting.source) : null;
  const item = match ? character.inventory.find((i) => i.id === match[1]) : undefined;
  const feature = item?.features.find((f) => f.id === match?.[2]);
  const reason = !item || !feature ? "El objeto o su capacidad ya no están en el inventario."
    : item.quantity < 1 ? "No tenés este objeto."
    : !item.equipped ? "Equipá el objeto para lanzar este conjuro."
    : item.requiresAttunement && !item.attuned ? "Sintonizá el objeto para lanzar este conjuro."
    : feature.toggleable && feature.active ? "La capacidad del objeto ya está activa."
    : feature.chargeCost > 0 && (!item.charges || item.charges.current < feature.chargeCost) ? "El objeto no tiene cargas suficientes."
    : feature.uses && feature.uses.current < 1 ? "La capacidad del objeto no tiene usos disponibles."
    : "";
  return { item,feature,available: !reason,reason };
}
