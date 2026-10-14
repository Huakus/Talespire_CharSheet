import { describe,it,expect } from "vitest";
import { barbarianAt,barbarianChoice,barbarianCreation } from "../fixtures/barbarian-builder";
import { performBarbarianAction } from "../../src/domain/character/barbarian-play";
import { barbarianRaging,barbarianResistances,barbarianBeyondDeath } from "../../src/domain/character/barbarian-rules";
import { createGuidedBarbarian,advanceGuidedBarbarian } from "../../src/domain/character/barbarian-builder";
import { applyCharacterResourceCommand,type CharacterResourceCommand } from "../../src/domain/character/character-resources";
import { castCharacterSpell,removeCharacterSpell,setCharacterSpellPrepared } from "../../src/domain/character/character-spells";
import { projectActionDamageBonus,projectActionRollMode,projectAdjustedRollMode,projectUpdatedBuilderSpeed } from "../../src/domain/character/character-projection";
import { PHB_EQUIPMENT } from "../../src/domain/character/fighter-builder-catalog";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { BarbarianAction } from "../../src/domain/character/barbarian-model";
const at="2026-10-14T16:00:00Z";let seq=500;
const perform=(c:CharacterV2,action:BarbarianAction) => performBarbarianAction(c,`barbarian_${(++seq).toString(16).padStart(32,"0")}`,action,{expectedRevision:c.revision,updatedAt:at});
const resource=(c:CharacterV2,cmd:CharacterResourceCommand) => applyCharacterResourceCommand(c,cmd,{expectedRevision:c.revision,updatedAt:at}).character;
const trait=(c:CharacterV2,key:string) => c.traits.flatMap((g) => g.traits).find((t) => t.id===c.spellcasting.barbarian!.resourceIds[key])!;
describe("Barbarian rage and subclass play",() => {
  it("consumes rage, prevents duplicate starts, preserves spending on advancement and restores only on long rest",async () => {
    let c=await barbarianAt(1);c=await perform(c,{kind:"rage"});expect(trait(c,"rage").uses.used).toBe(1);expect(barbarianRaging(c)).toBe(true);
    await expect(perform(c,{kind:"rage"})).rejects.toThrow(/Ya estás/);c=await advanceGuidedBarbarian(c,barbarianChoice(c),at);expect(trait(c,"rage").uses.used).toBe(1);
    c=await perform(c,{kind:"end-rage"});expect(trait(c,"rage").uses.used).toBe(1);c=resource(c,{kind:"short-rest"});expect(trait(c,"rage").uses.used).toBe(1);
    c=await perform(c,{kind:"rage"});c=await perform(c,{kind:"end-rage"});await expect(perform(c,{kind:"rage"})).rejects.toThrow(/No quedan/);c=resource(c,{kind:"long-rest"});expect(trait(c,"rage").uses.used).toBe(0);
  });
  it("ends early only when neither attacking nor damaged, keeps persistent rage's time limit and permits unlimited level twenty rages",async () => {
    let c=await barbarianAt(3);c=await perform(c,{kind:"rage"});c=await perform(c,{kind:"end-turn",attackedHostile:true,tookDamage:false});expect(barbarianRaging(c)).toBe(true);c=await perform(c,{kind:"end-turn",attackedHostile:false,tookDamage:true});expect(barbarianRaging(c)).toBe(true);c=await perform(c,{kind:"end-turn",attackedHostile:false,tookDamage:false});expect(barbarianRaging(c)).toBe(false);
    c=await barbarianAt(15);c=await perform(c,{kind:"rage"});for(let i=0;i<9;i++){c=await perform(c,{kind:"end-turn",attackedHostile:false,tookDamage:false});expect(barbarianRaging(c)).toBe(true);}c=await perform(c,{kind:"end-turn",attackedHostile:false,tookDamage:false});expect(barbarianRaging(c)).toBe(false);
    c=await barbarianAt(19);trait(c,"rage").uses.used=6;c=await advanceGuidedBarbarian(c,barbarianChoice(c),at);for(let i=0;i<8;i++){c=await perform(c,{kind:"rage"});c=await perform(c,{kind:"end-rage"});}expect(trait(c,"rage").uses.used).toBe(0);expect(c.combat.exhaustion).toBe(0);
  });
  it("adds rage damage only to Strength melee and combines reckless advantage without stacking it",async () => {
    let c=await barbarianAt(9);const axe=c.actions.find((a) => a.name==="Gran hacha") ?? c.actions.find((a) => a.inventoryItemId)!;const base=projectActionDamageBonus(c,axe);c=await perform(c,{kind:"rage"});expect(projectActionDamageBonus(c,axe)).toBe(base+3);
    expect(projectActionDamageBonus(c,{...axe,ability:"dexterity"})).toBe(base);expect(projectActionDamageBonus(c,{...axe,reach:"20/60 ft"})).toBe(base);
    expect(projectAdjustedRollMode(c,"skills",["athletics"],"normal")).toBe("advantage");expect(projectAdjustedRollMode(c,"saves",["strength"],"normal")).toBe("advantage");
    c=await perform(c,{kind:"reckless",firstAttackOfTurn:true});expect(projectActionRollMode(c,axe)).toBe("advantage");expect(projectActionRollMode(c,{...axe,ability:"dexterity"})).toBe("normal");
    c.combat.conditions.push({id:"cnd_00000000000000000000000000000002",key:"poisoned",label:"Envenenado",level:null,addedAt:at});expect(projectActionRollMode(c,axe)).toBe("normal");expect(projectActionRollMode(c,{...axe,rollMode:"disadvantage"})).toBe("normal");
    c=await perform(c,{kind:"end-turn",attackedHostile:true,tookDamage:false});expect(c.spellcasting.barbarian!.reckless).toBe(false);
  });
  it("removes basic rage and speed benefits in heavy armor but retains explicitly unrestricted bear resistance",async () => {
    const original=await barbarianAt(6,"totem-warrior"),c=structuredClone(original);c.inventory.push({...PHB_EQUIPMENT["chain-mail"]!,id:"inv_00000000000000000000000000000009",order:c.inventory.length,group:"Prueba",quantity:1,equipped:true,attuned:false});
    expect(projectUpdatedBuilderSpeed(original,c)).toBe("30 ft");const raging=await perform(c,{kind:"rage"}),axe=raging.actions.find((a) => a.inventoryItemId)!;
    expect(projectActionDamageBonus(raging,axe)).toBe(axe.damageBonus);expect(projectAdjustedRollMode(raging,"saves",["strength"],"normal")).toBe("normal");expect(barbarianResistances(raging)).toContain("fire");expect(barbarianResistances(raging)).not.toContain("psychic");
  });
  it("applies frenzy exhaustion exactly once, even if removed via conditions, and orders long-rest recovery correctly",async () => {
    let c=await barbarianAt(3);c=await perform(c,{kind:"rage",frenzy:true});const condition=c.combat.conditions.find((p) => p.key==="raging")!;c=resource(c,{kind:"remove-condition",conditionId:condition.id});expect(c.combat.exhaustion).toBe(1);c=await perform(c,{kind:"end-rage"});expect(c.combat.exhaustion).toBe(1);
    c=await perform(c,{kind:"rage",frenzy:true});c=resource(c,{kind:"long-rest"});expect(c.combat.exhaustion).toBe(1); // +1 at frenzy end, then -1 from rest
    c=await perform(c,{kind:"rage",frenzy:true});c=resource(c,{kind:"add-condition",conditionId:"cnd_00000000000000000000000000000003",key:"unconscious",label:"Inconsciente",level:null,addedAt:at});expect(c.combat.exhaustion).toBe(2);expect(barbarianRaging(c)).toBe(false);
    await expect(perform(await barbarianAt(3,"zealot"),{kind:"rage",frenzy:true})).rejects.toThrow(/Berserker/);
  });
  it("suspends existing fear during mindless rage and rejects new fear until it ends",async () => {
    let c=await barbarianAt(6);c=resource(c,{kind:"add-condition",conditionId:"cnd_00000000000000000000000000000004",key:"frightened",label:"Asustado",level:null,addedAt:at});const axe=c.actions.find((a) => a.inventoryItemId)!;expect(projectActionRollMode(c,axe)).toBe("disadvantage");
    c=await perform(c,{kind:"rage"});expect(projectActionRollMode(c,axe)).toBe("normal");expect(c.combat.conditions.some((p) => p.key==="frightened")).toBe(true);
    expect(() => resource(c,{kind:"add-condition",conditionId:"cnd_00000000000000000000000000000005",key:"charmed",label:"Hechizado",level:null,addedAt:at})).toThrow(/inmune/);c=await perform(c,{kind:"end-rage"});expect(projectActionRollMode(c,axe)).toBe("disadvantage");
  });
  it("uses an increasing relentless rage DC with resource damage and rest resets",async () => {
    let c=await barbarianAt(11);c=await perform(c,{kind:"rage"});c=resource(c,{kind:"damage",amount:c.combat.hitPoints.maximum});expect(c.spellcasting.barbarian!.relentlessPending).toBe(true);expect(barbarianRaging(c)).toBe(true);
    c=await perform(c,{kind:"relentless-rage",saveTotal:10,notInstantDeath:true});expect(c.combat.hitPoints.current).toBe(1);expect(c.spellcasting.barbarian!.relentlessDc).toBe(15);
    c=resource(c,{kind:"damage",amount:1});c=await perform(c,{kind:"relentless-rage",saveTotal:14,notInstantDeath:true});expect(c.combat.hitPoints.current).toBe(0);expect(c.spellcasting.barbarian!.relentlessDc).toBe(20);expect(barbarianRaging(c)).toBe(false);
    c=resource(c,{kind:"short-rest"});expect(c.spellcasting.barbarian!.relentlessDc).toBe(10);
  });
  it("limits fanatical focus per rage, presence per long rest and keeps zealots conscious at zero HP",async () => {
    let c=await barbarianAt(14,"zealot");c=await perform(c,{kind:"rage"});c=await perform(c,{kind:"fanatical-focus",failedSave:true});await expect(perform(c,{kind:"fanatical-focus",failedSave:true})).rejects.toThrow(/Enfoque/);
    c=await perform(c,{kind:"zealous-presence"});await expect(perform(c,{kind:"zealous-presence"})).rejects.toThrow(/Presencia/);
    c=resource(c,{kind:"damage",amount:c.combat.hitPoints.maximum});expect(barbarianBeyondDeath(c)).toBe(true);c=await perform(c,{kind:"relentless-rage",saveTotal:1,notInstantDeath:true});expect(barbarianBeyondDeath(c)).toBe(true);expect(c.combat.hitPoints.current).toBe(0);
    c=resource(c,{kind:"heal",amount:1});c=await perform(c,{kind:"end-rage"});c=await perform(c,{kind:"rage"});expect(c.spellcasting.barbarian!.focusUsed).toBe(false);expect(trait(c,"fanatical-focus").uses.used).toBe(0);expect(trait(c,"zealous-presence").uses.used).toBe(1);
    c=resource(c,{kind:"long-rest"});expect(trait(c,"zealous-presence").uses.used).toBe(0);
  });
  it("supports ritual-only totem magic, cancels concentration and forbids every spell source while raging",async () => {
    let c=await barbarianAt(10,"totem-warrior");const sense=c.spellcasting.spells.find((s) => s.casting?.key==="beast-sense")!,commune=c.spellcasting.spells.find((s) => s.casting?.key==="commune-with-nature")!;
    c=castCharacterSpell(c,commune.id,5,{expectedRevision:c.revision,updatedAt:at,mode:"ritual"});expect(Object.values(c.spellcasting.slots).every((s) => s.used===0 && s.maximum===0)).toBe(true);
    c=castCharacterSpell(c,sense.id,2,{expectedRevision:c.revision,updatedAt:at,mode:"ritual",concentrationCondition:{id:"cnd_00000000000000000000000000000006",key:"concentration",label:"Concentración",level:null,addedAt:at}});expect(c.combat.conditions.some((p) => p.key==="concentration")).toBe(true);c=await perform(c,{kind:"rage"});expect(c.combat.conditions.some((p) => p.key==="concentration")).toBe(false);
    expect(() => castCharacterSpell(c,sense.id,2,{expectedRevision:c.revision,updatedAt:at,mode:"ritual"})).toThrow(/furia/);expect(() => removeCharacterSpell(c,sense.id,{expectedRevision:c.revision,updatedAt:at})).toThrow(/historial/);expect(() => setCharacterSpellPrepared(c,sense.id,false,{expectedRevision:c.revision,updatedAt:at})).toThrow(/preparación/);
    const creation=barbarianCreation("high-elf"),elf=await createGuidedBarbarian(c.id,"build_00000000000000000000000000000001",creation,at),raging=await perform(elf,{kind:"rage"}),racial=raging.spellcasting.spells.find((s) => s.level===0)!;expect(() => castCharacterSpell(raging,racial.id,0,{expectedRevision:raging.revision,updatedAt:at})).toThrow(/furia/);
  });
  it("shares ancestral consultation uses, removes material components and restores after either rest",async () => {
    let c=await barbarianAt(10,"ancestral-guardian");const augury=c.spellcasting.spells.find((s) => s.casting?.key==="augury")!,clairvoyance=c.spellcasting.spells.find((s) => s.casting?.key==="clairvoyance")!;expect(augury.casting!.traitId).toBe(clairvoyance.casting!.traitId);expect(augury.definition!.components).not.toContain("M");expect(clairvoyance.definition!.concentration).toBe(true);
    c=castCharacterSpell(c,augury.id,2,{expectedRevision:c.revision,updatedAt:at});expect(trait(c,"consult-spirits").uses.used).toBe(1);expect(() => castCharacterSpell(c,clairvoyance.id,3,{expectedRevision:c.revision,updatedAt:at})).toThrow(/usos/);c=resource(c,{kind:"short-rest"});c=castCharacterSpell(c,clairvoyance.id,3,{expectedRevision:c.revision,updatedAt:at});expect(trait(c,"consult-spirits").uses.used).toBe(1);
  });
});
