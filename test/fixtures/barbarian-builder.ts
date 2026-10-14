import { phbFighterCreation } from "./phb-fighter-builder";
import { defaultBarbarianCreation,BARBARIAN_SKILLS,BARBARIAN_ASI_LEVELS,barbarianPath } from "../../src/domain/character/barbarian-catalog";
import type { BarbarianPath,TotemAnimal,StormEnvironment } from "../../src/domain/character/barbarian-model";
import { FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { SKILL_DEFINITIONS,type SkillKey } from "../../src/domain/character/character-checks";
import { racialSkillGrants } from "../../src/domain/character/fighter-build-rules";
import { createGuidedBarbarian,advanceGuidedBarbarian } from "../../src/domain/character/barbarian-builder";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
export function barbarianCreation(race: FighterCreation["race"] = "human",background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background),defaults = defaultBarbarianCreation("Bárbaro de prueba");
  const c: FighterCreation = { ...base,classKey: "barbarian",baseAbilities: defaults.baseAbilities,equipment: { ...base.equipment,goldRoll: [2,2] } };
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf","wood-elf","drow"].includes(race) ? "perception" : null;
  c.skills = BARBARIAN_SKILLS.filter((s) => !c.background.skills.includes(s) && s !== fixed).slice(0,2);
  if (fixed && c.background.skills.includes(fixed)) c.racialSkillReplacement = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).find((s) => ![...c.skills,...c.background.skills].includes(s))!;
  const count = c.origin.skills.length;c.origin.skills = [];
  c.origin.skills = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).filter((s) => ![...c.skills,...c.background.skills,...racialSkillGrants(c)].includes(s)).slice(0,count);
  return c;
}
export function barbarianChoice(c: CharacterV2,selected: BarbarianPath = "berserker",options: { totem?: TotemAnimal;storm?: StormEnvironment;divineDamage?: "radiant"|"necrotic" } = {}) {
  const level = c.identity.level+1,path = level === 3 ? selected : barbarianPath(c.builder!);
  const choice = FighterLevelChoiceSchema.parse({ operationId: `build_${(400+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 7,abilityIncrease: null,subclass: null,additionalStyle: null,skipImprovement: BARBARIAN_ASI_LEVELS.includes(level) });
  if (level === 3) choice.barbarian.path = selected;
  if (path === "totem-warrior" && [3,6,14].includes(level)) choice.barbarian.totem = options.totem ?? "bear";
  if (path === "storm-herald" && (level === 3 || options.storm)) choice.barbarian.storm = options.storm ?? "sea";
  if (path === "zealot" && level === 3) choice.barbarian.divineDamage = options.divineDamage ?? "radiant";
  return choice;
}
export async function barbarianAt(level: number,path: BarbarianPath = "berserker",options: Parameters<typeof barbarianChoice>[2] = {}) {
  let c = await createGuidedBarbarian("chr_00000000000000000000000000000001","build_00000000000000000000000000000001",barbarianCreation(),"2026-10-14T16:00:00Z");
  while (c.identity.level < level) c = await advanceGuidedBarbarian(c,barbarianChoice(c,path,options),"2026-10-14T16:00:00Z");
  return c;
}
