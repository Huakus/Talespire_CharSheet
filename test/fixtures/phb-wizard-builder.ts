import { phbFighterCreation } from "./phb-fighter-builder";
import { FighterLevelChoiceSchema, type FighterCreation, type WizardSchool } from "../../src/domain/character/character-builder-model";
import { WIZARD_ASI_LEVELS, WIZARD_SKILLS, WIZARD_SLOTS, wizardSchool, wizardCantripCount, defaultWizardCreation } from "../../src/domain/character/wizard-catalog";
import { PHB_SPELLS, classSpells } from "../../src/domain/character/phb-spells";
import { replayWizardChoices } from "../../src/domain/character/wizard-builder";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { SKILL_DEFINITIONS, type SkillKey } from "../../src/domain/character/character-checks";
export function phbWizardCreation(race: FighterCreation["race"] = "human", background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background), defaults = defaultWizardCreation("PHB wizard");
  const creation = { ...base,classKey: "wizard" as const,name: "PHB wizard",baseAbilities: defaults.baseAbilities,equipment: defaults.equipment,wizard: { ...defaults.wizard,cantrips: ["fire-bolt","mage-hand","minor-illusion"],learn: ["mage-armor","shield","magic-missile","detect-magic","find-familiar","sleep"] } };
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf","wood-elf","drow"].includes(race) ? "perception" : null;
  creation.skills = WIZARD_SKILLS.filter((s) => !creation.background.skills.includes(s)).slice(0,2);
  const used = [...creation.skills,...creation.background.skills];
  if (creation.origin.skills.length) creation.origin.skills = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).filter((s) => !used.includes(s) && s !== fixed).slice(0,creation.origin.skills.length);
  if (creation.racialSkillReplacement && used.includes(creation.racialSkillReplacement)) creation.racialSkillReplacement = "stealth";
  return creation;
}
export function completeWizardChoice(character: CharacterV2, school: WizardSchool = "evocation") {
  const level = character.identity.level+1, state = character.builder!, replay = replayWizardChoices(state,character.spellcasting.wizard?.copied);
  const choice = FighterLevelChoiceSchema.parse({ operationId: `build_${(100+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 4,subclass: level === 2 ? school : null,abilityIncrease: null,additionalStyle: null });
  if (WIZARD_ASI_LEVELS.includes(level)) {
    const key = Object.keys(character.abilities).find((key) => character.abilities[key as keyof CharacterV2["abilities"]] <= 18)! as keyof CharacterV2["abilities"];
    choice.abilityIncrease = { strength: 0,dexterity: 0,constitution: 0,intelligence: 0,wisdom: 0,charisma: 0 }; choice.abilityIncrease[key] = 2;
  }
  choice.wizard.learn = classSpells("wizard",1,WIZARD_SLOTS[level]!.length).filter((key) => !replay.book.includes(key)).slice(0,2);
  choice.wizard.cantrips = classSpells("wizard",0).filter((key) => !replay.cantrips.includes(key)).slice(0,wizardCantripCount(level)-wizardCantripCount(level-1));
  if (level === 2 && school === "illusion") choice.wizard.bonusCantrip = classSpells("wizard",0).find((key) => ![...replay.cantrips,state.creation.origin.cantrip,...(state.creation.initialFeat?.spells ?? [])].includes(key))!;
  const book = [...replay.book,...choice.wizard.learn];
  if (level === 18) choice.wizard.mastery = [1,2].map((n) => book.find((key) => PHB_SPELLS[key]!.level === n)!);
  if (level === 20) choice.wizard.signature = book.filter((key) => PHB_SPELLS[key]!.level === 3).slice(0,2);
  return choice;
}
