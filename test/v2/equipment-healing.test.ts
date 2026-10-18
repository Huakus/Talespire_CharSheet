import { describe, expect, it } from "vitest";
import reviewed from "../../docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { inventoryHealingExpression } from "../../src/domain/equipment/equipment-healing";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { createCharacter } from "../../src/domain/character/create-character";
import { useInventoryHealingFeature } from "../../src/domain/character/character-inventory";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import type { CharacterInventoryItemV2, InventoryFeature } from "../../src/domain/character/character-inventory-model";
const now="2026-10-18T16:00:00.000Z", id="inv_11111111111111111111111111111111";
function fixture(quantity=2) {
 const c=createCharacter("chr_11111111111111111111111111111111","Prueba",now), definition=EquipmentDefinitionDraftSchema.parse(reviewed.find((d)=>d.name==="Poción de curación"));
 c.combat.hitPoints={current:8,maximum:20,temporary:3};
 c.inventory=[bindReviewedEquipment(CharacterInventoryItemV2Schema.parse({id,order:0,group:"Mochila",name:definition.name,quantity,unitWeight:0.5,cost:{quantity:50,unit:"gp"},category:"potion",description:"",properties:[],equipped:false,attuned:false,requiresAttunement:false,usable:false,consumable:true,charges:null,armor:null,weapon:null,bonuses:[]}),definition)];
 return {c,feature:c.inventory[0]!.features.find((f)=>inventoryHealingExpression(c.inventory[0]!,f.id))!.id,options:{expectedRevision:c.revision,updatedAt:now}};
}
describe("consume and heal atomically",()=>{
 it("consumes one potion and applies its roll without altering temporary HP",()=>{
  const {c,feature,options}=fixture();const next=useInventoryHealingFeature(c,id,feature,7,options);
  expect(next.inventory[0]!.quantity).toBe(1);expect(next.combat.hitPoints).toEqual({current:15,maximum:20,temporary:3});expect(next.revision).toBe(c.revision+1);
  expect(c.inventory[0]!.quantity).toBe(2);expect(c.combat.hitPoints.current).toBe(8);
 });
 it("rejects impossible dice totals without consuming anything",()=>{
  const {c,feature,options}=fixture();expect(()=>useInventoryHealingFeature(c,id,feature,11,options)).toThrow(/2d4/);
  expect(()=>useInventoryHealingFeature(c,id,feature,3,options)).toThrow(/2d4/);expect(c.inventory[0]!.quantity).toBe(2);
 });
 it("removes the final unit and caps healing at maximum HP",()=>{
  const {c,feature,options}=fixture(1);c.combat.hitPoints.current=19;const next=useInventoryHealingFeature(c,id,feature,10,options);
  expect(next.inventory).toEqual([]);expect(next.combat.hitPoints.current).toBe(20);
 });
 it("does not let an unconscious bearer drink a potion as an action",()=>{
  const {c,feature,options}=fixture();c.combat.hitPoints.current=0;
  expect(()=>useInventoryHealingFeature(c,id,feature,6,options)).toThrow(/otra criatura/);expect(c.inventory[0]!.quantity).toBe(2);
 });

 it("offers self-healing only for an owned potion and disables it when the bearer cannot act",()=>{
  const {c,feature}=fixture(),potion=c.inventory[0]!;
  const view=new BrowserApp({}as HTMLElement,new CampaignApplication(new InMemoryCampaignRepository()),{storageLabel:"test",diceRoller:{roll:async()=>({kind:"rolled",summary:"ok",totals:[6]})}}) as unknown as {
   snapshot:{campaign:{characters:Record<string,typeof c>}};selectedCharacterId:string;
   renderInventoryFeatureCapability(item:CharacterInventoryItemV2,feature:InventoryFeature):string;
  };
  view.snapshot={campaign:{characters:{[c.id]:c}}};view.selectedCharacterId=c.id;
  const cap=potion.features.find((f)=>f.id===feature)!;
  expect(view.renderInventoryFeatureCapability(potion,cap).match(/<button[^>]*data-equipment-self-healing[^>]*>/)?.[0]).not.toContain("disabled");
  c.combat.hitPoints.current=0;
  expect(view.renderInventoryFeatureCapability(potion,cap).match(/<button[^>]*data-equipment-self-healing[^>]*>/)?.[0]).toContain("disabled");
  c.inventory=[];expect(view.renderInventoryFeatureCapability(potion,cap)).not.toContain("data-equipment-self-healing");
 });
});
