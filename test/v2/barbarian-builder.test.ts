import { describe,it,expect } from "vitest";
import { barbarianCreation,barbarianChoice,barbarianAt } from "../fixtures/barbarian-builder";
import { createGuidedBarbarian,advanceGuidedBarbarian,validateBarbarianBuild } from "../../src/domain/character/barbarian-builder";
import { BARBARIAN_PATHS,BARBARIAN_CORE,BARBARIAN_FEATURES,barbarianRages,barbarianRageDamage,barbarianShieldDice,barbarianTotem,barbarianStorm } from "../../src/domain/character/barbarian-catalog";
import type { BarbarianPath,TotemAnimal,StormEnvironment } from "../../src/domain/character/barbarian-model";
import { BUILDER_RACES,BACKGROUND_PRESETS,BUILDER_WEAPONS } from "../../src/domain/character/fighter-builder-catalog";
import { fighterBuilderScores } from "../../src/domain/character/fighter-builder";
import { projectInventory,projectCharacterStatistics,projectAdjustedRollMode,projectUpdatedBuilderSpeed } from "../../src/domain/character/character-projection";
import { barbarianCriticalDice } from "../../src/domain/character/barbarian-rules";
import { FeatChoiceSchema } from "../../src/domain/character/character-builder-model";
const id="chr_00000000000000000000000000000001",op="build_00000000000000000000000000000001",at="2026-10-14T16:00:00Z";
describe("Barbarian PHB 2014 and Xanathar progression",() => {
  it.each(Object.keys(BARBARIAN_PATHS) as BarbarianPath[])("validates every level and feature of %s",async (path) => {
    let c=await barbarianAt(1);
    for(let level=1;level<=20;level++) {
      if(level>1)c=await advanceGuidedBarbarian(c,barbarianChoice(c,path),at);
      expect(c.identity.level).toBe(level);expect(c.combat.hitDice.dieSize).toBe(12);expect(c.combat.hitPoints.maximum).toBe(14+9*(level-1)+(level===20 ? 40 : 0));
      expect(c.checks.savingThrows.strength.proficiency).toBe(1);expect(c.checks.savingThrows.constitution.proficiency).toBe(1);expect(c.proficiencies.armor).toEqual(["Armaduras ligeras","Armaduras medias","Escudos"]);
      expect(c.identity.subclass).toBe(level>=3 ? `Senda del ${BARBARIAN_PATHS[path]}` : "");
      const keys=c.spellcasting.barbarian!.resourceIds;for(const f of [...BARBARIAN_CORE,...(level>=3 ? BARBARIAN_FEATURES[path] : [])])expect(Boolean(keys[f.key])).toBe(f.level<=level);
      const rage=c.traits.flatMap((g) => g.traits).find((t) => t.id===keys.rage)!;expect(rage.uses.maximum).toBe(barbarianRages(level));expect(rage.description).toContain(`+${barbarianRageDamage(level)}`);
      expect(c.combat.speed.startsWith(level>=5 ? "40 ft" : "30 ft")).toBe(true);
      expect(c.abilities.strength).toBe(level===20 ? 20 : 16);expect(c.abilities.constitution).toBe(level===20 ? 19 : 15);
      expect(c.traits.flatMap((g) => g.traits).some((t) => t.name==="Segundo aliento")).toBe(false);
      if(path==="ancestral-guardian" && level>=6)expect(c.actions.find((a) => a.name.startsWith("Escudo Espiritual"))!.damageExpression).toBe(`${barbarianShieldDice(level)}d6`);
    }
  });
  it.each(Object.keys(BARBARIAN_PATHS) as BarbarianPath[])("supports %s with every PHB race/background combination",async (path) => {
    for(const race of Object.keys(BUILDER_RACES) as Array<keyof typeof BUILDER_RACES>)for(const bg of Object.keys(BACKGROUND_PRESETS) as Array<keyof typeof BACKGROUND_PRESETS>){
      let c=await createGuidedBarbarian(id,op,barbarianCreation(race,bg),at);c=await advanceGuidedBarbarian(c,barbarianChoice(c,path),at);c=await advanceGuidedBarbarian(c,barbarianChoice(c,path),at);expect(c.identity.subclass).toBe(`Senda del ${BARBARIAN_PATHS[path]}`);
    }
  },15000);
  it("allows all 27 independent totem combinations",async () => {
    for(const a of ["bear","eagle","wolf"] as TotemAnimal[])for(const b of ["bear","eagle","wolf"] as TotemAnimal[])for(const d of ["bear","eagle","wolf"] as TotemAnimal[]){
      let c=await barbarianAt(2);while(c.identity.level<14){const next=c.identity.level+1;c=await advanceGuidedBarbarian(c,barbarianChoice(c,"totem-warrior",{totem:next===3 ? a : next===6 ? b : d}),at);}
      expect([barbarianTotem(c.builder!,3),barbarianTotem(c.builder!,6),barbarianTotem(c.builder!,14)]).toEqual([a,b,d]);
      expect(c.spellcasting.spells.filter((s) => s.casting?.source==="builder:barbarian").map((s) => s.casting!.key)).toEqual(["beast-sense","speak-with-animals","commune-with-nature"]);
    }
  });
  it.each(["desert","sea","tundra"] as StormEnvironment[])("keeps all storm features consistent with %s and permits later changes",async (storm) => {
    let c=await barbarianAt(14,"storm-herald",{storm});expect(barbarianStorm(c.builder!)).toBe(storm);
    const change=barbarianChoice(c);change.barbarian.storm=storm==="sea" ? "desert" : "sea";c=await advanceGuidedBarbarian(c,change,at);expect(barbarianStorm(c.builder!)).toBe(change.barbarian.storm);
    expect(c.traits.flatMap((g) => g.traits).filter((t) => ["Aura:","Alma:","Tormenta Furiosa:"].some((p) => t.name.startsWith(p))).every((t) => t.name.endsWith(change.barbarian.storm==="sea" ? "Mar" : "Desierto"))).toBe(true);
    expect(c.combat.speed.includes("nadar 40 ft (Alma de Tormenta)")).toBe(change.barbarian.storm==="sea");
  });
  it("calculates unarmored defense, shields and bear carrying capacity without stacking formulas",async () => {
    const c=await barbarianAt(6,"totem-warrior",{totem:"bear"});expect(projectInventory(c).calculatedArmorClass).toBe(14);expect(projectInventory(c).carryingCapacity).toBe(480);
    const fighter=await createGuidedBarbarian(id,op,barbarianCreation(),at);expect(projectInventory(fighter).carryingCapacity).toBe(240);
    const clone=structuredClone(c);clone.inventory.push({...c.inventory[0]!,id:"inv_00000000000000000000000000000009",name:"Escudo",weapon:null,category:"shield",equipped:true,armor:{base:2,dexterityBonus:false,maximumDexterityBonus:null,armorCategory:"shield",stealthDisadvantage:false,strengthRequirement:0}});expect(projectInventory(clone).calculatedArmorClass).toBe(16);
    clone.inventory.push({...clone.inventory.at(-1)!,id:"inv_00000000000000000000000000000010",name:"Armadura",category:"armor",armor:{base:14,dexterityBonus:true,maximumDexterityBonus:2,armorCategory:"medium",stealthDisadvantage:false,strengthRequirement:0}});expect(projectInventory(clone).calculatedArmorClass).toBe(18);
  });
  it("adds only individual brutal critical dice, including Dexterity melee but excluding thrown attacks",async () => {
    for(const level of [9,13,17]){const c=await barbarianAt(level),sword={...c.actions.find((a) => a.inventoryItemId)!,damageExpression:"2d6",ability:"dexterity" as const};expect(barbarianCriticalDice(c,sword)).toBe(`${level===9 ? 1 : level===13 ? 2 : 3}d6`);expect(barbarianCriticalDice(c,{...sword,reach:"20/60 ft"})).toBe("");}
  });
  it("validates d12, class choices, feat requirements and the capstone's raised limits",async () => {
    const c=await barbarianAt(3),choice=barbarianChoice(c);choice.skipImprovement=false;choice.feat=FeatChoiceSchema.parse({key:"heavily-armored",ability:"strength"});await expect(advanceGuidedBarbarian(c,choice,at)).resolves.toBeDefined();
    choice.feat=FeatChoiceSchema.parse({key:"war-caster"});await expect(advanceGuidedBarbarian(c,choice,at)).rejects.toThrow(/requisito/);
    const magical=await barbarianAt(3,"totem-warrior");await expect(advanceGuidedBarbarian(magical,choice,at)).resolves.toBeDefined();
    const bad=barbarianChoice(c);bad.barbarian.totem="bear";await expect(advanceGuidedBarbarian(c,bad,at)).rejects.toThrow(/Totémico/);
    let built=await barbarianAt(1);while(built.identity.level<20){const step=barbarianChoice(built);if(step.skipImprovement){step.skipImprovement=false;const key=built.abilities.strength<=18 ? "strength" : "constitution";step.abilityIncrease={strength:0,dexterity:0,constitution:0,intelligence:0,wisdom:0,charisma:0};if(key==="constitution" && built.abilities.constitution===19){step.abilityIncrease.constitution=1;step.abilityIncrease.dexterity=1;}else step.abilityIncrease[key]=2;}built=await advanceGuidedBarbarian(built,step,at);}expect(built.abilities.strength).toBe(24);expect(built.abilities.constitution).toBe(24);expect(built.combat.hitPoints.maximum).toBe(285);expect(fighterBuilderScores(built.builder!)).toEqual(built.abilities);expect(() => validateBarbarianBuild(built.builder!)).not.toThrow();
    expect(projectAdjustedRollMode(built,"skills",["Initiative"],"normal")).toBe("advantage");expect(projectCharacterStatistics(built).savingThrows.strength).toBe(13);
  });
  it("offers every martial melee and simple weapon alternative and uses two gold dice",async () => {
    for(const [key,w]of Object.entries(BUILDER_WEAPONS)){const c=barbarianCreation();if(w.weapon!.category==="martial")c.barbarianWeapon=key;else if(w.weapon!.category.startsWith("simple"))c.barbarianSecondary=key;else continue;const result=await createGuidedBarbarian(id,op,c,at);expect(result.actions.filter((a) => a.inventoryItemId).every((a) => a.proficient)).toBe(true);}
    const c=barbarianCreation();c.equipment.method="gold";c.equipment.goldRoll=[4,4];c.equipment.purchases=[{key:"greataxe",quantity:1,equipped:true}];const result=await createGuidedBarbarian(id,op,c,at);expect(result.currency.gold).toBe(50);expect(result.inventory).toHaveLength(1);
    c.equipment.goldRoll=[4,4,4,4];await expect(createGuidedBarbarian(id,op,c,at)).rejects.toThrow(/2d4/);
  });
});
