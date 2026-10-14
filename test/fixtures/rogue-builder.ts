import { phbFighterCreation } from "./phb-fighter-builder";
import { defaultRogueCreation,ROGUE_SKILLS,ROGUE_ASI_LEVELS,THIEVES_TOOLS,THIEVES_EXPERTISE,rogueArchetype } from "../../src/domain/character/rogue-catalog";
import type { RogueArchetype } from "../../src/domain/character/rogue-model";
import { FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { SKILL_DEFINITIONS,type SkillKey } from "../../src/domain/character/character-checks";
import { racialSkillGrants } from "../../src/domain/character/fighter-build-rules";
import { createGuidedRogue,advanceGuidedRogue,replayRogueChoices,rogueKnownSkills,rogueKnownTools,rogueExpertise,rogueSpellAllowed } from "../../src/domain/character/rogue-builder";
import { BUILDER_RACES } from "../../src/domain/character/fighter-builder-catalog";
import { TOOLS,GAMES,LANGUAGES } from "../../src/domain/character/phb-character-options";
import { classSpells } from "../../src/domain/character/phb-spells";
import { EK_PROGRESSION } from "../../src/domain/character/phb-fighter-choices";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
export function rogueCreation(race: FighterCreation["race"] = "human",background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background), defaults = defaultRogueCreation("Pícaro de prueba");
  const c: FighterCreation = { ...base,classKey: "rogue",baseAbilities: defaults.baseAbilities,rogue: defaults.rogue,equipment: { ...base.equipment,goldRoll: [2,2,2,2] } };
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf","wood-elf","drow"].includes(race) ? "perception" : null;
  c.skills = ROGUE_SKILLS.filter((s) => !c.background.skills.includes(s) && s !== fixed).slice(0,4);
  if (fixed && c.background.skills.includes(fixed)) c.racialSkillReplacement = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).find((s) => ![...c.skills,...c.background.skills].includes(s))!;
  const count = c.origin.skills.length; c.origin.skills = [];
  c.origin.skills = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).filter((s) => ![...c.skills,...c.background.skills,...racialSkillGrants(c)].includes(s)).slice(0,count);
  c.rogue.expertise = [c.skills[0]!,THIEVES_EXPERTISE];
  c.background.tools = c.background.tools.map((t) => t === THIEVES_TOOLS ? TOOLS.find((k) => k !== THIEVES_TOOLS && !c.background.tools.includes(k) && !["Herramientas de herrero","Herramientas de hojalatero"].includes(k))! : t);
  return c;
}
export function rogueChoice(character: CharacterV2,selected: RogueArchetype = "thief") {
  const level = character.identity.level+1, state = character.builder!, archetype = level === 3 ? selected : rogueArchetype(state);
  const choice = FighterLevelChoiceSchema.parse({ operationId: `build_${(300+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 5,abilityIncrease: null,subclass: null,additionalStyle: null,skipImprovement: ROGUE_ASI_LEVELS.includes(level) });
  if (level === 3) choice.rogue.archetype = selected;
  if (level === 6) choice.rogue.expertise = [...rogueKnownSkills(state),THIEVES_EXPERTISE].filter((s) => !rogueExpertise(state).includes(s)).slice(0,2);
  if (level === 3 && (archetype === "assassin" || archetype === "mastermind")) {
    const known = rogueKnownTools(state), fixed = archetype === "assassin" ? ["Kit de disfraz","Kit de venenos"] : ["Kit de disfraz","Kit de falsificación"];
    for (const t of fixed) choice.rogue.tools.push(known.includes(t) ? TOOLS.find((k) => ![...known,...fixed,...choice.rogue.tools].includes(k))! : t);
    if (archetype === "mastermind") {
      choice.rogue.tools.push(GAMES.find((k) => !known.includes(k))!);
      choice.rogue.languages = LANGUAGES.filter((l) => ![...BUILDER_RACES[state.creation.race].languages,...character.proficiencies.languages].includes(l)).slice(0,2);
    }
  }
  if (archetype === "arcane-trickster") {
    const replay = replayRogueChoices(state), table = EK_PROGRESSION[level]!, before = EK_PROGRESSION[level-1], max = table.slots.filter(Boolean).length, known = character.spellcasting.spells.map((s) => s.casting?.key);
    choice.rogue.cantrips = classSpells("wizard",0).filter((k) => k !== "mage-hand" && !known.includes(k)).slice(0,level === 3 ? 2 : level === 10 ? 1 : 0);
    const quota = table.known-(before?.known ?? 0);
    for (let i=0;i<quota;i++) {
      const unrestricted = [3,8,14,20].includes(level) && i === quota-1;
      const key = classSpells("wizard",1,max).find((k) => rogueSpellAllowed(k,max,unrestricted) && ![...replay.spells,...choice.rogue.learn].some((s) => s.key === k) && !known.includes(k))!;
      choice.rogue.learn.push({ key,unrestricted });
    }
  }
  return choice;
}

const id = "chr_00000000000000000000000000000001", op = "build_00000000000000000000000000000001", at = "2026-10-14T12:00:00Z";
export async function rogueAt(level: number,archetype: RogueArchetype = "thief") {
  let c = await createGuidedRogue(id,op,rogueCreation(),at);
  while (c.identity.level < level) c = await advanceGuidedRogue(c,rogueChoice(c,archetype),at);
  return c;
}
