import{describe,it,expect}from"vitest";
import{readFileSync}from"node:fs";
import{createCharacter}from"../../src/domain/character/create-character";
import{CharacterInventoryItemV2Schema}from"../../src/domain/character/character-inventory-model";
import{CharacterActionV2Schema}from"../../src/domain/character/character-action-model";
import{projectWeaponHitDamage}from"../../src/domain/equipment/equipment-weapon-effects";
import{setInventoryFeatureActive,setInventoryItemEquipped}from"../../src/domain/character/character-inventory";
import {Window} from "happy-dom";
import {BrowserApp} from "../../src/ui/browser-app";
import {CampaignApplication} from "../../src/application/campaign/campaign-application";
import {InMemoryCampaignRepository} from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import {createTestCampaign} from "../fixtures/native-campaign";
import type {DiceRollRequest} from "../../src/application/ports/dice-roller";
const rows=Array.from({length:10},(_,i)=>JSON.parse(readFileSync(`docs/v2/equipment-functional-audit-2026-11-01/catalog-${String(i).padStart(2,"0")}.json`,"utf8"))).flat();
function fixture(name:string){const r=rows.find(r=>r.name===name),c=createCharacter("chr_11111111111111111111111111111111","Prueba","2026-11-01T15:00:00.000Z");c.abilities.strength=14;c.inventory=[CharacterInventoryItemV2Schema.parse({...r.payload,id:"inv_11111111111111111111111111111111",order:0,group:"Mochila",equipped:true,attuned:true,rules:{...r.payload.rules,original:{}}})];const a=CharacterActionV2Schema.parse({id:"act_11111111111111111111111111111111",order:0,name,categories:["attack"],activation:"Acción",reach:"5 pies",ability:"strength",proficient:true,attackBonus:0,damageExpression:c.inventory[0]!.weapon!.damageExpression,damageBonus:2,damageType:"cortante",weaponType:"",properties:"",description:"",inventoryItemId:c.inventory[0]!.id,rollMode:"normal"});return{c,a};}
describe("Daño vinculado a las propiedades reales del arma",()=>{
 it("añade siete únicamente al 20 natural y no duplica el valor fijo con el crítico",()=>{const{c,a}=fixture("Alabarda feroz");expect(projectWeaponHitDamage(c,a,"hit").map(r=>r.expression)).toEqual(["1d10+2"]);expect(projectWeaponHitDamage(c,a,"critical").map(r=>r.expression)).toEqual(["2d10+2"]);expect(projectWeaponHitDamage(c,a,"natural-20").map(r=>r.expression)).toEqual(["2d10+2","7"]);});
 it("el daño de fuego depende de encender la espada y duplica los dados al criticar",()=>{let{c,a}=fixture("Espadón de lengua de fuego");const item=c.inventory[0]!;item.features.find(f=>f.id==="flaming-toggle")!.toggleable=true;
  expect(projectWeaponHitDamage(c,a,"hit")).toHaveLength(1);c=setInventoryFeatureActive(c,item.id,"flaming-toggle",true,{expectedRevision:c.revision,updatedAt:c.metadata.updatedAt});expect(projectWeaponHitDamage(c,a,"critical").map(r=>r.expression)).toEqual(["4d6+2","4d6"]);
  c=setInventoryItemEquipped(c,item.id,false,{expectedRevision:c.revision,updatedAt:c.metadata.updatedAt});expect(c.inventory[0]!.features.find(f=>f.id==="flaming-toggle")!.active).toBe(false);expect(()=>projectWeaponHitDamage(c,a,"hit")).toThrow(/equipada/);
 });
 it("el control de la tarjeta envía el daño correcto al servicio de dados",async()=>{
  const{c,a}=fixture("Alabarda feroz");c.actions=[a];const doc=new Window().document,root=doc.createElement("div"),requests:DiceRollRequest[]=[];
  const app=new BrowserApp(root as unknown as HTMLElement,new CampaignApplication(new InMemoryCampaignRepository()),{storageLabel:"test",diceRoller:{roll:async request=>{requests.push(request);return{kind:"rolled",totals:[10,7],summary:"17"};}}});
  const view=app as unknown as {snapshot:unknown;selectedCharacterId:string;renderActionsPlay(actor:typeof c):string;rollDice(button:HTMLButtonElement):Promise<void>;render():void};
  view.snapshot={campaign:createTestCampaign({character:c}),checksum:"test"};view.selectedCharacterId=c.id;view.render=()=>{};
  root.innerHTML=view.renderActionsPlay(c);const outcome=root.querySelector("[data-weapon-hit-outcome]")! as unknown as HTMLSelectElement;outcome.value="natural-20";
  const button=root.querySelector('[data-combat-roll="damage"]')! as unknown as HTMLButtonElement;button.disabled=false;
  await view.rollDice(button);expect(requests).toHaveLength(1);expect(requests[0]!.expressions).toEqual(["2d10+2","7"]);
 });
});
