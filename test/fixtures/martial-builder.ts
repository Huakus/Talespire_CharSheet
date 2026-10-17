import { phbFighterCreation } from "./phb-fighter-builder";
import { FighterCreationSchema,FighterLevelChoiceSchema,type FighterCreation } from "../../src/domain/character/character-builder-model";
import { MONK_SKILLS,PALADIN_SKILLS,defaultMonkCreation,defaultPaladinCreation,ELEMENTAL_DISCIPLINES,monkWeaponKeys } from "../../src/domain/character/martial-catalog";
import { buildGuidedCharacter,advanceGuidedCharacter } from "../../src/domain/character/guided-character-builder";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { SKILL_DEFINITIONS,type SkillKey } from "../../src/domain/character/character-checks";
import { replayMartialChoices } from "../../src/domain/character/martial-builder";
export const martialId="chr_00000000000000000000000000000031",martialOp="build_00000000000000000000000000000031",martialTime="2026-10-16T19:00:00Z";
export function martialCreation(key:"monk"|"paladin",race:FighterCreation["race"]="human",background:FighterCreation["background"]["equipment"]="acolyte") {
  const base=phbFighterCreation(race,background),defaults=key==="monk"?defaultMonkCreation():defaultPaladinCreation(),c=FighterCreationSchema.parse({...base,classKey:key,baseAbilities:defaults.baseAbilities,monk:defaults.monk});
  const fixed=race==="half-orc"?"intimidation":["high-elf","wood-elf","drow"].includes(race)?"perception":null;c.skills=(key==="monk"?MONK_SKILLS:PALADIN_SKILLS).filter((s)=>!c.background.skills.includes(s)&&s!==fixed).slice(0,2);
  const all=Object.keys(SKILL_DEFINITIONS) as SkillKey[],used=[...c.skills,...c.background.skills,...(fixed?[fixed]:[])];c.racialSkillReplacement=fixed && [...c.skills,...c.background.skills].includes(fixed as SkillKey) ? all.find((s)=>!used.includes(s))! : null;c.origin.skills=all.filter((s)=>!used.includes(s) && s!==c.racialSkillReplacement).slice(0,c.origin.skills.length);
  if(c.classKey==="monk"&&c.background.tools.includes(c.monk.tool))c.monk.tool="Suministros de calígrafo";return c;
}
export function martialChoice(c:CharacterV2,subclass="open-hand") {
  const level=c.identity.level+1,monk=c.builder!.classKey==="monk",p=FighterLevelChoiceSchema.parse({operationId:`build_${(3000+level).toString(16).padStart(32,"0")}`,level,hpMethod:"fixed",hpBase:monk?5:6,abilityIncrease:null,subclass:null,additionalStyle:null,skipImprovement:[4,8,12,16,19].includes(level)});
  if(monk){if(level===3)p.monk.tradition=subclass as typeof p.monk.tradition;
    if(subclass==="kensei"&&[3,6,11,17].includes(level)){p.monk.weapons=level===3?["longsword","longbow"]:["rapier","shortbow","battleaxe"].filter((k)=>!monkWeaponKeys(c.builder!).includes(k)).slice(0,1);if(level===3)p.monk.brush="painter";}
    if(subclass==="four-elements"&&[3,6,11,17].includes(level)){const known=[...replayMartialChoices(c.builder!).disciplines,...(level===3?["attunement"]:[])];p.monk.disciplines=Object.keys(ELEMENTAL_DISCIPLINES).filter((k)=>ELEMENTAL_DISCIPLINES[k]!.level<=level&&!known.includes(k)).slice(0,1);}
  }else{if(level===2)p.paladin.style="defense";if(level===3)p.paladin.oath=subclass as typeof p.paladin.oath;}
  return p;
}
export async function martialAt(level=1,key:"monk"|"paladin"="monk",subclass=key==="monk"?"open-hand":"devotion") {let c=await buildGuidedCharacter(martialId,martialOp,martialCreation(key),martialTime);while(c.identity.level<level)c=await advanceGuidedCharacter(c,martialChoice(c,subclass),martialTime);return c;}
