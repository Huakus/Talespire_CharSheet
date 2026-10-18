import { describe, expect, it } from "vitest";
import resolved from "../../docs/v2/equipment-preparation-2026-10-17/campaign-resolution-definitions.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { lucentCoreState } from "../../src/domain/equipment/equipment-lucent-core";
import { createCharacter } from "../../src/domain/character/create-character";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { serializeEquipmentContentPayload, serializeMonsterContentPayload } from "../../src/domain/content/content-payload";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { performLucentCoreAction, recoverInventoryItem, resetInventoryItemResources, setInventoryItemAttuned, spendInventoryItemCharges, useInventoryFeature } from "../../src/domain/character/character-inventory";

const now="2026-10-18T16:00:00.000Z", id="inv_11111111111111111111111111111111";
const definitions=resolved.map((d)=>EquipmentDefinitionDraftSchema.parse(d));
const item=(name:string)=>bindReviewedEquipment(CharacterInventoryItemV2Schema.parse({id,order:0,group:"Mochila",name,quantity:1,unitWeight:1,cost:{quantity:1,unit:"gp"},category:"wondrous-item",description:"",properties:[],equipped:true,attuned:true,requiresAttunement:false,usable:false,consumable:false,charges:{current:3,maximum:3,reset:"manual"},armor:null,weapon:null,bonuses:[]}),definitions.find((d)=>d.name===name)!);
const character=()=>{const c=createCharacter("chr_11111111111111111111111111111111","Prueba",now);c.proficiencies.tools=["Herramientas de hojalatero"];c.inventory=[item("Núcleo Luciente Adaptado")];return c;};
const options=(c:ReturnType<typeof character>)=>({expectedRevision:c.revision,updatedAt:now});
const configure=(c:ReturnType<typeof character>,resonance:"green"|"blue"|"violet")=>performLucentCoreAction(c,id,{kind:"configure",resonance,d20:20},options(c));

describe("GM campaign item resolution",()=>{
 it("keeps the Crimson Crystal narrative without invented charges, damage or bonuses",()=>{
  const d=definitions.find((d)=>d.name==="Cristal Carmesí")!;
  expect(d.origin).toBe("campaign");expect(d.resources).toEqual([]);expect(d.requirements.attunement).toBe(false);
  expect(d.capabilities.flatMap((c)=>c.effects).every((e)=>e.kind==="narrative")).toBe(true);
  // A stale old counter is not appropriate for a relic without resources.
  const relic=item(d.name);expect(relic.bonuses).toEqual([]);expect(relic.features.every((f)=>f.chargeCost===0)).toBe(true);
 });

 it("requires actual tool proficiency and attunement",()=>{
  const c=character();c.proficiencies.tools=[];c.inventory[0]!.attuned=false;
  expect(()=>setInventoryItemAttuned(c,id,true,options(c))).toThrow(/herramientas/);
  c.proficiencies.tools=["tinker-tools"];
  const attuned=setInventoryItemAttuned(c,id,true,options(c));
  expect(attuned.inventory[0]!.attuned).toBe(true);
 });

 it("resolves the DC 12 tool check without spending a charge on failure",()=>{
  let c=character();c.abilities.intelligence=10;
  c=performLucentCoreAction(c,id,{kind:"configure",resonance:"blue",d20:1},options(c));
  expect(lucentCoreState(c.inventory[0]!).resonance).toBeNull();expect(c.inventory[0]!.charges?.current).toBe(3);
  c=performLucentCoreAction(c,id,{kind:"configure",resonance:"blue",d20:10},options(c));
  expect(lucentCoreState(c.inventory[0]!)).toMatchObject({resonance:"blue",lastCheckTotal:12});
  expect(()=>performLucentCoreAction(c,id,{kind:"configure",resonance:"green",d20:21},options(c))).toThrow(/d20/);
 });

 it("gates resonance selection, spends charges and records durations in game rounds",()=>{
  let c=character();expect(()=>useInventoryFeature(c,id,"resonance-blue",options(c))).toThrow(/configur/);
  c=configure(c,"blue");c=useInventoryFeature(c,id,"resonance-blue",options(c));
  expect(c.inventory[0]!.charges?.current).toBe(2);expect(lucentCoreState(c.inventory[0]!)).toMatchObject({active:"blue",remainingRounds:10});
  expect(()=>useInventoryFeature(c,id,"resonance-green",options(c))).toThrow(/configur/);
  c=performLucentCoreAction(c,id,{kind:"elapsed",rounds:10},options(c));expect(lucentCoreState(c.inventory[0]!).active).toBeNull();
  c=configure(c,"green");c=useInventoryFeature(c,id,"resonance-green",options(c));expect(lucentCoreState(c.inventory[0]!).remainingRounds).toBe(100);
 });

 it("does not refill on an ordinary rest and requires both recovery qualifications",()=>{
  let c=configure(character(),"blue");c=useInventoryFeature(c,id,"resonance-blue",options(c));
  expect(resetInventoryItemResources(c.inventory[0]!,"short-rest",c).charges?.current).toBe(2);
  expect(resetInventoryItemResources(c.inventory[0]!,"long-rest",c).charges?.current).toBe(2);
  expect(()=>recoverInventoryItem(c,id,"other",undefined,options(c))).toThrow(/condicionada/);
  expect(()=>performLucentCoreAction(c,id,{kind:"recover",longRestCompleted:true,crystalInserted:false},options(c))).toThrow(/cristal/i);
  c=performLucentCoreAction(c,id,{kind:"recover",longRestCompleted:true,crystalInserted:true},options(c));expect(c.inventory[0]!.charges?.current).toBe(3);
 });

 it("resolves wear after three charges, blocks violet while unstable and validates repair materials",()=>{
  let c=configure(character(),"violet");
  for(let i=0;i<3;i++)c=useInventoryFeature(c,id,"resonance-violet",options(c));
  expect(lucentCoreState(c.inventory[0]!).wearCheckPending).toBe(true);
  expect(()=>performLucentCoreAction(c,id,{kind:"recover",longRestCompleted:true,crystalInserted:true},options(c))).toThrow(/desgaste/);
  c=performLucentCoreAction(c,id,{kind:"wear",d20:1},options(c));expect(lucentCoreState(c.inventory[0]!)).toMatchObject({unstable:true,active:null});
  c=performLucentCoreAction(c,id,{kind:"recover",longRestCompleted:true,crystalInserted:true},options(c));
  expect(()=>useInventoryFeature(c,id,"resonance-violet",options(c))).toThrow(/inestabilidad/i);
  c=configure(c,"green");c=useInventoryFeature(c,id,"resonance-green",options(c));expect(c.inventory[0]!.charges?.current).toBe(2);
  expect(()=>performLucentCoreAction(c,id,{kind:"repair",longRestCompleted:true,materialsConfirmed:false,crystalConfirmed:true},options(c))).toThrow(/25 po/);
  c=performLucentCoreAction(c,id,{kind:"repair",longRestCompleted:true,materialsConfirmed:true,crystalConfirmed:true},options(c));expect(lucentCoreState(c.inventory[0]!).unstable).toBe(false);expect(c.inventory[0]!.charges?.current).toBe(2);
  expect(()=>spendInventoryItemCharges(c,id,1,options(c))).toThrow(/resonancia/);
 });

 it("preserves the core state through JSON, catalog and merchant serialization",()=>{
  let c=configure(character(),"green");c=useInventoryFeature(c,id,"resonance-green",options(c));
  const current=c.inventory[0]!,{id:_id,order:_order,group:_group,...draft}=current;
  expect(CharacterInventoryItemV2Schema.parse(JSON.parse(JSON.stringify(current))).rules?.lucentCore).toEqual(current.rules?.lucentCore);
  expect(normalizeEquipmentDefinition(serializeEquipmentContentPayload({...draft,rarity:"uncommon"})).rules?.lucentCore).toEqual(current.rules?.lucentCore);
  expect(normalizeMonsterDefinition(serializeMonsterContentPayload(normalizeMonsterDefinition({name:"Mercader",inventory:[current]}))).inventory[0]?.rules?.lucentCore).toEqual(current.rules?.lucentCore);
  const wand=item("Varita del fastidio");expect(wand.rules).not.toHaveProperty("lucentCore");
 });

 it("applies active cold resistance before temporary HP and uses the resulting damage for concentration",()=>{
  let c=configure(character(),"blue");c=useInventoryFeature(c,id,"resonance-blue",options(c));
  c.combat.hitPoints={current:60,maximum:60,temporary:5};
  c.combat.conditions=[{id:"cnd_11111111111111111111111111111111",key:"concentration",label:"Concentración",level:null,addedAt:now}];
  const typed=applyCharacterResourceCommand(c,{kind:"damage",amount:50,damageType:"cold"},options(c));
  expect(typed.character.combat.hitPoints).toMatchObject({current:40,temporary:0});expect(typed.effects.concentrationCheckDc).toBe(12);
  const alreadyCalculated=applyCharacterResourceCommand(c,{kind:"damage",amount:25},options(c));
  expect(alreadyCalculated.character.combat.hitPoints.current).toBe(40);
  const fire=applyCharacterResourceCommand(c,{kind:"damage",amount:50,damageType:"fire"},options(c));expect(fire.character.combat.hitPoints.current).toBe(15);
  c.inventory[0]!.equipped=false;
  const removed=applyCharacterResourceCommand(c,{kind:"damage",amount:50,damageType:"cold"},options(c));expect(removed.character.combat.hitPoints.current).toBe(15);
 });

 it("uses one merged wand with a three-charge dawn pool and an explicit conditional effect",()=>{
  const wand=item("Varita del fastidio");const d=definitions.find((d)=>d.name===wand.name)!;
  expect(d.aliases).toContain("Varita de molestar");expect(d.description.some((b)=>b.type==="paragraph"&&b.text.includes("CD 14"))).toBe(true);
  expect(d.origin).toBe("campaign");expect(wand.charges).toMatchObject({current:3,maximum:3,reset:"dawn"});
  let c=character();c.inventory=[wand];c=useInventoryFeature(c,id,"annoyance",options(c));expect(c.inventory[0]!.charges?.current).toBe(2);
  expect(resetInventoryItemResources(c.inventory[0]!,"long-rest",c).charges?.current).toBe(2);
  expect(resetInventoryItemResources(c.inventory[0]!,"dawn",c).charges?.current).toBe(3);
  expect(c.inventory[0]!.rules?.pending.join(" ")).toContain("Seleccionar el objetivo");
 });
});
