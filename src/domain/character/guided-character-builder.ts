import { createGuidedMartial,advanceGuidedMartial,validateMartialCreation } from "./martial-builder";
import { createGuidedSorcerer,advanceGuidedSorcerer,validateSorcererCreation } from "./sorcerer-builder";
import { createGuidedRanger,advanceGuidedRanger,validateRangerCreation } from "./ranger-builder";
import { createGuidedDruid,advanceGuidedDruid,validateDruidCreation } from "./druid-builder";
import { createGuidedBard,advanceGuidedBard,validateBardCreation } from "./bard-builder";
import { createGuidedBarbarian,advanceGuidedBarbarian,validateBarbarianCreation } from "./barbarian-builder";
import { createGuidedRogue,advanceGuidedRogue,validateRogueCreation } from "./rogue-builder";
import { createGuidedCleric, advanceGuidedCleric, validateClericCreation } from "./cleric-builder";
import type { CharacterV2 } from "./character-v2";
import type { FighterCreationInput, FighterLevelChoiceInput } from "./character-builder-model";
import { createGuidedFighter, advanceGuidedFighter, validateFighterCreation } from "./fighter-builder";
import { createGuidedWizard, advanceGuidedWizard, validateWizardCreation } from "./wizard-builder";
import { createGuidedWarlock,advanceGuidedWarlock,validateWarlockCreation } from "./warlock-builder";
import {abilityModifier,projectAbilityScore} from "./character-projection";

export async function advanceGuidedCharacter(character: CharacterV2, choice: FighterLevelChoiceInput, updatedAt: string): Promise<CharacterV2> {
  const result=await advanceClassCharacter(character,choice,updatedAt);
  if(result.identity.level===character.identity.level)return result;
  // Class tables use the builder's base Constitution. Equipment and earned book
  // benefits also contribute on the newly gained level, including minimum-score items.
  const extra=(c:CharacterV2)=>(abilityModifier(projectAbilityScore(c,"constitution"))-abilityModifier(c.abilities.constitution))*c.identity.level;
  const increase=extra(result)-extra(character);
  result.combat.hitPoints.maximum=Math.max(0,result.combat.hitPoints.maximum+increase);
  result.combat.hitPoints.current=Math.max(0,Math.min(result.combat.hitPoints.current,result.combat.hitPoints.maximum));
  return result;
}

export function validateGuidedCreation(input: FighterCreationInput) { return ["monk","paladin"].includes(input.classKey ?? "") ? validateMartialCreation(input) : input.classKey === "sorcerer" ? validateSorcererCreation(input) : input.classKey === "ranger" ? validateRangerCreation(input) : input.classKey === "druid" ? validateDruidCreation(input) : input.classKey === "bard" ? validateBardCreation(input) : input.classKey === "barbarian" ? validateBarbarianCreation(input) : input.classKey === "rogue" ? validateRogueCreation(input) : input.classKey === "cleric" ? validateClericCreation(input) : input.classKey === "wizard" ? validateWizardCreation(input) : input.classKey === "warlock" ? validateWarlockCreation(input) : validateFighterCreation(input); }
export function buildGuidedCharacter(id: string, operationId: string, input: FighterCreationInput, createdAt: string, initialLevels: FighterLevelChoiceInput[] = []) { return ["monk","paladin"].includes(input.classKey ?? "") ? createGuidedMartial(id,operationId,input,createdAt,initialLevels) : input.classKey === "sorcerer" ? createGuidedSorcerer(id,operationId,input,createdAt,initialLevels) : input.classKey === "ranger" ? createGuidedRanger(id,operationId,input,createdAt,initialLevels) : input.classKey === "druid" ? createGuidedDruid(id,operationId,input,createdAt,initialLevels) : input.classKey === "bard" ? createGuidedBard(id,operationId,input,createdAt,initialLevels) : input.classKey === "barbarian" ? createGuidedBarbarian(id,operationId,input,createdAt,initialLevels) : input.classKey === "rogue" ? createGuidedRogue(id,operationId,input,createdAt,initialLevels) : input.classKey === "cleric" ? createGuidedCleric(id,operationId,input,createdAt,initialLevels) : input.classKey === "wizard" ? createGuidedWizard(id,operationId,input,createdAt,initialLevels) : input.classKey === "warlock" ? createGuidedWarlock(id,operationId,input,createdAt,initialLevels) : createGuidedFighter(id,operationId,input,createdAt,initialLevels); }
function advanceClassCharacter(character: CharacterV2, choice: FighterLevelChoiceInput, updatedAt: string) { return ["monk","paladin"].includes(character.builder?.classKey ?? "") ? advanceGuidedMartial(character,choice,updatedAt) : character.builder?.classKey === "sorcerer" ? advanceGuidedSorcerer(character,choice,updatedAt) : character.builder?.classKey === "ranger" ? advanceGuidedRanger(character,choice,updatedAt) : character.builder?.classKey === "druid" ? advanceGuidedDruid(character,choice,updatedAt) : character.builder?.classKey === "bard" ? advanceGuidedBard(character,choice,updatedAt) : character.builder?.classKey === "barbarian" ? advanceGuidedBarbarian(character,choice,updatedAt) : character.builder?.classKey === "rogue" ? advanceGuidedRogue(character,choice,updatedAt) : character.builder?.classKey === "cleric" ? advanceGuidedCleric(character,choice,updatedAt) : character.builder?.classKey === "wizard" ? advanceGuidedWizard(character,choice,updatedAt) : character.builder?.classKey === "warlock" ? advanceGuidedWarlock(character,choice,updatedAt) : advanceGuidedFighter(character,choice,updatedAt); }
