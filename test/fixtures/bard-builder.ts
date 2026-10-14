import { phbFighterCreation } from "./phb-fighter-builder";
import { FighterCreationSchema,FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { BARD_SKILLS,defaultBardCreation,bardCollege,bardCantrips,bardLearnCount,bardSecretsCount } from "../../src/domain/character/bard-catalog";
import { INSTRUMENTS } from "../../src/domain/character/phb-character-options";
import { bardMaxSpellLevel,bardSecretOptions,replayBardChoices,createGuidedBard,advanceGuidedBard } from "../../src/domain/character/bard-builder";
import { classSpells } from "../../src/domain/character/phb-spells";
import { racialSkillGrants } from "../../src/domain/character/fighter-build-rules";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { BardCollege } from "../../src/domain/character/bard-model";
export const bardId = "chr_00000000000000000000000000000001",bardOp = "build_00000000000000000000000000000001",bardAtTime = "2026-10-14T16:00:00.000Z";
export function bardCreation(race: FighterCreation["race"] = "human",background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background),defaults = defaultBardCreation("Bardo de prueba");
  const c = FighterCreationSchema.parse({ ...base,classKey: "bard",baseAbilities: defaults.baseAbilities,bard: { cantrips: ["vicious-mockery","mage-hand"],learn: ["healing-word","thunderwave","charm-person","detect-magic"],instruments: INSTRUMENTS.filter((s) => !base.background.tools.includes(s)).slice(0,3) } });
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf","wood-elf","drow"].includes(race) ? "perception" : null;
  c.skills = BARD_SKILLS.filter((s) => !c.background.skills.includes(s) && s !== fixed).slice(0,3);
  const used = [...c.skills,...c.background.skills];
  if (fixed && used.includes(fixed)) c.racialSkillReplacement = BARD_SKILLS.find((s) => !used.includes(s) && s !== fixed)!;
  else c.racialSkillReplacement = null;
  c.origin.skills = BARD_SKILLS.filter((s) => ![...used,...racialSkillGrants({ ...c,origin: { ...c.origin,skills: [] } })].includes(s)).slice(0,c.origin.skills.length);
  return c;
}
export function bardChoice(c: CharacterV2,college: BardCollege = "lore") {
  const level = c.identity.level+1,replay = replayBardChoices(c.builder!),chosen = level === 3 ? college : bardCollege(c.builder!);
  const step = FighterLevelChoiceSchema.parse({ operationId: `build_${(600+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 5,abilityIncrease: null,subclass: null,additionalStyle: null,skipImprovement: [4,8,12,16,19].includes(level) });
  if (level === 3) { step.bard.college = college; if (college === "swords") step.bard.style = "dueling"; if (college === "lore") step.bard.skills = BARD_SKILLS.filter((s) => c.checks.skills[s].proficiency === 0).slice(0,3); }
  if ([3,10].includes(level)) step.bard.expertise = BARD_SKILLS.filter((s) => c.checks.skills[s].proficiency === 1 || step.bard.skills.includes(s)).slice(0,2);
  const used = [...replay.cantrips,...replay.spells.map((s) => s.key)];
  step.bard.cantrips = classSpells("bard",0).filter((s) => !used.includes(s)).slice(0,bardCantrips(level)-bardCantrips(level-1)); used.push(...step.bard.cantrips);
  step.bard.learn = classSpells("bard",1,bardMaxSpellLevel(level)).filter((s) => !used.includes(s)).slice(0,bardLearnCount(level)); used.push(...step.bard.learn);
  step.bard.secrets = bardSecretOptions(level).filter((s) => !used.includes(s)).slice(0,bardSecretsCount(level,chosen));
  return step;
}
export async function bardAt(level = 1,college: BardCollege = "lore") {
  let c = await createGuidedBard(bardId,bardOp,bardCreation(),bardAtTime);
  while (c.identity.level < level) c = await advanceGuidedBard(c,bardChoice(c,college),bardAtTime);
  return c;
}
