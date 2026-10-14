import { phbFighterCreation } from "./phb-fighter-builder";
import { FighterCreationSchema,FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import type { WarlockPatron,PactBoon } from "../../src/domain/character/warlock-model";
import { defaultWarlockCreation,WARLOCK_SKILLS,WARLOCK_KNOWN,INVOCATIONS,pactSlots,invocationCount,warlockCantrips,warlockSpellChoices } from "../../src/domain/character/warlock-catalog";
import { replayWarlockChoices } from "../../src/domain/character/warlock-builder";
import { classSpells } from "../../src/domain/character/phb-spells";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { SKILL_DEFINITIONS,type SkillKey } from "../../src/domain/character/character-checks";
export function phbWarlockCreation(patron: WarlockPatron = "fiend",race: FighterCreation["race"] = "human",background: FighterCreation["background"]["equipment"] = "acolyte") {
  const base = phbFighterCreation(race,background),defaults = defaultWarlockCreation("PHB warlock");
  const creation = FighterCreationSchema.parse({ ...base,classKey: "warlock",baseAbilities: defaults.baseAbilities,equipment: defaults.equipment,warlock: { patron,cantrips: ["eldritch-blast","mage-hand"],learn: ["armor-of-agathys","hex"] } });
  creation.skills = WARLOCK_SKILLS.filter((key) => !creation.background.skills.includes(key) && !(race === "half-orc" && key === "intimidation")).slice(0,2);
  const fixed = race === "half-orc" ? "intimidation" : ["high-elf","wood-elf","drow"].includes(race) ? "perception" : null,used = [...creation.skills,...creation.background.skills];
  if (creation.racialSkillReplacement) { creation.racialSkillReplacement = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).find((key) => !used.includes(key) && key !== fixed)!; used.push(creation.racialSkillReplacement); }
  if (creation.origin.skills.length) creation.origin.skills = (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).filter((s) => !used.includes(s) && s !== fixed).slice(0,creation.origin.skills.length);
  return creation;
}
export function completeWarlockChoice(character: CharacterV2,boon: PactBoon = "tome") {
  const level = character.identity.level+1,replay = replayWarlockChoices(character.builder!);
  const step = FighterLevelChoiceSchema.parse({ operationId: `build_${(500+level).toString(16).padStart(32,"0")}`,level,hpMethod: "fixed",hpBase: 5,abilityIncrease: null,subclass: null,additionalStyle: null });
  if ([4,8,12,16,19].includes(level)) { const key = (["charisma","constitution","dexterity","wisdom","intelligence","strength"] as const).find((key) => character.abilities[key] <= 18)!; step.abilityIncrease = { strength: 0,dexterity: 0,constitution: 0,intelligence: 0,wisdom: 0,charisma: 0 }; step.abilityIncrease[key] = 2; }
  step.warlock.learn = warlockSpellChoices(replay.patron,pactSlots(level).level).filter((key) => !replay.spells.includes(key)).slice(0,WARLOCK_KNOWN[level]!-WARLOCK_KNOWN[level-1]!);
  step.warlock.cantrips = classSpells("warlock",0).filter((key) => !replay.cantrips.includes(key) && !replay.tomeCantrips.includes(key)).slice(0,warlockCantrips(level)-warlockCantrips(level-1));
  if (level === 3) { step.warlock.boon = boon; if (boon === "tome") step.warlock.tomeCantrips = ["guidance","vicious-mockery","thorn-whip"]; if (boon === "blade") step.warlock.pactWeapon = "longsword"; }
  const nextBoon = level === 3 ? boon : replay.boon;
  step.warlock.invocations = Object.keys(INVOCATIONS).filter((key) => { const i = INVOCATIONS[key]!; return !replay.invocations.includes(key) && i.level <= level && (!i.boon || i.boon === nextBoon) && key !== "book-of-ancient-secrets"; }).slice(0,invocationCount(level)-invocationCount(level-1));
  if (level === 3 && boon === "tome") { step.warlock.replaceInvocation = { oldKey: "armor-of-shadows",newKey: "book-of-ancient-secrets" }; step.warlock.rituals = ["find-familiar","identify"]; }
  if ([11,13,15,17].includes(level)) step.warlock.arcanum = classSpells("warlock",(level+1)/2)[0]!;
  return step;
}
