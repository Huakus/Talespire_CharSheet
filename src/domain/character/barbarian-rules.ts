import type { CharacterV2 } from "./character-v2";
import type { CharacterActionV2 } from "./character-action-model";
import { barbarianPath,barbarianTotem,barbarianStorm,barbarianBrutalDice } from "./barbarian-catalog";
export const barbarianRaging = (c: CharacterV2) => c.builder?.classKey === "barbarian" && c.spellcasting.barbarian?.raging === true;
export const barbarianHeavyArmor = (c: CharacterV2) => c.inventory.some((i) => i.equipped && i.category === "armor" && /^(heavy|pesada)$/i.test(i.armor?.armorCategory ?? ""));
export const barbarianRageBenefits = (c: CharacterV2) => barbarianRaging(c) && !barbarianHeavyArmor(c);
export const barbarianMindlessRage = (c: CharacterV2) => barbarianRaging(c) && c.identity.level >= 6 && barbarianPath(c.builder!) === "berserker";
export const barbarianBeyondDeath = (c: CharacterV2) => barbarianRaging(c) && c.identity.level >= 14 && barbarianPath(c.builder!) === "zealot";
export function barbarianMeleeAttack(c: CharacterV2,a: CharacterActionV2) {
  const weapon = c.inventory.find((i) => i.id === a.inventoryItemId)?.weapon;
  return (a.categories.includes("attack") || !!weapon) && !/ranged|distancia/i.test(a.weaponType) && !/\d\s*\/\s*\d/.test(a.reach) && (weapon?.range === "melee" || /melee|cuerpo/i.test(a.weaponType) || /^\s*(5|10|15)\s*(ft|pies)\s*$/i.test(a.reach));
}
export function barbarianCriticalDice(c: CharacterV2,a: CharacterActionV2) {
  const count = c.builder?.classKey === "barbarian" ? barbarianBrutalDice(c.identity.level) : 0, dice = a.damageExpression.match(/\d*d(\d+)/i);
  return count && dice && barbarianMeleeAttack(c,a) ? `${count}d${dice[1]}` : "";
}
/** Class resistances only; the sheet does not infer damage type from an HP amount. */
export function barbarianResistances(c: CharacterV2): string[] {
  if (c.builder?.classKey !== "barbarian") return [];
  const result = barbarianRaging(c) && barbarianTotem(c.builder,3) === "bear" ? ["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","radiant","slashing","thunder"] : barbarianRageBenefits(c) ? ["bludgeoning","piercing","slashing"] : [];
  const storm = barbarianStorm(c.builder);
  if (c.identity.level >= 6 && storm) result.push(storm === "desert" ? "fire" : storm === "sea" ? "lightning" : "cold");
  return [...new Set(result)];
}
export function endBarbarianRage(c: CharacterV2) {
  const r = c.spellcasting.barbarian;if (c.builder?.classKey !== "barbarian" || !r) return;
  if (r.raging && r.frenzy) c.combat.exhaustion = Math.min(6,c.combat.exhaustion+1);
  r.raging = false;r.frenzy = false;r.rageTurns = 0;r.relentlessPending = false;
  c.combat.conditions = c.combat.conditions.filter((p) => p.key !== "raging");
}
