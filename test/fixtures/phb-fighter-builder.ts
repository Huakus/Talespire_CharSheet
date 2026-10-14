import { defaultFighterCreation, BACKGROUND_PRESETS, FIGHTER_SKILLS, FIGHTER_ASI_LEVELS, BUILDER_RACES, DWARF_TOOLS } from "../../src/domain/character/fighter-builder-catalog";
import { FighterLevelChoiceSchema, FeatChoiceSchema, type FighterCreation, type FighterSubclass } from "../../src/domain/character/character-builder-model";
import { LANGUAGES, ARTISAN_TOOLS } from "../../src/domain/character/phb-character-options";
import { replayFighterChoices, builderFeats, racialSkillGrants } from "../../src/domain/character/fighter-build-rules";
import { fighterSubclass, MANEUVERS, EK_PROGRESSION } from "../../src/domain/character/phb-fighter-choices";
import { PHB_SPELLS, classSpells } from "../../src/domain/character/phb-spells";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { SKILL_DEFINITIONS, type SkillKey } from "../../src/domain/character/character-checks";
import { ARCANE_SHOTS,XGE_FIGHTER_SKILLS } from "../../src/domain/character/xanathar-fighter";
export function phbFighterCreation(race: FighterCreation["race"] = "human", background: FighterCreation["background"]["equipment"] = "acolyte"): FighterCreation {
  const creation = defaultFighterCreation("PHB fighter");
  creation.race = race;
  creation.background = structuredClone(BACKGROUND_PRESETS[background]);
  creation.languages = ["human", "human-variant", "high-elf", "half-elf"].includes(race) ? ["Goblin"] : [];
  creation.dwarfTool = race.includes("dwarf") ? "smith" : null;
  creation.origin = { abilities: ["human-variant", "half-elf"].includes(race) ? ["strength", "dexterity"] : [], skills: [], cantrip: race === "high-elf" ? "fire-bolt" : "", ancestry: race === "dragonborn" ? "red" : null };
  if (race === "human-variant") creation.initialFeat = FeatChoiceSchema.parse({ key: "alert" });
  const languageCount = creation.background.languages.length;
  creation.background.languages = LANGUAGES.filter((lang) => ![...BUILDER_RACES[race].languages, ...creation.languages].includes(lang)).slice(0,languageCount);
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf", "wood-elf", "drow"].includes(race) ? "perception" : null;
  creation.skills = FIGHTER_SKILLS.filter((skill) => !creation.background.skills.includes(skill) && skill !== fixed).slice(0,2);
  const used = [...creation.skills, ...creation.background.skills];
  if (fixed && used.includes(fixed)) creation.racialSkillReplacement = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).find((key) => !used.includes(key))!;
  const originCount = race === "half-elf" ? 2 : race === "human-variant" ? 1 : 0;
  creation.origin.skills = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).filter((key) => ![...used, ...racialSkillGrants(creation)].includes(key)).slice(0,originCount);
  if (creation.dwarfTool && creation.background.tools.includes(DWARF_TOOLS[creation.dwarfTool])) creation.dwarfTool = (Object.keys(DWARF_TOOLS) as Array<NonNullable<FighterCreation["dwarfTool"]>>).find((key) => !creation.background.tools.includes(DWARF_TOOLS[key]))!;
  return creation;
}
export function completeFighterChoice(character: CharacterV2, selected: FighterSubclass = "champion") {
  const level = character.identity.level+1, state = character.builder!, subclass = level === 3 ? selected : fighterSubclass(state);
  const choice = FighterLevelChoiceSchema.parse({ operationId: `build_${level.toString(16).padStart(32,"0")}`, level, hpMethod: "fixed", hpBase: 6, abilityIncrease: null, subclass: level === 3 ? selected : null, additionalStyle: subclass === "champion" && level === 10 ? "archery" : null });
  if (FIGHTER_ASI_LEVELS.includes(level)) {
    const key = Object.keys(character.abilities).find((key) => character.abilities[key as keyof CharacterV2["abilities"]] <= 18)! as keyof CharacterV2["abilities"];
    choice.abilityIncrease = { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 };
    choice.abilityIncrease[key] = 2;
  }
  const replay = replayFighterChoices(state);
  if (subclass && subclass in XGE_FIGHTER_SKILLS) {
    if (level===3) { choice.xanathar.skill = XGE_FIGHTER_SKILLS[subclass as keyof typeof XGE_FIGHTER_SKILLS].find((s) => character.checks.skills[s as SkillKey].proficiency===0)!; if (subclass === "arcane-archer") choice.xanathar.cantrip = "prestidigitation"; }
    if (subclass === "arcane-archer") choice.xanathar.shots = Object.keys(ARCANE_SHOTS).filter((k) => !state.levels.some((s) => s.xanathar.shots.includes(k))).slice(0,level===3 ? 2 : [7,10,15,18].includes(level) ? 1 : 0);
  }
  if (subclass === "battle-master") {
    const count = level === 3 ? 3 : [7,10,15].includes(level) ? 2 : 0;
    choice.maneuvers = Object.keys(MANEUVERS).filter((key) => ![...replay.maneuvers, ...builderFeats(state).flatMap(({ feat }) => feat.maneuvers)].includes(key)).slice(0,count);
    if (level === 3) choice.artisanTool = ARTISAN_TOOLS.find((tool) => !character.proficiencies.tools.includes(tool))!;
  }
  if (subclass === "eldritch-knight") {
    const table = EK_PROGRESSION[level]!, old = EK_PROGRESSION[level-1];
    const max = table.slots.reduce((n, count, i) => count ? i+1 : n, 0), learned = table.known - (old?.known ?? 0);
    choice.magic.cantrips = classSpells("wizard", 0).filter((key) => !replay.cantrips.includes(key)).slice(0, table.cantrips-(old?.cantrips ?? 0));
    for (let i=0; i<learned; i++) {
      const unrestricted = [3,8,14,20].includes(level) && i === learned-1;
      const key = classSpells("wizard", 1, max).find((key) => ![...replay.spells, ...choice.magic.learn].some((s) => s.key === key) && (unrestricted || ["Abjuración", "Evocación"].includes(PHB_SPELLS[key]!.school)))!;
      choice.magic.learn.push({ key, unrestricted });
    }
  }
  return choice;
}
