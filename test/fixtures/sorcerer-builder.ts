import { phbFighterCreation } from "./phb-fighter-builder";
import { FighterCreationSchema,FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { SORCERER_SKILLS,SORCERER_KNOWN,METAMAGIC,DIVINE_SPELLS,defaultSorcererCreation,sorcererCantrips,sorcererSpellList } from "../../src/domain/character/sorcerer-catalog";
import { replaySorcererChoices,createGuidedSorcerer,advanceGuidedSorcerer,sorcererMaxSpellLevel } from "../../src/domain/character/sorcerer-builder";
import { racialSkillGrants } from "../../src/domain/character/fighter-build-rules";
import { SKILL_DEFINITIONS,type SkillKey } from "../../src/domain/character/character-checks";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { SorcererOrigin,Metamagic } from "../../src/domain/character/sorcerer-model";
export const sorcererId = "chr_00000000000000000000000000000001",sorcererOp = "build_00000000000000000000000000000001",sorcererTime = "2026-10-16T16:00:00Z";
export function sorcererCreation(origin: SorcererOrigin = "draconic",race: FighterCreation["race"] = "human",background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background),defaults = defaultSorcererCreation("Hechicero de prueba"),c = FighterCreationSchema.parse({ ...base,classKey: "sorcerer",baseAbilities: defaults.baseAbilities,equipment: { ...base.equipment,goldRoll: [2,2,2] },sorcerer: { ...defaults.sorcerer,origin,ancestry: origin === "draconic" ? "red" : null,affinity: origin === "divine-soul" ? "good" : null } });
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf","wood-elf","drow"].includes(race) ? "perception" : null;
  c.skills = SORCERER_SKILLS.filter((s) => !c.background.skills.includes(s) && s !== fixed).slice(0,2);const used = [...c.skills,...c.background.skills],all = Object.keys(SKILL_DEFINITIONS) as SkillKey[];
  c.racialSkillReplacement = fixed && used.includes(fixed) ? all.find((s) => !used.includes(s) && s !== fixed)! : null;c.origin.skills = all.filter((s) => ![...used,...racialSkillGrants({ ...c,origin: { ...c.origin,skills: [] } })].includes(s)).slice(0,c.origin.skills.length);return c;
}
export function sorcererChoice(c: CharacterV2,metas?: Metamagic[]) {
  const level = c.identity.level+1,replay = replaySorcererChoices(c.builder!),step = FighterLevelChoiceSchema.parse({ operationId: `build_${(900+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 4,abilityIncrease: null,subclass: null,additionalStyle: null,skipImprovement: [4,8,12,16,19].includes(level) });
  step.sorcerer.cantrips = sorcererSpellList(c.builder!,0).filter((s) => !replay.cantrips.includes(s)).slice(0,sorcererCantrips(level)-sorcererCantrips(level-1));step.sorcerer.learn = sorcererSpellList(c.builder!,1,sorcererMaxSpellLevel(level)).filter((s) => !replay.spells.some((old) => old.key === s) && !(replay.origin === "shadow" && level === 3 && s === "darkness")).slice(0,SORCERER_KNOWN[level]!-SORCERER_KNOWN[level-1]!);
  const quota = level === 3 ? 2 : [10,17].includes(level) ? 1 : 0;step.sorcerer.metamagic = (metas ?? Object.keys(METAMAGIC) as Metamagic[]).filter((m) => !replay.metamagic.includes(m)).slice(0,quota);return step;
}
export async function sorcererAt(level = 1,origin: SorcererOrigin = "draconic",metas?: Metamagic[]) { let c = await createGuidedSorcerer(sorcererId,sorcererOp,sorcererCreation(origin),sorcererTime);while (c.identity.level < level) c = await advanceGuidedSorcerer(c,sorcererChoice(c,metas),sorcererTime);return c; }
