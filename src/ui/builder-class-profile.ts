import { RANGER_SKILLS,defaultRangerCreation } from "../domain/character/ranger-catalog";
import { DRUID_SKILLS,defaultDruidCreation } from "../domain/character/druid-catalog";
import { BARD_SKILLS,defaultBardCreation } from "../domain/character/bard-catalog";
import { BARBARIAN_SKILLS,BARBARIAN_ASI_LEVELS,defaultBarbarianCreation } from "../domain/character/barbarian-catalog";
import { ROGUE_SKILLS,ROGUE_ASI_LEVELS,defaultRogueCreation } from "../domain/character/rogue-catalog";
import { CLERIC_SKILLS, defaultClericCreation } from "../domain/character/cleric-catalog";
import type { FighterCreation } from "../domain/character/character-builder-model";
import { defaultFighterCreation,FIGHTER_SKILLS,FIGHTER_ASI_LEVELS } from "../domain/character/fighter-builder-catalog";
import { defaultWizardCreation,WIZARD_SKILLS,WIZARD_ASI_LEVELS } from "../domain/character/wizard-catalog";
import { defaultWarlockCreation,WARLOCK_SKILLS } from "../domain/character/warlock-catalog";
export const BUILDER_CLASS_NAMES = { ranger: "Explorador",druid: "Druida",bard: "Bardo",barbarian: "Bárbaro",rogue: "Pícaro",fighter: "Guerrero",wizard: "Mago",warlock: "Brujo",cleric: "Clérigo" };
export function builderClassProfile(key: FighterCreation["classKey"]) {
  return { ranger: { name: "Explorador",die: 10,fixedHp: 6,goldDice: 5,asi: WIZARD_ASI_LEVELS,ability: "dexterity" as const,skills: RANGER_SKILLS,defaults: defaultRangerCreation },druid: { name: "Druida",die: 8,fixedHp: 5,goldDice: 2,asi: WIZARD_ASI_LEVELS,ability: "wisdom" as const,skills: DRUID_SKILLS,defaults: defaultDruidCreation },bard: { name: "Bardo",die: 8,fixedHp: 5,goldDice: 5,asi: WIZARD_ASI_LEVELS,ability: "charisma" as const,skills: BARD_SKILLS,defaults: defaultBardCreation },barbarian: { name: "Bárbaro",die: 12,fixedHp: 7,goldDice: 2,asi: BARBARIAN_ASI_LEVELS,ability: "strength" as const,skills: BARBARIAN_SKILLS,defaults: defaultBarbarianCreation },rogue: { name: "Pícaro",die: 8,fixedHp: 5,goldDice: 4,asi: ROGUE_ASI_LEVELS,ability: "dexterity" as const,skills: ROGUE_SKILLS,defaults: defaultRogueCreation },cleric: { name: "Clérigo",die: 8,fixedHp: 5,goldDice: 5,asi: WIZARD_ASI_LEVELS,ability: "wisdom" as const,skills: CLERIC_SKILLS,defaults: defaultClericCreation },fighter: { name: "Guerrero",die: 10,fixedHp: 6,goldDice: 5,asi: FIGHTER_ASI_LEVELS,ability: "strength" as const,skills: FIGHTER_SKILLS,defaults: defaultFighterCreation },wizard: { name: "Mago",die: 6,fixedHp: 4,goldDice: 4,asi: WIZARD_ASI_LEVELS,ability: "intelligence" as const,skills: WIZARD_SKILLS,defaults: defaultWizardCreation },warlock: { name: "Brujo",die: 8,fixedHp: 5,goldDice: 4,asi: WIZARD_ASI_LEVELS,ability: "charisma" as const,skills: WARLOCK_SKILLS,defaults: defaultWarlockCreation } }[key];
}
