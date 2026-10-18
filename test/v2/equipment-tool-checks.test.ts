import {describe,expect,it,vi} from "vitest";
import {Window} from "happy-dom";
import definitions from "../../docs/v2/equipment-retirement-2026-10-18/tools-context-definitions.json";
import {EquipmentDefinitionDraftSchema} from "../../src/domain/equipment/equipment-definition";
import {normalizeEquipmentDefinition} from "../../src/domain/equipment/equipment-catalog";
import {bindReviewedEquipment} from "../../src/domain/equipment/equipment-live";
import {createCharacter} from "../../src/domain/character/create-character";
import {projectEquipmentToolCheck} from "../../src/domain/equipment/equipment-tool-checks";
import {bindEquipmentToolChecks,renderEquipmentToolCheck} from "../../src/ui/equipment-tool-checks";
import {resolveAbilityCheckRoll} from "../../src/domain/dice/ability-check-roll";
import {TaleSpireDiceRoller} from "../../src/infrastructure/talespire/talespire-dice-roller";
import {BrowserDiceRoller} from "../../src/infrastructure/dice/browser-dice-roller";
import type {CharacterV2} from "../../src/domain/character/character-v2";
import type {DiceRollRequest} from "../../src/application/ports/dice-roller";

function fixture(name="Herramientas de ladrón") {
 const c=createCharacter("chr_11111111111111111111111111111111","Herramientas","2026-10-18T19:00:00.000Z"),d=EquipmentDefinitionDraftSchema.parse(definitions.find(d=>d.name===name));
 const item=bindReviewedEquipment({...normalizeEquipmentDefinition({name:d.name}),id:"inv_11111111111111111111111111111111",order:0,group:"Mochila",quantity:1},d);
 c.inventory=[item];c.abilities.dexterity=16;c.abilities.intelligence=14;c.identity.level=5;c.combat.hitPoints.current=10;
 return{c,item};
}
describe("tools, instruments and games use actual character proficiencies",()=>{
 it("never grants proficiency for merely owning a tool; accepts different GM-selected abilities",()=>{
  const{c,item}=fixture();expect(projectEquipmentToolCheck(c,item,"dexterity")).toMatchObject({rank:0,modifier:3,minimum:1});
  c.proficiencies.tools=["thieves-tools"];
  expect(projectEquipmentToolCheck(c,item,"intelligence")).toMatchObject({rank:1,modifier:5});
  expect(projectEquipmentToolCheck(c,item,"dexterity")).toMatchObject({rank:1,modifier:6});
  item.quantity=0;expect(()=>projectEquipmentToolCheck(c,item,"dexterity")).toThrow(/unidad/);
 });
 it("matches Spanish builder aliases and keeps cook's utensils distinct from a mess kit",()=>{
  const{c,item}=fixture("Útiles de cocinero");c.proficiencies.tools=["Utensilios de cocinero"];
  expect(projectEquipmentToolCheck(c,item,"wisdom").rank).toBe(1);
  c.proficiencies.tools=["Utensilios de cocina"];expect(projectEquipmentToolCheck(c,item,"wisdom").rank).toBe(0);
  const shawm=fixture("Chirimía");shawm.c.proficiencies.tools=["Caramillo"];expect(projectEquipmentToolCheck(shawm.c,shawm.item,"charisma").rank).toBe(1);
 });
 it("uses the same identity after personal renaming and recognizes every recovered tool",()=>{
  for(const definition of definitions){const{c,item}=fixture(definition.name);c.proficiencies.tools=[definition.name];item.name="Mi herramienta personal";expect(projectEquipmentToolCheck(c,item,"intelligence").rank).toBe(1);}
 });
 it("does not stack Jack of All Trades with full proficiency",()=>{
  const{c,item}=fixture();c.builder={classKey:"bard",levels:[]} as unknown as CharacterV2["builder"];
  expect(projectEquipmentToolCheck(c,item,"intelligence").modifier).toBe(3);
  c.proficiencies.tools=["Herramientas de ladrón"];expect(projectEquipmentToolCheck(c,item,"intelligence").modifier).toBe(5);
 });
 it("applies rogue expertise and Reliable Talent only to proficient tool checks",()=>{
  const{c,item}=fixture();c.identity.level=11;c.builder={classKey:"rogue",levels:[]} as unknown as CharacterV2["builder"];
  c.spellcasting.rogue={expertise:["thieves-tools"]} as CharacterV2["spellcasting"]["rogue"];
  expect(projectEquipmentToolCheck(c,item,"dexterity")).toMatchObject({rank:2,modifier:11,minimum:10});
  const other=fixture("Herramientas de carpintero").item;
  expect(projectEquipmentToolCheck(c,other,"intelligence")).toMatchObject({rank:0,minimum:1});
  c.proficiencies.tools=["Herramientas de carpintero"];expect(projectEquipmentToolCheck(c,other,"intelligence")).toMatchObject({rank:1,minimum:10});
 });
 it("lets advantage and poisoned disadvantage cancel without changing proficiency",()=>{
  const{c,item}=fixture();c.combat.conditions=[{id:"cnd_11111111111111111111111111111111",key:"poisoned",label:"Envenenado",level:null,addedAt:"2026-10-18T19:00:00.000Z"}];
  expect(projectEquipmentToolCheck(c,item,"dexterity").mode).toBe("disadvantage");
  expect(projectEquipmentToolCheck(c,item,"dexterity","advantage").mode).toBe("normal");
 });
 it("binds selectors without remounting and gates incapacity",()=>{
  const{c,item}=fixture(),window=new Window(),root=window.document.body as unknown as HTMLElement;root.innerHTML=renderEquipmentToolCheck(item);bindEquipmentToolChecks(root,()=>c);
  const ability=root.querySelector<HTMLSelectElement>("[data-tool-ability]")!,button=root.querySelector<HTMLButtonElement>("[data-tool-roll]")!;
  expect(button.disabled).toBe(true);ability.value="intelligence";ability.dispatchEvent(new window.Event("change") as unknown as Event);
  expect(button.disabled).toBe(false);expect(button.dataset.rollCheckModifier).toBe("2");expect(root.querySelector("[data-tool-ability]")).toBe(ability);
  c.combat.hitPoints.current=0;ability.dispatchEvent(new window.Event("change") as unknown as Event);expect(button.disabled).toBe(true);
 });
});

describe("natural d20 minimum across dice backends",()=>{
 const request:DiceRollRequest={name:"Herramientas · Talento Seguro",expressions:["1d20","1d4"],mode:"advantage",abilityCheck:{minimum:10,modifier:7}};
 it("applies the minimum before Guidance and the proficiency modifier",()=>{
  expect(resolveAbilityCheckRoll(request,[3,2])).toEqual([19]);expect(resolveAbilityCheckRoll(request,[18,2])).toEqual([27]);
  expect(()=>resolveAbilityCheckRoll(request,[3])).toThrow(/todos/);
  expect(()=>resolveAbilityCheckRoll({...request,expressions:["1d20+7","1d4"]},[3,2])).toThrow(/inválida/);
 });
 it("selects the correct TaleSpire d20, adds extra dice once, and reports the full check",async()=>{
  const resolved:{name:string;total:number}[]=[];
  const dice=new TaleSpireDiceRoller({putDiceInTray:async()=>"roll-tools",evaluateDiceResultsGroup:async g=>Number(g)});dice.subscribe(r=>resolved.push(r));
  await dice.roll(request);await dice.handleRollEvent({kind:"rollResults",payload:{rollId:"roll-tools",resultsGroups:[2,5,3]}});
  expect(resolved).toEqual([{name:request.name,total:20}]);
  await dice.roll({...request,mode:"disadvantage"});await dice.handleRollEvent({kind:"rollResults",payload:{rollId:"roll-tools",resultsGroups:[18,15,2]}});
  expect(resolved[1]!.total).toBe(24);
 });
 it("applies the same minimum and extra dice in browser rolls",async()=>{
  const random=vi.spyOn(globalThis.crypto,"getRandomValues").mockImplementation(buffer=>{if(buffer)new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength).fill(0);return buffer;});
  try{expect((await new BrowserDiceRoller().roll(request)).totals).toEqual([18]);}finally{random.mockRestore();}
 });
});
