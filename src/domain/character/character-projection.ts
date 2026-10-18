import { monkMovement,monkWeaponKeys,paladinOath } from "./martial-catalog";
import { BUILDER_WEAPONS } from "./fighter-builder-catalog";
import { sorcererOrigin } from "./sorcerer-catalog";
import { rangerArchetype } from "./ranger-catalog";
import { barbarianTotem,barbarianStorm,barbarianRageDamage } from "./barbarian-catalog";
import { barbarianHeavyArmor,barbarianRageBenefits,barbarianMindlessRage,barbarianMeleeAttack } from "./barbarian-rules";
import { rogueArchetype } from "./rogue-catalog";
function warMagicDefense(character: CharacterV2): number { return character.builder?.classKey === "wizard" && character.identity.level >= 10 && character.builder.levels.find((s) => s.level === 2)?.subclass === "war-magic" && character.combat.conditions.some((c) => c.key === "concentration") ? 2 : 0; }
import { replayWarlockChoices } from "./warlock-builder";
import { wizardSpellSource } from "./wizard-catalog";
import type { CharacterV2 } from "./character-v2";
import {
  SKILL_DEFINITIONS,
  type SaveKey,
  type SkillKey,
} from "./character-checks";
import type { CharacterActionV2 } from "./character-action-model";
import type { CharacterSpellV2, SpellcastingAbility } from "./character-spell-model";
import type { RollMode } from "./character-checks";
import type { InventoryBonus } from "./character-inventory-model";
import { inventoryEquipmentDefinition, equipmentBearerIssue } from "../equipment/equipment-live";

export type AbilityKey = keyof CharacterV2["abilities"];

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

function hasBuilderStyle(character: CharacterV2, style: string): boolean {
  if (character.builder?.classKey === "paladin") return character.builder.levels.some((s) => s.paladin.style === style);
  if (character.builder?.classKey === "ranger") return character.builder.levels.some((s) => s.ranger.style === style);
  if (character.builder?.classKey === "bard") return character.builder.levels.some((s) => s.bard.style === style);
  return character.builder?.classKey === "fighter" && (character.builder.creation.style === style || Boolean(character.builder.levels.some((step) => step.additionalStyle === style)));
}
/** Legacy sheets record Defense as a manual trait; keep its +1 conditional on armor. */
function legacyDefenseCorrection(character: CharacterV2, wearingArmor: boolean): number {
  if (character.builder || !/guerrero|fighter|palad[ií]n|explorador|ranger/i.test(character.identity.className)) return 0;
  const trait = character.traits.flatMap((g) => g.traits).find((t) => /^estilo de (?:lucha|combate)\s*:\s*(?:defensa|defensivo|defense)$/i.test(t.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  if (!trait || trait.adjustment && trait.adjustment.value !== 1) return 0;
  const encoded = trait.adjustment?.applyToDerived && normalizedKey(trait.adjustment.category) === "combatstats" && normalizedKey(trait.adjustment.subcategory) === "ac" ? trait.adjustment.value : 0;
  return (wearingArmor ? 1 : 0) - encoded;
}

export function hasBuilderFeat(character: CharacterV2, key: string): boolean {
  return character.builder?.creation.initialFeat?.key === key || Boolean(character.builder?.levels.some((step) => step.feat?.key === key));
}
function championAthlete(character: CharacterV2): boolean {
  return character.identity.level >= 7 && character.builder?.levels.find((step) => step.subclass)?.subclass === "champion";
}

export const monkArmed = (c: CharacterV2) => c.inventory.some((i) => i.equipped && ["armor","shield"].includes(i.category));
export function monkWeapon(c: CharacterV2,item: CharacterV2["inventory"][number]) { return !!item.weapon && (item.name === BUILDER_WEAPONS.shortsword!.name || item.weapon.range === "melee" && item.weapon.category.startsWith("simple") && !item.properties.some((p) => ["two-handed","heavy"].includes(p)) || !!c.builder && monkWeaponKeys(c.builder).some((k) => BUILDER_WEAPONS[k]?.name === item.name)); }
export const monkMartialArts = (c: CharacterV2) => c.builder?.classKey === "monk" && !monkArmed(c) && !c.inventory.some((i) => i.equipped && i.weapon && !monkWeapon(c,i));
export function paladinAuraBonus(c: CharacterV2) { return c.builder?.classKey === "paladin" && c.identity.level >= 6 && c.combat.hitPoints.current > 0 && !c.combat.conditions.some((p) => ["unconscious","dead"].includes(p.key)) ? Math.max(1,projectedAbilityModifier(c,"charisma")) : 0; }
export function preferredWeaponAbility(
  scores: Pick<CharacterV2["abilities"], "strength" | "dexterity">,
  item: Pick<CharacterV2["inventory"][number], "weapon" | "properties">,
): "strength" | "dexterity" {
  if (item.properties.includes("finesse")) return scores.dexterity > scores.strength ? "dexterity" : "strength";
  return item.weapon?.range.toLowerCase().includes("ranged") ? "dexterity" : "strength";
}

export function projectHeavyArmorSpeedPenalty(character: CharacterV2): number {
  if (!character.builder || character.builder.creation.race.includes("dwarf")) return 0;
  const armor = character.inventory.find((item) => item.equipped && item.category === "armor" && item.armor);
  if (!armor?.armor || !["heavy", "pesada"].includes(armor.armor.armorCategory.toLowerCase())) return 0;
  // Legacy inventories predate the structured requirement. Recognize PHB armor
  // names until the player edits the item and saves an explicit requirement.
  const legacyRequirement: Record<string, number> = { chainmail: 13, cotademalla: 13, splint: 15, armaduradebandas: 15, plate: 15, armaduradeplacas: 15 };
  const required = armor.armor.strengthRequirement ?? legacyRequirement[normalizedKey(armor.name)] ?? 0;
  return projectAbilityScore(character, "strength") < required ? 10 : 0;
}

export function projectUpdatedBuilderSpeed(previous: CharacterV2, next: CharacterV2): string {
  const stoneSpeed = (c: CharacterV2) => c.spellcasting.wizard?.stone?.bearer === "self" && c.spellcasting.wizard.stone.benefit === "speed" && c.spellcasting.wizard.stone.unencumbered && !projectInventory(c).overCapacity ? 10 : 0;
  const scoutSpeed = (c: CharacterV2) => c.builder && rogueArchetype(c.builder) === "scout" && c.identity.level >= 9 ? 10 : 0;
  const fastMovement = (c: CharacterV2) => c.builder?.classKey === "barbarian" && c.identity.level >= 5 && !barbarianHeavyArmor(c) ? 10 : 0;
  const monkSpeed = (c: CharacterV2) => c.builder?.classKey === "monk" && !monkArmed(c) ? monkMovement(c.identity.level) : 0;
  const difference = monkSpeed(next)-monkSpeed(previous) + fastMovement(next)-fastMovement(previous) + scoutSpeed(next)-scoutSpeed(previous) + projectHeavyArmorSpeedPenalty(previous) - projectHeavyArmorSpeedPenalty(next) + (hasBuilderFeat(next, "mobile") ? 10 : 0) - (hasBuilderFeat(previous, "mobile") ? 10 : 0) + (hasBuilderFeat(next,"squat-nimbleness") ? 5 : 0) - (hasBuilderFeat(previous,"squat-nimbleness") ? 5 : 0) + stoneSpeed(next)-stoneSpeed(previous);
  const speed = next.combat.speed.match(/^(\d+(?:\.\d+)?)\s*(ft|pies)\b/i);
  let result = difference && speed ? next.combat.speed.replace(speed[1]!, String(Math.max(0, Number(speed[1]) + difference))) : next.combat.speed;
  const scoutDifference = scoutSpeed(next)-scoutSpeed(previous);
  if (scoutDifference) {
    result = result.replace(/((?:trepar|escalada|nadar|natación|climb(?:ing)?|swim(?:ming)?)\s*:?\s*)(\d+(?:\.\d+)?)(\s*(?:ft|pies))/gi,(_,label: string,value: string,unit: string) => `${label}${Math.max(0,Number(value)+scoutDifference)}${unit}`);
    result = result.replace(/(\d+(?:\.\d+)?)(\s*(?:ft|pies)\s*\((?:trepar|escalada|nadar|natación|climb(?:ing)?|swim(?:ming)?)\))/gi,(_,value: string,unit: string) => `${Math.max(0,Number(value)+scoutDifference)}${unit}`);
  }
  const additionalSpeed = fastMovement(next)-fastMovement(previous) + (next.builder?.classKey === "barbarian" ? (hasBuilderFeat(next,"mobile") ? 10 : 0)-(hasBuilderFeat(previous,"mobile") ? 10 : 0) : 0);
  if (additionalSpeed) {
    result = result.replace(/((?:trepar|escalada|nadar|natación|volar|vuelo|climb(?:ing)?|swim(?:ming)?|fly(?:ing)?)\s*:?\s*)(\d+(?:\.\d+)?)(\s*(?:ft|pies))/gi,(_,label: string,value: string,unit: string) => `${label}${Math.max(0,Number(value)+additionalSpeed)}${unit}`);
  }
  if (next.builder?.classKey === "barbarian") {
    result = result.replace(/;?\s*nadar \d+ ft \(Alma de Tormenta\)/g,"").trim();
    if (next.identity.level >= 6 && barbarianStorm(next.builder) === "sea") result += `; nadar ${30+fastMovement(next)+(hasBuilderFeat(next,"mobile") ? 10 : 0)} ft (Alma de Tormenta)`;
  }
  return result;
}

function bardHalf(character: CharacterV2) { return character.builder?.classKey === "bard" && character.identity.level >= 2 ? Math.floor(proficiencyBonus(character.identity.level)/2) : 0; }

export function projectAbilityCheckModifier(character: CharacterV2, ability: AbilityKey, proficiencyRank: 0 | 1 | 2 = 0): number {
  const athlete = championAthlete(character) && ["strength", "dexterity", "constitution"].includes(ability);
  return abilityModifier(projectAbilityScore(character, ability)) + (proficiencyRank ? proficiencyRank * proficiencyBonus(character.identity.level) : athlete ? Math.ceil(proficiencyBonus(character.identity.level) / 2) : bardHalf(character)) + inventoryBonus(character, "skills", ["all"]);
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function inventoryBonusAmount(character: CharacterV2, bonus: InventoryBonus): number {
  return bonus.valueSource === null
    ? bonus.value
    : abilityModifier(character.abilities[bonus.valueSource]);
}

function activeInventoryBonuses(character: CharacterV2): InventoryBonus[] {
  return character.inventory
    .filter((item) => item.quantity > 0 && item.equipped && (!item.requiresAttunement || item.attuned) && !equipmentBearerIssue(character, item))
    .flatMap((item) => [
      ...item.bonuses,
      ...item.features
        .filter((feature) => feature.kind === "passive" || feature.active)
        .flatMap((feature) => feature.bonuses),
    ]);
}

function inventoryBonus(character: CharacterV2, category: string, keys: readonly string[]): number {
  const normalizedCategory = normalizedKey(category);
  const normalizedKeys = new Set(["all", ...keys.map(normalizedKey)]);
  return activeInventoryBonuses(character)
    .filter((bonus) => normalizedKey(bonus.category) === normalizedCategory && normalizedKeys.has(normalizedKey(bonus.key)))
    .reduce((total, bonus) => total + inventoryBonusAmount(character, bonus), 0);
}

function traitBonus(character: CharacterV2, category: string, keys: readonly string[]): number {
  const normalizedCategory = normalizedKey(category);
  const normalizedKeys = new Set(keys.map(normalizedKey));
  return character.traits
    .flatMap((group) => group.traits)
    .map((trait) => trait.adjustment)
    .filter((adjustment) =>
      adjustment !== null &&
      adjustment.applyToDerived &&
      normalizedKey(adjustment.category) === normalizedCategory &&
      (normalizedKey(adjustment.subcategory) === "all" || normalizedKeys.has(normalizedKey(adjustment.subcategory))),
    )
    .reduce((total, adjustment) => total + (adjustment?.value ?? 0), 0);
}

export function projectAdjustedRollMode(
  character: CharacterV2,
  category: string,
  keys: readonly string[],
  authored: RollMode,
  extraAdvantage = false,
): RollMode {
  const normalizedCategory = normalizedKey(category);
  const normalizedKeys = new Set(keys.map(normalizedKey));
  const adjustments = character.traits
    .flatMap((group) => group.traits)
    .map((trait) => trait.adjustment)
    .filter((adjustment) => adjustment !== null &&
      normalizedKey(adjustment.category) === normalizedCategory &&
      (normalizedKey(adjustment.subcategory) === "all" || normalizedKeys.has(normalizedKey(adjustment.subcategory))));
  const itemAdjustments = activeInventoryBonuses(character).filter((bonus) =>
    normalizedKey(bonus.category) === normalizedCategory &&
    (normalizedKey(bonus.key) === "all" || normalizedKeys.has(normalizedKey(bonus.key))));
  const conscious=character.combat.hitPoints.current>0&&!character.combat.conditions.some((p)=>["unconscious","dead"].includes(p.key));
  const protectedCondition=(key:string)=>character.builder?.classKey==="monk"&&character.identity.level>=10&&key==="poisoned" || character.builder?.classKey==="paladin"&&conscious&&(key==="frightened"&&character.identity.level>=10 || key==="charmed"&&character.identity.level>=7&&paladinOath(character.builder)==="devotion");
  const conditionKeys = new Set(character.combat.conditions.filter((p) => (!barbarianMindlessRage(character) || !["frightened","charmed"].includes(p.key))&&!protectedCondition(p.key)).map((condition) => normalizedKey(condition.key)));
  if (character.spellcasting.monk?.effects.some((e) => ["empty-body","cloak"].includes(e.key))) conditionKeys.add("invisible");
  const categoryKey = normalizedKey(category);
  const keySet = new Set(keys.map(normalizedKey));
  const attacks = categoryKey === "combatstats";
  const skills = categoryKey === "skills";
  const saves = categoryKey === "saves";
  const strengthRoll = keySet.has("strength") || keySet.has("str") || Object.entries(SKILL_DEFINITIONS).some(([key,d]) => d.ability === "strength" && (keySet.has(normalizedKey(key)) || keySet.has(normalizedKey(d.label))));
  const dexterityRoll = keySet.has("dexterity") || keySet.has("dex");
  const conditionalAdvantage =
    (skills && keySet.has("initiative") && character.builder?.classKey === "barbarian" && character.identity.level >= 7) ||
    (skills && keySet.has("initiative") && character.builder !== null && rogueArchetype(character.builder) === "scout" && character.identity.level >= 13) ||
    (attacks && conditionKeys.has("invisible")) ||
    ((skills || saves) && strengthRoll && (character.builder?.classKey === "barbarian" ? barbarianRageBenefits(character) : conditionKeys.has("raging"))) ||
    (saves && dexterityRoll && conditionKeys.has("haste"));
  const conditionalDisadvantage =
    (skills && keySet.has("stealth") && character.inventory.some((item) => item.equipped && item.armor?.stealthDisadvantage && !(item.armor.armorCategory.toLowerCase() === "medium" && hasBuilderFeat(character, "medium-armor-master")))) ||
    (skills && (character.combat.exhaustion >= 1 || conditionKeys.has("poisoned") || conditionKeys.has("frightened"))) ||
    (saves && character.combat.exhaustion >= 3) ||
    (saves && dexterityRoll && conditionKeys.has("restrained")) ||
    (attacks && (character.combat.exhaustion >= 3 || ["blinded", "frightened", "poisoned", "prone", "restrained"].some((key) => conditionKeys.has(key))));
  const advantage = extraAdvantage || authored === "advantage" || conditionalAdvantage ||
    adjustments.some((adjustment) => adjustment?.advantage) || itemAdjustments.some((bonus) => bonus.advantage);
  const disadvantage = authored === "disadvantage" || conditionalDisadvantage ||
    adjustments.some((adjustment) => adjustment?.disadvantage) || itemAdjustments.some((bonus) => bonus.disadvantage);
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

export function projectAbilityScore(character: CharacterV2, ability: AbilityKey): number {
  const short: Record<AbilityKey, string> = {
    strength: "STR", dexterity: "DEX", constitution: "CON",
    intelligence: "INT", wisdom: "WIS", charisma: "CHA",
  };
  let score = character.abilities[ability] + traitBonus(character, "attributes", [ability, short[ability]]) + inventoryBonus(character, "attributes", [ability, short[ability]]);
  const effects = character.inventory.filter((item) => item.quantity > 0 && item.equipped && (!item.requiresAttunement || item.attuned)).flatMap((item) => (inventoryEquipmentDefinition(item)?.capabilities ?? []).filter((cap) => cap.activation === "passive").flatMap((cap) => cap.effects)).filter((effect) => effect.kind === "bonus" && effect.target === ability);
  for (const effect of effects) if (effect.kind === "bonus" && effect.operation === "add") {
    const next = score + effect.value;
    score = /(?:máximo|maximo|encima de)(?: de)? 20/i.test(effect.condition) ? Math.max(score, Math.min(20, next)) : next;
  }
  for (const effect of effects) if (effect.kind === "bonus" && effect.operation === "set") score = effect.value;
  for (const effect of effects) if (effect.kind === "bonus" && effect.operation === "minimum") score = Math.max(score, effect.value);
  return score;
}

function projectedAbilityModifier(character: CharacterV2, ability: AbilityKey): number {
  return abilityModifier(projectAbilityScore(character, ability));
}

export interface CharacterStatisticsProjection {
  abilityScores: Record<AbilityKey, number>;
  abilityModifiers: Record<AbilityKey, number>;
  proficiencyBonus: number;
  initiativeModifier: number;
  skills: Record<SkillKey, number>;
  savingThrows: Record<SaveKey, number>;
  passives: {
    perception: number;
    investigation: number;
    insight: number;
  };
}

export function projectCharacterStatistics(
  character: CharacterV2,
): CharacterStatisticsProjection {
  const abilityScores = Object.fromEntries(
    Object.keys(character.abilities).map((ability) => [
      ability, projectAbilityScore(character, ability as AbilityKey),
    ]),
  ) as Record<AbilityKey, number>;
  const abilityModifiers = Object.fromEntries(
    Object.entries(abilityScores).map(([ability, score]) => [
      ability,
      abilityModifier(score),
    ]),
  ) as Record<AbilityKey, number>;
  const proficiency = proficiencyBonus(character.identity.level);
  const skills = Object.fromEntries(
    Object.entries(SKILL_DEFINITIONS).map(([key, definition]) => {
      const state = character.checks.skills[key as SkillKey];
      return [
        key,
        Math.floor(
          abilityModifiers[definition.ability] +
            (championAthlete(character) && state.proficiency === 0 && ["strength", "dexterity", "constitution"].includes(definition.ability) ? Math.ceil(proficiency / 2) : 0) +
            (state.proficiency === 0 ? bardHalf(character) : 0) + proficiency * state.proficiency + (key === "persuasion" && character.builder?.classKey === "fighter" && character.builder.levels.find((s) => s.level === 3)?.subclass === "samurai" && character.identity.level >= 7 ? abilityModifiers.wisdom : 0) +
            state.bonus + (key === "persuasion" && character.spellcasting.paladin?.effects.some((e) => e.key === "emissary-peace") ? 5 : 0) +
            traitBonus(character, "skills", [key, definition.label]) +
            inventoryBonus(character, "skills", [key, definition.label]),
        ),
      ];
    }),
  ) as Record<SkillKey, number>;
  const savingThrows = Object.fromEntries(
    Object.entries(character.checks.savingThrows).map(([key, state]) => [
      key,
      abilityModifiers[key as SaveKey] + proficiency * Math.max(state.proficiency,key === "constitution" && character.spellcasting.wizard?.stone?.bearer === "self" && character.spellcasting.wizard.stone.benefit === "constitution" ? 1 : 0) + state.bonus +
        traitBonus(character, "saves", [key, key.slice(0, 3)]) + warMagicDefense(character) + paladinAuraBonus(character) +
        inventoryBonus(character, "saves", [key, key.slice(0, 3)]),
    ]),
  ) as Record<SaveKey, number>;

  return {
    abilityScores,
    abilityModifiers,
    proficiencyBonus: proficiency,
    initiativeModifier:
      abilityModifiers.dexterity + (character.builder && rangerArchetype(character.builder) === "gloom-stalker" ? abilityModifiers.wisdom : 0) + (character.builder && rogueArchetype(character.builder) === "swashbuckler" ? abilityModifiers.charisma : 0) + (character.builder?.classKey === "wizard" && character.builder.levels.find((s) => s.level === 2)?.subclass === "war-magic" ? abilityModifiers.intelligence : 0) + (championAthlete(character) ? Math.ceil(proficiency / 2) : bardHalf(character)) + (hasBuilderFeat(character, "alert") ? 5 : 0) + character.checks.initiative.bonus +
        traitBonus(character, "skills", ["Initiative"]) + inventoryBonus(character, "skills", ["Initiative"]),
    skills,
    savingThrows,
    passives: {
      perception:
        10 + skills.perception + character.checks.passiveBonuses.perception + (hasBuilderFeat(character, "observant") ? 5 : 0) +
          traitBonus(character, "senses", ["PassivePerception"]) +
          inventoryBonus(character, "senses", ["PassivePerception"]),
      investigation:
        10 + skills.investigation + character.checks.passiveBonuses.investigation + (hasBuilderFeat(character, "observant") ? 5 : 0) +
          traitBonus(character, "senses", ["PassiveInvestigation"]) +
          inventoryBonus(character, "senses", ["PassiveInvestigation"]),
      insight: 10 + skills.insight + character.checks.passiveBonuses.insight +
        traitBonus(character, "senses", ["PassiveInsight"]) + inventoryBonus(character, "senses", ["PassiveInsight"]),
    },
  };
}

export function projectActionAttackModifier(
  character: CharacterV2,
  action: CharacterActionV2,
): number {
  const ability = action.ability === null
    ? 0
    : projectedAbilityModifier(character, action.ability);
  const proficiency = action.proficient
    ? proficiencyBonus(character.identity.level)
    : 0;
  const ranged = normalizedKey(action.reach).includes("ranged") || normalizedKey(action.weaponType).includes("ranged");
  const keys = ["toHitBonus", "AttackandDamage", ranged ? "RangedAttackRolls" : "MeleeAttackRolls"];
  const item = character.inventory.find((entry) => entry.id === action.inventoryItemId);
  const archery = hasBuilderStyle(character, "archery") && (item?.weapon?.range.includes("ranged") || normalizedKey(action.weaponType).includes("ranged")) ? 2 : 0;
  const martial = character.spellcasting.monk?.effects.find((e) => e.key === "sharpen" && e.target === action.inventoryItemId)?.amount ?? 0;
  const sacred = character.spellcasting.paladin?.effects.some((e) => e.key === "sacred-weapon" && e.target === action.inventoryItemId) ? Math.max(1,projectedAbilityModifier(character,"charisma")) : 0;
  const definition = item && inventoryEquipmentDefinition(item);
  const unavailableMagicBonus = definition?.origin === "official" && item?.requiresAttunement && !item.attuned && action.attackBonus === item.weapon?.attackBonus ? definition.weapon?.attackBonus ?? 0 : 0;
  return ability + proficiency + action.attackBonus - unavailableMagicBonus + archery + martial + sacred + inventoryBonus(character, "combatStats", keys);
}

export function projectActionDamageBonus(character: CharacterV2, action: CharacterActionV2): number {
  const ranged = normalizedKey(action.reach).includes("ranged") || normalizedKey(action.weaponType).includes("ranged");
  const weapon = character.inventory.find((item) => item.id === action.inventoryItemId)?.weapon;
  // Linked weapon actions already include the base ability modifier in damageBonus.
  // Apply only the derived adjustment, preserving authored damage and weapon bonuses.
  const abilityAdjustment = weapon && action.ability !== null
    ? projectedAbilityModifier(character, action.ability) - abilityModifier(character.abilities[action.ability])
    : 0;
  const item = character.inventory.find((entry) => entry.id === action.inventoryItemId);
  const equippedWeapons = character.inventory.filter((entry) => entry.equipped && entry.weapon);
  const dueling = hasBuilderStyle(character, "dueling") && item?.equipped && item.weapon?.range === "melee" && !item.properties.includes("two-handed") && !item.properties.includes("special") && equippedWeapons.length === 1 && (!item.weapon.versatileDamageExpression || action.damageExpression !== item.weapon.versatileDamageExpression) ? 2 : 0;
  const rage = barbarianRageBenefits(character) && action.ability === "strength" && barbarianMeleeAttack(character,action) ? barbarianRageDamage(character.identity.level) : 0;
  const martial = character.spellcasting.monk?.effects.find((e) => e.key === "sharpen" && e.target === action.inventoryItemId)?.amount ?? 0;
  const definition = item && inventoryEquipmentDefinition(item);
  const unavailableMagicBonus = definition?.origin === "official" && item?.requiresAttunement && !item.attuned && action.attackBonus === item.weapon?.attackBonus ? definition.weapon?.damageBonus ?? 0 : 0;
  return action.damageBonus - unavailableMagicBonus + abilityAdjustment + dueling + rage + martial + inventoryBonus(character, "combatStats", [
    "damageBonus", "AttackandDamage", ranged ? "RangedDamageRolls" : "MeleeDamageRolls",
  ]);
}

export interface InventoryProjection {
  totalWeight: number;
  carryingCapacity: number;
  overCapacity: boolean;
  attuned: number;
  maximumAttuned: number;
  calculatedArmorClass: number;
}

export function projectInventory(character: CharacterV2): InventoryProjection {
  const dexterity = projectedAbilityModifier(character, "dexterity");
  const equippedArmor = character.inventory.find(
    (item) => item.equipped && item.category === "armor" && item.armor !== null,
  );
  const baseArmorClass = equippedArmor?.armor === undefined || equippedArmor.armor === null
    ? Math.max(character.builder?.classKey === "monk" && !monkArmed(character) ? 10+projectedAbilityModifier(character,"wisdom") : 10,hasBuilderFeat(character,"dragon-hide") || character.builder && sorcererOrigin(character.builder) === "draconic" ? 13 : 10,character.builder?.classKey === "barbarian" ? 10+projectedAbilityModifier(character,"constitution") : 10) + dexterity
    : equippedArmor.armor.base + (
      equippedArmor.armor.dexterityBonus
        ? Math.min(
            dexterity,
            equippedArmor.armor.armorCategory.toLowerCase() === "medium" && hasBuilderFeat(character, "medium-armor-master") ? 3 : equippedArmor.armor.maximumDexterityBonus ?? dexterity,
          )
        : 0
    );
  const shieldBonus = character.inventory
    .filter((item) => item.equipped && item.category === "shield")
    .reduce((total, item) => total + (item.armor?.base ?? 2), 0);
  const carryWeightBonus = activeInventoryBonuses(character)
    .filter((bonus) => bonus.category === "combatStats" && bonus.key === "CarryWeightBonus")
    .reduce((total, bonus) => total + inventoryBonusAmount(character, bonus), 0);
  const totalWeight = character.inventory.reduce(
    (total, item) => total + item.unitWeight * item.quantity,
    0,
  );
  const adjustedStrength = projectAbilityScore(character, "strength");
  const carryingCapacity = (adjustedStrength * 15 + carryWeightBonus + traitBonus(character, "combatStats", ["CarryWeightBonus"])) * (character.builder && barbarianTotem(character.builder,6) === "bear" ? 2 : 1);
  const meleeWeapons = character.inventory.filter((item) => item.equipped && item.weapon?.range.toLowerCase() === "melee" && !item.properties.includes("two-handed") && !item.properties.includes("special"));
  return {
    totalWeight,
    carryingCapacity,
    overCapacity: totalWeight > carryingCapacity,
    attuned: character.inventory.filter((item) => item.attuned).length,
    maximumAttuned: 3,
    calculatedArmorClass: baseArmorClass + shieldBonus + legacyDefenseCorrection(character, !!equippedArmor) + (character.builder?.classKey === "monk" && !character.combat.conditions.some((p) => ["unconscious","incapacitated","paralyzed","stunned","petrified"].includes(p.key)) && character.spellcasting.monk?.effects.some((e) => e.key === "agile-parry") ? 2 : 0) + warMagicDefense(character) + (character.builder?.classKey === "cleric" && character.builder.creation.cleric.domain === "forge" && character.identity.level >= 6 && /heavy|pesada/i.test(equippedArmor?.armor?.armorCategory ?? "") ? 1 : 0) + (hasBuilderFeat(character, "dual-wielder") && meleeWeapons.length === 2 ? 1 : 0) + (equippedArmor && hasBuilderStyle(character, "defense") ? 1 : 0) + traitBonus(character, "combatStats", ["AC"]) +
      inventoryBonus(character, "combatStats", ["AC"]),
  };
}

export interface SpellcastingProjection {
  ability: SpellcastingAbility | null;
  attackModifier: number;
  saveDc: number;
}

function normalizedSpellcastingAbility(value: string | null): SpellcastingAbility | null {
  const normalized = value?.trim().toLowerCase();
  const map: Record<string, SpellcastingAbility> = {
    str: "strength", fue: "strength", strength: "strength",
    dex: "dexterity", des: "dexterity", dexterity: "dexterity",
    con: "constitution", constitution: "constitution",
    int: "intelligence", intelligence: "intelligence",
    wis: "wisdom", sab: "wisdom", wisdom: "wisdom",
    cha: "charisma", car: "charisma", charisma: "charisma",
  };
  return normalized === undefined ? null : map[normalized] ?? null;
}

export function projectSpellcasting(character: CharacterV2, spell?: CharacterSpellV2 | null): SpellcastingProjection {
  let fixedItemStats: { ability: SpellcastingAbility | null; saveDc: number | null; attackBonus: number | null } | undefined;
  if (spell?.casting?.kind === "item") {
    const match = /^inventory:(inv_[a-f0-9]{32}):(.+)$/.exec(spell.casting.source);
    const item = character.inventory.find((i) => i.id === match?.[1]);
    const stored = item?.rules?.storage?.spells.find((s) => `stored:${s.id}` === match?.[2]);
    const effect = item && inventoryEquipmentDefinition(item)?.capabilities.find((c) => c.id === match?.[2])?.effects.find((e) => e.kind === "spell");
    const fixed = stored ?? (effect?.kind === "spell" ? effect : null);
    fixedItemStats = fixed ?? undefined;
    if (fixed?.saveDc !== null && fixed?.saveDc !== undefined && fixed?.attackBonus !== null && fixed?.attackBonus !== undefined) return { ability: fixed.ability, saveDc: fixed.saveDc, attackModifier: fixed.attackBonus };
  }
  const ability = normalizedSpellcastingAbility(spell?.casting?.ability ?? character.spellcasting.ability);
  const modifier = ability === null ? 0 : projectedAbilityModifier(character, ability);
  const activeBonuses = activeInventoryBonuses(character)
    .filter((bonus) => bonus.category === "combatStats");
  const sharedBonus = activeBonuses
    .filter((bonus) => bonus.key === "SpellAttackandSave")
    .reduce((total, bonus) => total + inventoryBonusAmount(character, bonus), 0);
  const attackBonus = activeBonuses
    .filter((bonus) => bonus.key === "SpellAttack" || bonus.key === "SpellAttackModifier")
    .reduce((total, bonus) => total + inventoryBonusAmount(character, bonus), 0);
  const saveBonus = activeBonuses
    .filter((bonus) => bonus.key === "SpellSaveDC")
    .reduce((total, bonus) => total + inventoryBonusAmount(character, bonus), 0);
  const bardClass = character.builder?.classKey === "bard" || !character.builder && /^(bardo|bard)$/i.test(character.identity.className.trim());
  const bardSpell = !spell && bardClass || spell?.casting?.source === "builder:bard" ||
    !!spell && !spell.casting && !character.builder && /^(bardo|bard)$/i.test(character.identity.className.trim()) &&
    spell.definition?.classes.some((name) => /^(bardo|bard)$/i.test(name)) === true;
  const scopedEffects = bardSpell ? character.inventory
    .filter((item) => item.quantity > 0 && item.equipped && (!item.requiresAttunement || item.attuned) && !equipmentBearerIssue(character, item))
    .flatMap((item) => inventoryEquipmentDefinition(item)?.capabilities.filter((cap) => cap.activation === "passive").flatMap((cap) => cap.effects) ?? []) : [];
  const scopedBonus = (target: string) => scopedEffects.reduce((total, effect) => total + (effect.kind === "bonus" && effect.operation === "add" && effect.target === target ? effect.value : 0), 0);
  const proficiency = proficiencyBonus(character.identity.level);
  return {
    ability,
    attackModifier: fixedItemStats?.attackBonus ?? (modifier + proficiency + sharedBonus + attackBonus + scopedBonus("bard-spell-attack") + character.spellcasting.attackBonus +
      traitBonus(character, "combatStats", ["SpellAttack", "SpellAttackModifier", "SpellAttackandSave"])),
    saveDc: fixedItemStats?.saveDc ?? (8 + modifier + proficiency + sharedBonus + saveBonus + scopedBonus("bard-spell-save-dc") + character.spellcasting.saveDcBonus +
      traitBonus(character, "combatStats", ["SpellSaveDC", "SpellAttackandSave"])),
  };
}

function increaseMatchingDice(base: string, increment: string, times: number): string {
  if (times <= 0) return base;
  const match = increment.trim().match(/^(\d*)d(\d+)$/i);
  if (!match) return base;
  const amount = Number(match[1] || 1) * times;
  const sides = match[2]!;
  let replaced = false;
  const result = base.replace(new RegExp(`(\\d*)d${sides}\\b`, "i"), (_whole, count: string) => {
    replaced = true;
    return `${Number(count || 1) + amount}d${sides}`;
  });
  return replaced ? result : `${base}${base ? "+" : ""}${amount}d${sides}`;
}

export function projectSpellDamageExpression(
  character: CharacterV2,
  spell: CharacterSpellV2,
  slotLevel = spell.level,
): string {
  const definition = spell.definition;
  if (!definition) return "";
  let expression = definition.damageExpression;
  if (spell.level === 0 && spell.casting?.key !== "eldritch-blast" && definition.upcastDamageExpression) {
    const steps = character.identity.level >= 17
      ? 3
      : character.identity.level >= 11
        ? 2
        : character.identity.level >= 5 ? 1 : 0;
    expression = increaseMatchingDice(expression, definition.upcastDamageExpression, steps);
  } else if (slotLevel > spell.level && definition.upcastDamageExpression) {
    expression = increaseMatchingDice(
      expression,
      definition.upcastDamageExpression,
      slotLevel - spell.level,
    );
  }
  if (definition.addAbilityModifier) {
    const ability = projectSpellcasting(character, spell).ability;
    const source = spell.casting?.kind === "item" ? /^inventory:(inv_[a-f0-9]{32}):stored:(.+)$/.exec(spell.casting.source) : null;
    const stored = source ? character.inventory.find((i) => i.id === source[1])?.rules?.storage?.spells.find((s) => s.id === source[2]) : null;
    const modifier = stored?.abilityModifier ?? (ability === null ? 0 : projectedAbilityModifier(character, ability));
    if (modifier !== 0) expression += modifier > 0 ? `+${modifier}` : String(modifier);
  }
  if (expression && wizardSpellSource(character,spell) && character.identity.level >= 10 && character.builder?.levels.find((s) => s.level === 2)?.subclass === "evocation" && definition.school === "Evocación") {
    const modifier = Math.max(0,projectedAbilityModifier(character,"intelligence"));
    if (modifier) expression += `+${modifier}`;
  }
  if (expression && character.builder?.classKey === "cleric" && spell.casting?.kind === "cleric" && spell.level === 0 && character.identity.level >= 8 && ["knowledge","light","grave"].includes(character.builder.creation.cleric.domain ?? "")) { const modifier = projectedAbilityModifier(character,"wisdom"); if (modifier) expression += modifier > 0 ? `+${modifier}` : String(modifier); }
  if (expression && character.builder?.classKey === "warlock" && spell.casting?.key === "eldritch-blast" && replayWarlockChoices(character.builder).invocations.includes("agonizing-blast")) { const modifier = projectedAbilityModifier(character,"charisma"); if (modifier) expression += modifier > 0 ? `+${modifier}` : String(modifier); }
  return expression;
}

export function projectActionRollMode(character: CharacterV2,action: CharacterActionV2) {
  const reckless = character.builder?.classKey === "barbarian" && character.spellcasting.barbarian?.reckless === true && action.ability === "strength" && barbarianMeleeAttack(character,action);
  return projectAdjustedRollMode(character,"combatStats",[action.weaponType.toLowerCase().includes("ranged") ? "RangedAttackRolls" : "MeleeAttackRolls"],action.rollMode,reckless);
}
