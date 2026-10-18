import type { CharacterV2 } from "./character-v2";
import { CharacterSpellV2Schema, type CharacterSpellV2 } from "./character-spell-model";
import { equipmentBearerIssue } from "../equipment/equipment-live";
import { inventoryEquipmentDefinition } from "../equipment/equipment-live";
import { PHB_SPELLS } from "./phb-spells";
import { createDeterministicId } from "../../shared/id";

/** Reconcile grants after acquisition/transfer; an item never teaches a class spell. */
export async function syncInventorySpellGrants(character: CharacterV2): Promise<void> {
  const validSources = new Set<string>();
  for (const item of character.inventory) for (const cap of inventoryEquipmentDefinition(item)?.capabilities ?? []) for (const effect of cap.effects) {
    if (effect.kind !== "spell" || !PHB_SPELLS[effect.spellKey]) continue;
    const source = itemSpellSource(item.id, cap.id); validSources.add(source);
    if (character.spellcasting.spells.some((s) => s.casting?.source === source)) continue;
    const definition = structuredClone(PHB_SPELLS[effect.spellKey]!);
    if (effect.components === "waived") { definition.components = ""; definition.material = ""; }
    else if (effect.components === "custom" && effect.explanation.includes("materiales")) { definition.components = definition.components.replace(/,?\s*M(?:\s*\([^)]*\))?/g, ""); definition.material = ""; }
    character.spellcasting.spells.push(CharacterSpellV2Schema.parse({ id: await createDeterministicId("spl", character.id, item.id, cap.id), order: 10000 + character.spellcasting.spells.length, name: definition.name, level: effect.level, prepared: true, definition, casting: { kind: "item", source, key: effect.spellKey, ability: effect.ability ?? "intelligence", level: effect.level, traitId: null }, effect: { active: false, description: "" } }));
  }
  character.spellcasting.spells = character.spellcasting.spells.filter((spell) => {
    if (spell.casting?.kind !== "item" || !spell.casting.source.startsWith("inventory:")) return true;
    const itemId = /^inventory:(inv_[a-f0-9]{32}):/.exec(spell.casting.source)?.[1];
    const item = character.inventory.find((i) => i.id === itemId);
    return !!item && (!item.rules || validSources.has(spell.casting.source));
  });
}

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
    : equipmentBearerIssue(character, item, feature.id);
  return { item,feature,available: !reason,reason };
}
