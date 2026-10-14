import { phbFighterCreation } from "./phb-fighter-builder";
import { defaultClericCreation, CLERIC_SKILLS, KNOWLEDGE_SKILLS, NATURE_SKILLS, clericCantripCount } from "../../src/domain/character/cleric-catalog";
import type { ClericDomain } from "../../src/domain/character/cleric-model";
import { FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { classSpells } from "../../src/domain/character/phb-spells";
import { racialSkillGrants } from "../../src/domain/character/fighter-build-rules";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { SKILL_DEFINITIONS,type SkillKey } from "../../src/domain/character/character-checks";
import { LANGUAGES,TOOLS } from "../../src/domain/character/phb-character-options";
import { BUILDER_RACES } from "../../src/domain/character/fighter-builder-catalog";
import { replayClericChoices } from "../../src/domain/character/cleric-builder";
export function clericCreation(domain: ClericDomain = "life",race: FighterCreation["race"] = "human",background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background), defaults = defaultClericCreation("Clérigo de prueba");
  const c: FighterCreation = { ...base,classKey: "cleric",baseAbilities: defaults.baseAbilities,cleric: { ...defaults.cleric,domain,cantrips: ["sacred-flame","guidance","thaumaturgy"] } };
  c.skills = CLERIC_SKILLS.filter((s) => !c.background.skills.includes(s)).slice(0,2);
  if (c.origin.skills.length) c.origin.skills = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).filter((s) => ![...c.skills,...c.background.skills].includes(s) && !(domain === "knowledge" ? KNOWLEDGE_SKILLS : domain === "nature" ? NATURE_SKILLS : []).includes(s)).slice(0,c.origin.skills.length);
  const used = [...c.skills,...c.background.skills,...racialSkillGrants(c)];
  if (domain === "nature") { c.cleric.skills = NATURE_SKILLS.filter((s) => !used.includes(s as SkillKey)).slice(0,1); c.cleric.natureCantrip = "druidcraft"; }
  if (domain === "knowledge") {
    c.cleric.skills = KNOWLEDGE_SKILLS.filter((s) => !used.includes(s as SkillKey)).slice(0,2);
    const languages = [...BUILDER_RACES[race].languages,...c.languages,...c.background.languages];
    c.cleric.languages = LANGUAGES.filter((l) => !languages.includes(l)).slice(0,2);
  }
  if (domain === "forge") { if (c.dwarfTool === "smith") c.dwarfTool = c.background.tools.includes("Suministros de cervecero") ? "mason" : "brewer"; c.background.tools = c.background.tools.map((t) => t === "Herramientas de herrero" ? TOOLS.find((k) => !c.background.tools.includes(k) && k !== "Herramientas de herrero" && k !== "Suministros de cervecero" && k !== "Herramientas de albañil")! : t); }
  return c;
}
export function clericChoice(character: CharacterV2) {
  const level = character.identity.level+1;
  const choice = FighterLevelChoiceSchema.parse({ operationId: `build_${(200+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 5,abilityIncrease: null,subclass: null,additionalStyle: null,skipImprovement: [4,8,12,16,19].includes(level) });
  const known = replayClericChoices(character.builder!).cantrips;
  choice.cleric.cantrips = classSpells("cleric",0).filter((k) => !known.includes(k)).slice(0,clericCantripCount(level)-clericCantripCount(level-1));
  return choice;
}
