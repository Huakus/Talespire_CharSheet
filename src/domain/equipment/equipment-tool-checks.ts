import identities from "./equipment-tool-identities.json";
import type { CharacterV2 } from "../character/character-v2";
import type { CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { projectAbilityCheckModifier, projectAdjustedRollMode, type AbilityKey } from "../character/character-projection";
import type { RollMode } from "../character/character-checks";
import { THIEVES_EXPERTISE } from "../character/rogue-catalog";
import { inventoryEquipmentDefinition } from "./equipment-live";

const key = (text: string): string => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function inventoryToolIdentity(item: CharacterInventoryItemV2) {
  const definition = inventoryEquipmentDefinition(item);
  if (definition?.category !== "tool" && item.category !== "tool") return null;
  const names = [definition?.name ?? item.name, ...(definition?.aliases ?? [])].map(key);
  return identities.find(identity => identity.aliases.some(alias => names.includes(key(alias)))) ?? null;
}

export function projectEquipmentToolCheck(character: CharacterV2, item: CharacterInventoryItemV2, ability: AbilityKey, mode: RollMode = "normal") {
  const tool = inventoryToolIdentity(item);
  if (!tool) throw new Error("El objeto no es una herramienta, instrumento o juego reconocido.");
  if (item.quantity < 1) throw new Error("No queda ninguna unidad de esta herramienta.");
  const known = character.proficiencies.tools.map(key);
  const expert = character.builder?.classKey === "rogue" && tool.key === "thieves-tools" && character.spellcasting.rogue?.expertise.includes(THIEVES_EXPERTISE);
  const rank = expert ? 2 : tool.aliases.some(alias => known.includes(key(alias))) ? 1 : 0;
  return { tool, rank, modifier: projectAbilityCheckModifier(character, ability, rank), minimum: character.builder?.classKey === "rogue" && character.identity.level >= 11 && rank > 0 ? 10 : 1, mode: projectAdjustedRollMode(character, "skills", [ability, tool.key], mode) };
}
