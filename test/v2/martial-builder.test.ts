import { describe,it,expect } from "vitest";
import { martialAt,martialChoice,martialCreation,martialId,martialOp,martialTime as at } from "../fixtures/martial-builder";
import { MONK_TRADITIONS,PALADIN_OATHS,ELEMENTAL_DISCIPLINES,OATH_SPELLS } from "../../src/domain/character/martial-catalog";
import { validateMartialBuild,validateMartialCreation,replayMartialChoices } from "../../src/domain/character/martial-builder";
import { buildGuidedCharacter,advanceGuidedCharacter } from "../../src/domain/character/guided-character-builder";
import { PHB_SPELLS } from "../../src/domain/character/phb-spells";
import { projectInventory,projectCharacterStatistics,abilityModifier } from "../../src/domain/character/character-projection";
import { projectCharacterProgression } from "../../src/domain/character/character-progression";
import { BUILDER_RACES,BACKGROUND_PRESETS } from "../../src/domain/character/fighter-builder-catalog";
import { canCastSpells } from "../../src/domain/character/fighter-build-rules";
import { paladinSpellKeys } from "../../src/domain/character/martial-builder";
describe("Monje y Paladín 2014 + Xanathar",()=>{
  it("requisitos de dotes distinguen ataques de conjuro de lanzar conjuros e incluyen disciplinas sustitutas",async()=>{
    expect(canCastSpells((await martialAt(3,"monk","sun-soul")).builder!)).toBe(false);
    expect(canCastSpells((await martialAt(6,"monk","sun-soul")).builder!)).toBe(true);
    expect(canCastSpells((await martialAt(18)).builder!)).toBe(true);
    let c=await martialAt(2),step=martialChoice(c,"four-elements");step.monk.disciplines=["flowing-river"];c=await advanceGuidedCharacter(c,step,at);
    while(c.identity.level<5)c=await advanceGuidedCharacter(c,martialChoice(c,"four-elements"),at);
    step=martialChoice(c,"four-elements");step.monk.replacement={oldKey:"attunement",newKey:"north-wind"};step.monk.disciplines=["water-whip"];c=await advanceGuidedCharacter(c,step,at);expect(canCastSpells(c.builder!)).toBe(true);
  });
  it("lista de Paladín incorpora también los conjuros de Xanathar en sus niveles",async()=>{
    const c=await martialAt(20,"paladin"),keys=paladinSpellKeys(c.builder!);expect(keys).toContain("ceremony");expect(keys).toContain("holy-weapon");expect(keys).toContain("find-greater-steed");
  });
  for(const [key,subclasses] of [["monk",MONK_TRADITIONS],["paladin",PALADIN_OATHS]] as const)for(const subclass of Object.keys(subclasses))it(`${key} ${subclass}: recorrido completo 1–20 y Progresión`,async()=>{
    const c=await martialAt(20,key,subclass),history=await projectCharacterProgression(c);expect(history!.levels).toHaveLength(20);expect(c.identity.subclass).toBe(subclasses[subclass as keyof typeof subclasses]);expect(c.combat.hitDice.dieSize).toBe(key==="monk"?8:10);expect(c.builder!.levels).toHaveLength(19);expect(c.identity.level).toBe(20);expect(history!.levels[2]!.decisions.some((d)=>d.value===c.identity.subclass)).toBe(true);
    if(key==="monk"){expect(c.spellcasting.monk!.resourceIds.ki).toBeTruthy();expect(c.actions.find((a)=>a.name==="Golpe desarmado")!.damageExpression).toBe("1d10");expect(Object.values(c.checks.savingThrows).every((p)=>p.proficiency===1)).toBe(true);expect(c.combat.speed).toBe("60 ft");}
    else{expect(Object.values(c.spellcasting.slots).map((s)=>s.maximum)).toEqual([4,3,3,3,2,0,0,0,0]);expect(c.spellcasting.spells.filter((s)=>s.prepared)).toHaveLength(10);expect(history!.levels.flatMap((l)=>l.spells).filter((s)=>s.kind==="Siempre preparado")).toHaveLength(10);}
  },30000);
  it("todas las disciplinas y todos los conjuros de juramento están catalogados en español",()=>{expect(Object.keys(ELEMENTAL_DISCIPLINES)).toHaveLength(17);for(const d of Object.values(ELEMENTAL_DISCIPLINES))if(d.spell)expect(PHB_SPELLS[d.spell]).toBeTruthy();for(const key of Object.values(OATH_SPELLS).flat(2))expect(PHB_SPELLS[key]).toBeTruthy();expect(ELEMENTAL_DISCIPLINES["eternal-mountain"]!.level).toBe(17);expect(ELEMENTAL_DISCIPLINES["summit-gong"]!.cost).toBe(3);});
  it("ambas clases admiten las 15 razas y los 18 trasfondos personalizables",()=>{for(const key of ["monk","paladin"] as const)for(const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>)for(const bg of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>)expect(()=>validateMartialCreation(martialCreation(key,race,bg))).not.toThrow();});
  it("oro inicial de Monje es 5d4 sin multiplicador y reemplaza ambos paquetes",async()=>{const p=martialCreation("monk");p.equipment={...p.equipment,method:"gold",goldRoll:[1,1,1,1,1],purchases:[]};const c=await buildGuidedCharacter(martialId,martialOp,p,at);expect(c.currency.gold).toBe(5);expect(c.inventory).toHaveLength(0);p.equipment.purchases=[{key:"shortsword",quantity:1,equipped:true}];expect(()=>validateMartialCreation(p)).toThrow(/superan/);});
  it("sustituye Sintonía desde nivel 6, retira su rasgo y rechaza sustitución en 3",async()=>{
    const c=await martialAt(2),step=martialChoice(c,"four-elements");step.monk.replacement={oldKey:"attunement",newKey:"flowing-river"};
    await expect(advanceGuidedCharacter(c,step,at)).rejects.toThrow(/6, 11 o 17/);
    step.monk.replacement=null;step.monk.disciplines=["flowing-river"];
    let next=await advanceGuidedCharacter(c,step,at);while(next.identity.level<5)next=await advanceGuidedCharacter(next,martialChoice(next,"four-elements"),at);
    const sixth=martialChoice(next,"four-elements");sixth.monk.replacement={oldKey:"attunement",newKey:"north-wind"};sixth.monk.disciplines=["water-whip"];
    next=await advanceGuidedCharacter(next,sixth,at);expect(replayMartialChoices(next.builder!).disciplines).toEqual(["north-wind","flowing-river","water-whip"]);
    expect(next.traits.flatMap((g)=>g.traits).some((t)=>t.name==="Sintonía Elemental")).toBe(false);
  });
  it("rechaza subclases tempranas, elecciones extranjeras, duplicados, armas pesadas y disciplinas prematuras",async()=>{const c=await martialAt(2);let p=martialChoice(c,"kensei");p.monk.weapons=["greatsword","longbow"];await expect(advanceGuidedCharacter(c,p,at)).rejects.toThrow(/Kensei/);p=martialChoice(c,"four-elements");p.monk.disciplines=["eternal-mountain"];await expect(advanceGuidedCharacter(c,p,at)).rejects.toThrow(/disciplina/);p=martialChoice(c,"open-hand");p.paladin.oath="devotion";await expect(advanceGuidedCharacter(c,p,at)).rejects.toThrow();const s=structuredClone(c.builder!);s.creation.monk.tradition="open-hand";expect(()=>validateMartialBuild(s)).toThrow(/nivel 3/);});
  it("subir conserva heridas, temporales, recursos usados e idempotencia y PG aplican CON retroactivo",async()=>{let c=await martialAt(3);c.combat.hitPoints.current=3;c.combat.hitPoints.temporary=7;const ki=c.traits.flatMap((g)=>g.traits).find((t)=>t.id===c.spellcasting.monk!.resourceIds.ki)!;ki.uses.used=2;const p=martialChoice(c);p.skipImprovement=false;p.abilityIncrease={strength:0,dexterity:0,constitution:2,intelligence:0,wisdom:0,charisma:0};const next=await advanceGuidedCharacter(c,p,at);expect(next.combat.hitPoints.current).toBe(3);expect(next.combat.hitPoints.temporary).toBe(7);expect(next.traits.flatMap((g)=>g.traits).find((t)=>t.id===ki.id)!.uses.used).toBe(2);expect(await advanceGuidedCharacter(next,p,at)).toEqual(next);await expect(advanceGuidedCharacter(next,{...p,hpMethod:"rolled",hpBase:1},at)).rejects.toThrow(/otras elecciones/);expect(next.combat.hitPoints.maximum-c.combat.hitPoints.maximum).toBe(5+abilityModifier(next.abilities.constitution)+3);});
  it("CA de monje usa SAB sin escudo y Aura de Protección solo mientras consciente",async()=>{const m=await martialAt(1),p=await martialAt(6,"paladin");expect(projectInventory(m).calculatedArmorClass).toBe(10+abilityModifier(m.abilities.dexterity)+abilityModifier(m.abilities.wisdom));const before=projectCharacterStatistics(p).savingThrows.dexterity;p.combat.conditions.push({id:"cnd_00000000000000000000000000000001",key:"unconscious",label:"Inconsciente",level:null,addedAt:at});expect(before-projectCharacterStatistics(p).savingThrows.dexterity).toBe(Math.max(1,abilityModifier(p.abilities.charisma)));});
});
