import { phbFighterCreation } from "./phb-fighter-builder";
import { FighterCreationSchema,FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { DRUID_SKILLS,defaultDruidCreation,druidCantrips,HERBALISM } from "../../src/domain/character/druid-catalog";
import { TOOLS } from "../../src/domain/character/phb-character-options";
import { replayDruidChoices,createGuidedDruid,advanceGuidedDruid } from "../../src/domain/character/druid-builder";
import { classSpells } from "../../src/domain/character/phb-spells";
import { racialSkillGrants } from "../../src/domain/character/fighter-build-rules";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { DruidCircle,DruidLand } from "../../src/domain/character/druid-model";
import { SKILL_DEFINITIONS,type SkillKey } from "../../src/domain/character/character-checks";
export const druidId = "chr_00000000000000000000000000000001",druidOp = "build_00000000000000000000000000000001",druidAtTime = "2026-10-14T18:00:00.000Z";
export function druidCreation(race: FighterCreation["race"] = "human",background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background),defaults = defaultDruidCreation("Druida de prueba");
  const c = FighterCreationSchema.parse({ ...base,classKey: "druid",baseAbilities: defaults.baseAbilities,equipment: { ...base.equipment,goldRoll: [2,2] },druid: { cantrips: ["druidcraft","thorn-whip"] } });
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf","wood-elf","drow"].includes(race) ? "perception" : null;
  c.skills = DRUID_SKILLS.filter((s) => !c.background.skills.includes(s) && s !== fixed).slice(0,2);
  const used = [...c.skills,...c.background.skills],all = Object.keys(SKILL_DEFINITIONS) as SkillKey[];
  if (fixed && used.includes(fixed)) c.racialSkillReplacement = all.find((s) => !used.includes(s) && s !== fixed)!;else c.racialSkillReplacement = null;
  c.origin.skills = all.filter((s) => ![...used,...racialSkillGrants({ ...c,origin: { ...c.origin,skills: [] } })].includes(s)).slice(0,c.origin.skills.length);
  if (c.background.tools.includes(HERBALISM)) c.background.tools = c.background.tools.map((s) => s === HERBALISM ? TOOLS.find((t) => t !== HERBALISM && !c.background.tools.includes(t))! : s);
  return c;
}
export function druidChoice(c: CharacterV2,circle: DruidCircle = "land",land: DruidLand = "forest") {
  const level = c.identity.level+1,replay = replayDruidChoices(c.builder!);
  const step = FighterLevelChoiceSchema.parse({ operationId: `build_${(700+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 5,abilityIncrease: null,subclass: null,additionalStyle: null,skipImprovement: [4,8,12,16,19].includes(level) });
  if (level === 2) { step.druid.circle = circle;if (circle === "land") step.druid.bonusCantrip = classSpells("druid",0).find((s) => !replay.cantrips.includes(s))!; }
  if (level === 3 && circle === "land") step.druid.land = land;
  step.druid.cantrips = classSpells("druid",0).filter((s) => !replay.cantrips.includes(s)).slice(0,druidCantrips(level)-druidCantrips(level-1));
  return step;
}
export async function druidAt(level = 1,circle: DruidCircle = "land",land: DruidLand = "forest") {
  let c = await createGuidedDruid(druidId,druidOp,druidCreation(),druidAtTime);
  while (c.identity.level < level) c = await advanceGuidedDruid(c,druidChoice(c,circle,land),druidAtTime);
  return c;
}
