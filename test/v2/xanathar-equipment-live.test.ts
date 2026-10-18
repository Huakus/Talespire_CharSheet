import {describe,it,expect} from "vitest";
import definitions from "../../docs/v2/equipment-preparation-2026-10-17/xanathar-reviewed-definitions.json";
import reviewed from "../../docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json";
import variants from "../../docs/v2/equipment-preparation-2026-10-17/srd-variant-runtime-examples.json";
import {EquipmentDefinitionDraftSchema} from "../../src/domain/equipment/equipment-definition";
import {bindReviewedEquipment} from "../../src/domain/equipment/equipment-live";
import {createCharacter} from "../../src/domain/character/create-character";
import {useInventoryFeature,recoverInventoryItem,setInventoryItemAttuned,inventoryItemsCanStack,spendInventoryItemCharges,consumeInventoryUnit} from "../../src/domain/character/character-inventory";
import {projectAbilityScore,projectSpellcasting,projectCharacterStatistics,projectAbilityCheckModifier,projectActionAttackModifier,projectActionDamageBonus} from "../../src/domain/character/character-projection";
import {CharacterActionV2Schema} from "../../src/domain/character/character-action-model";
import {syncInventorySpellGrants,itemSpellState} from "../../src/domain/character/item-spells";
const time="2026-10-18T12:00:00.000Z",itemId="inv_11111111111111111111111111111111";
const raw=(quantity=1)=>({id:itemId,order:0,group:"Mochila",name:"Anterior",quantity,unitWeight:0,cost:{quantity:0,unit:"gp"},category:"adventuring-gear",description:"",properties:[],equipped:true,attuned:false,requiresAttunement:false,usable:false,consumable:false,charges:null,armor:null,weapon:null,bonuses:[],features:[],effect:{active:false,description:""},catalog:null});
const c=()=>createCharacter("chr_11111111111111111111111111111111","Prueba",time);
const options=(revision:number)=>({expectedRevision:revision,updatedAt:time});
const d=(name:string)=>EquipmentDefinitionDraftSchema.parse(definitions.find((d)=>d.name===name));
describe("Xanathar item resources and transferable grants",()=>{
 it("caps Ioun bonuses at twenty without lowering a higher score",()=>{
  const character=c();character.abilities.intelligence=19;
  const definition=EquipmentDefinitionDraftSchema.parse(variants.find((d)=>d.name==="Piedra Ioun (Intelecto)"));
  const item=bindReviewedEquipment(raw(),definition);item.attuned=true;character.inventory=[item];
  expect(projectAbilityScore(character,"intelligence")).toBe(20);
  character.abilities.intelligence=22;expect(projectAbilityScore(character,"intelligence")).toBe(22);
 });
 it("keeps variable charge spending bounded and records whole-unit consumption separately",()=>{
  let character=c();const item=bindReviewedEquipment(raw(),d("Bastón de Flores"));item.charges!.current=8;character.inventory=[item];
  expect(()=>spendInventoryItemCharges(character,itemId,9,options(character.revision))).toThrow("reserva");
  character=spendInventoryItemCharges(character,itemId,3,options(character.revision));expect(character.inventory[0]!.charges!.current).toBe(5);
  character.inventory=[bindReviewedEquipment(raw(2),d("Cuenta de Alimentación"))];
  character=consumeInventoryUnit(character,itemId,options(character.revision));expect(character.inventory[0]!.quantity).toBe(1);
  character=consumeInventoryUnit(character,itemId,options(character.revision));expect(character.inventory).toEqual([]);
 });
 it("applies a spell attack bonus to attacks, and luck to checks and saves without inflating scores",()=>{
  const character=c();character.identity.className="Mago";
  const wand=bindReviewedEquipment(raw(),EquipmentDefinitionDraftSchema.parse(variants.find((d)=>d.name==="Varita del mago de guerra +2")));wand.attuned=true;character.inventory=[wand];
  expect(projectSpellcasting(character).attackModifier).toBe(4);expect(projectSpellcasting(character).saveDc).toBe(10);
  const stone=bindReviewedEquipment({...raw(),id:"inv_22222222222222222222222222222222"},EquipmentDefinitionDraftSchema.parse(variants.find((d)=>d.name.startsWith("Piedra de la buena fortuna"))));stone.attuned=true;character.inventory=[stone];
  expect(projectAbilityScore(character,"strength")).toBe(10);expect(projectAbilityCheckModifier(character,"strength")).toBe(1);expect(projectCharacterStatistics(character).savingThrows.strength).toBe(1);expect(projectCharacterStatistics(character).skills.athletics).toBe(1);
 });
 it("withholds only the verified magical weapon bonus until attunement",()=>{
  const character=c();const item=bindReviewedEquipment(raw(),EquipmentDefinitionDraftSchema.parse(variants.find((d)=>d.name.startsWith("Defensora"))));character.inventory=[item];
  const action=CharacterActionV2Schema.parse({id:"act_11111111111111111111111111111111",order:0,name:"Espada",categories:["attack"],activation:"action",ability:"strength",proficient:true,attackBonus:3,damageExpression:"1d8",damageBonus:3,damageType:"cortante",reach:"5 pies",weaponType:"melee",properties:"",description:"",rollMode:"normal",inventoryItemId:itemId,effect:{active:false,description:""}});
  expect(projectActionAttackModifier(character,action)).toBe(2);expect(projectActionDamageBonus(character,action)).toBe(0);
  item.attuned=true;expect(projectActionAttackModifier(character,action)).toBe(5);expect(projectActionDamageBonus(character,action)).toBe(3);
 });
 it("recovers the rolled amount at dawn, preserves exhaustion and exposes the last-charge consequence",()=>{
  let character=c();const item=bindReviewedEquipment(raw(),d("Bastón de Flores"));
  item.charges!.current=1;character.inventory=[item];
  character=useInventoryFeature(character,itemId,"xanathar-property",options(character.revision));
  expect(character.inventory[0]!.charges!.current).toBe(0);
  expect(character.inventory[0]!.rules!.pending.some((s)=>s.includes("última carga"))).toBe(true);
  expect(()=>recoverInventoryItem(character,itemId,"dawn",4,options(character.revision))).toThrow("1d6+4");
  character=recoverInventoryItem(character,itemId,"dawn",7,options(character.revision));
  expect(character.inventory[0]!.charges!.current).toBe(7);
 });
 it("checks the required class both at attunement and when a stale attuned copy is used",()=>{
  let character=c();character.identity.className="Guerrero";const item=bindReviewedEquipment(raw(),d("Sombrero de Magia"));item.charges!.current=1;character.inventory=[item];
  expect(()=>setInventoryItemAttuned(character,itemId,true,options(character.revision))).toThrow("mago");
  character.inventory[0]!.attuned=true;
  expect(()=>useInventoryFeature(character,itemId,"xanathar-property",options(character.revision))).toThrow("mago");
 });
 it("consumes a bead once, and does not add an action to the clockwork trigger",()=>{
  let character=c();character.inventory=[bindReviewedEquipment(raw(2),d("Cuenta de Alimentación"))];
  character=useInventoryFeature(character,itemId,"xanathar-property",options(character.revision));
  expect(character.inventory[0]!.quantity).toBe(1);
  character=useInventoryFeature(character,itemId,"xanathar-property",options(character.revision));expect(character.inventory).toEqual([]);
  expect(d("Amuleto de Relojería").capabilities[0]!.activation).toBe("trigger");
 });
 it("moves item spell access with ownership without teaching either class, and keeps rings separate",async()=>{
  const definition=EquipmentDefinitionDraftSchema.parse(reviewed.find((d)=>d.name==="Collar de hablar con los muertos"));
  const owner=c();owner.inventory=[bindReviewedEquipment(raw(),definition)];await syncInventorySpellGrants(owner);
  expect(owner.spellcasting.spells).toHaveLength(1);expect(itemSpellState(owner,owner.spellcasting.spells[0]!).available).toBe(false);
  const recipient=c();recipient.id="chr_22222222222222222222222222222222";recipient.inventory=owner.inventory;owner.inventory=[];
  await syncInventorySpellGrants(owner);await syncInventorySpellGrants(recipient);
  expect(owner.spellcasting.spells).toEqual([]);expect(recipient.spellcasting.spells).toHaveLength(1);expect(recipient.spellcasting.spells[0]!.casting!.kind).toBe("item");
  const ring=bindReviewedEquipment(raw(),EquipmentDefinitionDraftSchema.parse(reviewed.find((d)=>d.name==="Anillo de almacenamiento de conjuros")));ring.equipped=false;
  expect(inventoryItemsCanStack(ring,{...ring,id:"inv_22222222222222222222222222222222"})).toBe(false);
 });
});
