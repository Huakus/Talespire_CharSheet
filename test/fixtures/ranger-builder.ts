import { phbFighterCreation } from "./phb-fighter-builder";
import { FighterCreationSchema,FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { RANGER_SKILLS,defaultRangerCreation,RANGER_KNOWN,RANGER_COMPANIONS,HUNTER_OPTIONS,rangerBonusSpell } from "../../src/domain/character/ranger-catalog";
import { replayRangerChoices,createGuidedRanger,advanceGuidedRanger,rangerMaxSpellLevel } from "../../src/domain/character/ranger-builder";
import { classSpells } from "../../src/domain/character/phb-spells";
import { racialSkillGrants } from "../../src/domain/character/fighter-build-rules";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { RangerArchetype } from "../../src/domain/character/ranger-model";
import { SKILL_DEFINITIONS,type SkillKey } from "../../src/domain/character/character-checks";
export const rangerId = "chr_00000000000000000000000000000001",rangerOp = "build_00000000000000000000000000000001",rangerTime = "2026-10-14T19:00:00.000Z";
export function rangerCreation(race: FighterCreation["race"] = "human",background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background),defaults = defaultRangerCreation("Explorador de prueba"),c = FighterCreationSchema.parse({ ...base,classKey: "ranger",baseAbilities: defaults.baseAbilities,ranger: { enemy: { type: "beasts",languageConfirmed: true },terrain: "forest" } });
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf","wood-elf","drow"].includes(race) ? "perception" : null;
  c.skills = RANGER_SKILLS.filter((s) => !c.background.skills.includes(s) && s !== fixed).slice(0,3);
  const used = [...c.skills,...c.background.skills],all = Object.keys(SKILL_DEFINITIONS) as SkillKey[];
  if (fixed && used.includes(fixed)) c.racialSkillReplacement = all.find((s) => !used.includes(s) && s !== fixed)!;else c.racialSkillReplacement = null;
  c.origin.skills = all.filter((s) => ![...used,...racialSkillGrants({ ...c,origin: { ...c.origin,skills: [] } })].includes(s)).slice(0,c.origin.skills.length);return c;
}
export function rangerChoice(c: CharacterV2,archetype: RangerArchetype = "hunter",hunter: Record<number,string> = {}) {
  const level = c.identity.level+1,replay = replayRangerChoices(c.builder!);
  const step = FighterLevelChoiceSchema.parse({ operationId: `build_${(800+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 6,abilityIncrease: null,subclass: null,additionalStyle: null,skipImprovement: [4,8,12,16,19].includes(level) });
  if (level === 2) step.ranger.style = "archery";
  if (level === 3) { step.ranger.archetype = archetype;if (archetype === "beast-master") step.ranger.companion = structuredClone(RANGER_COMPANIONS.wolf!); }
  if (archetype === "hunter" && HUNTER_OPTIONS[level]) step.ranger.hunter = hunter[level] ?? Object.keys(HUNTER_OPTIONS[level]!)[0]!;
  if ([6,14].includes(level)) step.ranger.enemy = { type: level === 6 ? "undead" : "dragons",humanoids: [],language: "",languageConfirmed: true };
  if ([6,10].includes(level)) step.ranger.terrain = level === 6 ? "coast" : "desert";
  if (archetype === "gloom-stalker" && level === 7 && c.checks.savingThrows.wisdom.proficiency === 1) step.ranger.ironMind = "intelligence";
  const bonus = rangerBonusSpell(archetype,level);step.ranger.learn = classSpells("ranger",1,rangerMaxSpellLevel(level)).filter((s) => !replay.spells.some((known) => known.key === s) && s !== bonus).slice(0,RANGER_KNOWN[level]!-RANGER_KNOWN[level-1]!);return step;
}
export async function rangerAt(level = 1,archetype: RangerArchetype = "hunter",hunter: Record<number,string> = {}) { let c = await createGuidedRanger(rangerId,rangerOp,rangerCreation(),rangerTime);while (c.identity.level < level) c = await advanceGuidedRanger(c,rangerChoice(c,archetype,hunter),rangerTime);return c; }
