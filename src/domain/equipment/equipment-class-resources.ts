import type { CharacterV2 } from "../character/character-v2";
import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { inventoryEquipmentDefinition } from "./equipment-live";

function effects(item: CharacterInventoryItemV2, featureId: string) {
  return inventoryEquipmentDefinition(item)?.capabilities.find(c => c.id === featureId)?.effects.filter(e => e.kind === "class-resource") ?? [];
}
function inspirationPool(character: CharacterV2) {
  const traits = character.traits.flatMap(g => g.traits), id = character.spellcasting.bard?.inspirationId;
  if (id) return traits.find(t => t.id === id);
  // Legacy sheets may have the named class pool but no builder runtime. Never select an ambiguous counter.
  const matches = traits.filter(t => ["inspiracion de bardo", "inspiracion bardica", "bardic inspiration"].includes(t.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()));
  return matches.length === 1 ? matches[0] : undefined;
}
export function equipmentClassResourceIssue(character: CharacterV2, item: CharacterInventoryItemV2, featureId: string): string {
  const restores = effects(item, featureId);
  if (!restores.length) return "";
  if (character.combat.hitPoints.current <= 0 || character.combat.conditions.some(c => ["incapacitated", "unconscious", "stunned", "paralyzed", "petrified", "dead"].includes(c.key))) return "Necesitás poder actuar para tocar el tambor.";
  const pool = inspirationPool(character);
  if (!pool || pool.uses.maximum < 1) return "Configurá una reserva de Inspiración de Bardo en Rasgos para recuperar sus usos.";
  if (pool.uses.used < 1) return "Ya tenés todos los usos de Inspiración de Bardo.";
  return "";
}
/** The caller saves this restoration and the item's daily cost in one character mutation. */
export function restoreEquipmentClassResources(character: CharacterV2, item: CharacterInventoryItemV2, featureId: string): void {
  const restores = effects(item, featureId);
  if (!restores.length) return;
  const issue = equipmentClassResourceIssue(character, item, featureId);
  if (issue) throw new Error(issue);
  const pool = inspirationPool(character)!;
  pool.uses.used = Math.max(0, pool.uses.used - restores.reduce((n, effect) => n + effect.amount, 0));
}
