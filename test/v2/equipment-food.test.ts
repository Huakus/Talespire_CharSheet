import{it,expect}from'vitest';import{readFileSync}from'node:fs';
import{createCharacter}from'../../src/domain/character/create-character';
import{normalizeEquipmentDefinition}from'../../src/domain/equipment/equipment-catalog';
import{bindReviewedEquipment}from'../../src/domain/equipment/equipment-live';
import{eatInventoryFood,useInventoryFeature}from'../../src/domain/character/character-inventory';
import{CampaignApplication}from'../../src/application/campaign/campaign-application';
import{InMemoryCampaignRepository}from'../../src/infrastructure/persistence/in-memory-campaign-repository';
import{createTestCampaign}from'../fixtures/native-campaign';
const row=JSON.parse(readFileSync('docs/v2/equipment-food-2026-11-01/reviews.json','utf8')).changes.find((r:{scope:string})=>r.scope==='ece');
const time='2026-11-01T15:00:00.000Z',id='inv_11111111111111111111111111111111';
function fixture(quantity=2){const c=createCharacter('chr_11111111111111111111111111111111','Prueba',time);c.combat.hitPoints={current:10,maximum:20,temporary:0};c.inventory=[bindReviewedEquipment(JSON.parse(JSON.stringify({...normalizeEquipmentDefinition({name:row.name}),features:row.features,id,order:0,group:'Mochila',quantity})),row.definition)];return c;}
const options=(c:{revision:number})=>({expectedRevision:c.revision,updatedAt:time});
it('comer consume una unidad y registra el día sin inventar curación ni recuperar recursos',()=>{const c=fixture(),before=JSON.stringify(c),next=eatInventoryFood(c,id,14,options(c));expect(next.inventory[0]!.quantity).toBe(1);expect(next.equipmentMeals).toEqual([{day:14,days:1,sourceItemId:id,sourceName:row.name,recordedAt:time}]);expect(next.combat).toEqual(c.combat);expect(next.spellcasting).toEqual(c.spellcasting);expect(JSON.stringify(c)).toBe(before);});
it('consumir la última ración conserva el registro de alimentación',()=>{const c=fixture(1),next=eatInventoryFood(c,id,0,options(c));expect(next.inventory).toEqual([]);expect(next.equipmentMeals[0]!.day).toBe(0);});
it('un día inválido o el uso genérico no gastan alimentos',()=>{const c=fixture(),before=JSON.stringify(c);expect(()=>eatInventoryFood(c,id,-1,options(c))).toThrow(/día/);expect(()=>useInventoryFeature(c,id,c.inventory[0]!.features[0]!.id,options(c))).toThrow(/Comer/);expect(JSON.stringify(c)).toBe(before);});
it('un reintento con el estado anterior no duplica consumo ni registro',async()=>{const c=fixture(),repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo),s=await repo.save(createTestCampaign({character:c}),{kind:'empty'}),command={characterId:c.id,itemId:id,day:1,expectedCharacterRevision:c.revision,expectedCampaignChecksum:s.checksum};const next=await app.eatInventoryFood(command);expect(next.campaign.characters[c.id]!.equipmentMeals).toHaveLength(1);await expect(app.eatInventoryFood(command)).rejects.toThrow(/conflict/i);});
