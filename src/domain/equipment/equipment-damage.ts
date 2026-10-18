import type { CharacterV2 } from "../character/character-v2";
import { equipmentBearerIssue, inventoryEquipmentDefinition } from "./equipment-live";
import { isLucentCore, lucentCoreState } from "./equipment-lucent-core";
import { DAMAGE_TYPES } from "./equipment-constants";
export type EquipmentDamageType = typeof DAMAGE_TYPES[number];

/** Only explicit automatic, unconditional defenses; conditional prose is never guessed. */
export function equipmentDamageDefenses(character: CharacterV2, damageType: EquipmentDamageType, magical: boolean): Set<string> {
  const result = new Set<string>();
  for (const item of character.inventory) {
    if (!item.quantity || !item.equipped || item.requiresAttunement && !item.attuned || equipmentBearerIssue(character,item)) continue;
    if (isLucentCore(item)) {
      const core=lucentCoreState(item);
      if (core.active === "blue" && core.remainingRounds > 0 && damageType === "cold") result.add("resistance");
    }
    for (const cap of inventoryEquipmentDefinition(item)?.capabilities ?? []) {
      if (cap.activation !== "passive" || cap.execution.mode !== "automatic") continue;
      for (const effect of cap.effects) if (effect.kind === "defense" && !effect.condition &&
        (effect.target === damageType || effect.target === "nonmagical-damage" && !magical)) result.add(effect.defense);
    }
  }
  return result;
}
export function adjustEquipmentDamage(character: CharacterV2, amount: number, damageType: EquipmentDamageType, magical = false): number {
  const defenses=equipmentDamageDefenses(character,damageType,magical);
  if (defenses.has("immunity")) return 0;
  let damage=amount;
  if (defenses.has("resistance")) damage=Math.floor(damage/2);
  if (defenses.has("vulnerability")) damage*=2;
  return damage;
}
