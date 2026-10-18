import {describe,it,expect} from "vitest";
import native from "../../docs/v2/equipment-retirement-2026-10-18/final-native-definitions.json";
import {EquipmentDefinitionDraftSchema} from "../../src/domain/equipment/equipment-definition";
import {bindReviewedEquipment} from "../../src/domain/equipment/equipment-live";
import {normalizeEquipmentDefinition} from "../../src/domain/equipment/equipment-catalog";
import {createCharacter} from "../../src/domain/character/create-character";
import {useInventoryFeature,recoverInventoryItem,resetInventoryCharges} from "../../src/domain/character/character-inventory";
import {equipmentClassResourceIssue} from "../../src/domain/equipment/equipment-class-resources";
import {BrowserApp} from "../../src/ui/browser-app";
import {CampaignApplication} from "../../src/application/campaign/campaign-application";
import {InMemoryCampaignRepository} from "../../src/infrastructure/persistence/in-memory-campaign-repository";
const now="2026-10-18T21:00:00.000Z",id="inv_11111111111111111111111111111111",traitId="trt_11111111111111111111111111111111";
function fixture(){const c=createCharacter("chr_11111111111111111111111111111111","Bardo",now);c.identity.className="Bardo";c.combat.hitPoints={current:8,maximum:8,temporary:0};
 const d=EquipmentDefinitionDraftSchema.parse(native.find(d=>d.name==='Tambor del creador de ritmos +1'));
 c.inventory=[bindReviewedEquipment({...normalizeEquipmentDefinition({name:d.name}),id,order:0,group:"Mochila",quantity:1,equipped:true,attuned:true,charges:{current:1,maximum:1,reset:"dawn"}},d)];
 c.traits=[{id:"trg_11111111111111111111111111111111",order:0,title:"Clase",collapsed:false,traits:[{id:traitId,order:0,name:"Inspiración de Bardo",description:"",collapsed:false,uses:{used:2,maximum:3,reset:"short-rest"},adjustment:null,effect:{active:false,description:""}}]}];
 c.spellcasting.bard={inspirationId:traitId,actions:[]};return c;}
const opts=(c:ReturnType<typeof fixture>)=>({expectedRevision:c.revision,updatedAt:now});
describe("native item recovery of class resources",()=>{
 it("restores exactly one inspiration and spends the daily item use atomically",()=>{const c=fixture(),next=useInventoryFeature(c,id,'daily-property',opts(c));expect(next.traits[0]!.traits[0]!.uses.used).toBe(1);expect(next.inventory[0]!.charges!.current).toBe(0);expect(next.revision).toBe(c.revision+1);expect(c.traits[0]!.traits[0]!.uses.used).toBe(2);expect(()=>useInventoryFeature(next,id,'daily-property',opts(next))).toThrow(/carga/);});
 it("does not spend the drum when inspiration is full, the pool is missing, or the bearer cannot act",()=>{for(const kind of ['full','missing','incapacitated']){const c=fixture();if(kind==='full')c.traits[0]!.traits[0]!.uses.used=0;if(kind==='missing')c.traits=[];if(kind==='incapacitated')c.combat.hitPoints.current=0;expect(equipmentClassResourceIssue(c,c.inventory[0]!,'daily-property')).not.toBe('');expect(()=>useInventoryFeature(c,id,'daily-property',opts(c))).toThrow();expect(c.inventory[0]!.charges!.current).toBe(1);}});
 it("requires attunement and restores the item at dawn, not on a short or long rest",()=>{const c=fixture();c.inventory[0]!.attuned=false;expect(()=>useInventoryFeature(c,id,'daily-property',opts(c))).toThrow(/sintonizado/);c.inventory[0]!.attuned=true;const spent=useInventoryFeature(c,id,'daily-property',opts(c));for(const reset of ['short-rest','long-rest'])expect(resetInventoryCharges(spent,reset,opts(spent)).inventory[0]!.charges!.current).toBe(0);const next=recoverInventoryItem(spent,id,'dawn',undefined,opts(spent));expect(next.inventory[0]!.charges!.current).toBe(1);expect(next.traits[0]!.traits[0]!.uses.used).toBe(1);});
 it("accepts one legacy class pool and rejects ambiguous counters",()=>{const c=fixture();c.spellcasting.bard=null;expect(useInventoryFeature(c,id,'daily-property',opts(c)).traits[0]!.traits[0]!.uses.used).toBe(1);c.traits[0]!.traits.push({...structuredClone(c.traits[0]!.traits[0]!),id:'trt_22222222222222222222222222222222'});expect(()=>useInventoryFeature(c,id,'daily-property',opts(c))).toThrow(/reserva/);});
 it("disables the UI button with a concrete explanation when nothing can be restored",()=>{const c=fixture();c.traits[0]!.traits[0]!.uses.used=0;const app=new BrowserApp({}as HTMLElement,new CampaignApplication(new InMemoryCampaignRepository()),{storageLabel:'test',diceRoller:{roll:async()=>({kind:'rolled',summary:'ok',totals:[1]})}}) as unknown as {snapshot:unknown;selectedCharacterId:string;renderInventoryFeatureCapability(i:typeof c.inventory[number],f:typeof c.inventory[number]['features'][number]):string};app.snapshot={campaign:{characters:{[c.id]:c}}};app.selectedCharacterId=c.id;const item=c.inventory[0]!,html=app.renderInventoryFeatureCapability(item,item.features.find(f=>f.id==='daily-property')!);expect(html.match(/<button[^>]*data-inventory-feature-action="use"[^>]*>/)?.[0]).toMatch(/disabled/);expect(html).toContain('Ya tenés todos los usos');});
});
