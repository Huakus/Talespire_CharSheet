import{describe,it,expect}from"vitest";
import{readFileSync}from"node:fs";
import{createCharacter}from"../../src/domain/character/create-character";
import{CharacterInventoryItemV2Schema}from"../../src/domain/character/character-inventory-model";
import{useInventoryFeature,spendInventoryItemCharges,recoverInventoryItem,resolveInventoryLastCharge,resetInventoryItemResources}from"../../src/domain/character/character-inventory";
import{syncInventorySpellGrants}from"../../src/domain/character/item-spells";
import{castCharacterSpell}from"../../src/domain/character/character-spells";
import{CampaignApplication}from"../../src/application/campaign/campaign-application";
import{InMemoryCampaignRepository}from"../../src/infrastructure/persistence/in-memory-campaign-repository";
import{createTestCampaign}from"../fixtures/native-campaign";
const rows=Array.from({length:10},(_,i)=>JSON.parse(readFileSync(`docs/v2/equipment-functional-audit-2026-11-01/catalog-${String(i).padStart(2,"0")}.json`,"utf8"))).flat(),row=rows.find(r=>r.name==='Varita de Armadura de Mago');
const time='2026-11-01T15:00:00.000Z',id='inv_11111111111111111111111111111111';
function fixture(current=1){const c=createCharacter('chr_11111111111111111111111111111111','Prueba',time);c.identity.className='Mago';const d=structuredClone(row.payload.rules.definition),cap=d.capabilities[0];cap.effects.push({id:'last-charge',kind:'last-charge-destruction',condition:'Con la última carga.',sides:20,destroyAtOrBelow:1});c.inventory=[CharacterInventoryItemV2Schema.parse({...row.payload,id,order:0,group:'Equipo',equipped:true,attuned:true,charges:{current,maximum:3,reset:'manual'},rules:{...row.payload.rules,original:{},definition:d}})];return c;}
const options=(c:{revision:number})=>({expectedRevision:c.revision,updatedAt:time});
describe('Última carga: comprobar la destrucción sin recargar ni repetir el uso',()=>{
 it('el lanzamiento nativo marca la comprobación y no gasta espacios',async()=>{const c=fixture();await syncInventorySpellGrants(c);const spell=c.spellcasting.spells[0]!,slots=structuredClone(c.spellcasting.slots),next=castCharacterSpell(c,spell.id,spell.level,options(c));expect(next.inventory[0]!.charges!.current).toBe(0);expect(next.inventory[0]!.rules!.lastChargePending).toBe(true);expect(next.spellcasting.slots).toEqual(slots);});
 it('también se detecta al registrar un gasto y bloquea recuperar antes de resolver',()=>{const c=fixture(),next=spendInventoryItemCharges(c,id,1,options(c));expect(next.inventory[0]!.rules!.lastChargePending).toBe(true);expect(()=>recoverInventoryItem(next,id,'dawn',2,options(next))).toThrow(/primero la tirada/);expect(resetInventoryItemResources(next.inventory[0]!,'long-rest',next).charges!.current).toBe(0);});
 it('un resultado distinto de uno conserva el objeto vacío y permite su recarga real',()=>{const c=fixture(),spent=useInventoryFeature(c,id,c.inventory[0]!.features[0]!.id,options(c)),survived=resolveInventoryLastCharge(spent,id,20,options(spent));expect(survived.inventory[0]!.charges!.current).toBe(0);expect(survived.inventory[0]!.rules!.lastChargePending).toBe(false);expect(recoverInventoryItem(survived,id,'dawn',2,options(survived)).inventory[0]!.charges!.current).toBe(2);expect(()=>resolveInventoryLastCharge(survived,id,1,options(survived))).toThrow(/No hay una tirada/);});
 it('no vuelve a marcar una comprobación sobrevivida por usar una capacidad sin coste',()=>{const c=fixture(),spent=spendInventoryItemCharges(c,id,1,options(c)),next=resolveInventoryLastCharge(spent,id,2,options(spent));next.inventory[0]!.features.push({...next.inventory[0]!.features[0]!,id:'free',chargeCost:0,rolls:[],uses:null});expect(useInventoryFeature(next,id,'free',options(next)).inventory[0]!.rules!.lastChargePending).toBe(false);});
 it('rechaza resultados inválidos sin modificar la entrada',()=>{const c=fixture(),spent=spendInventoryItemCharges(c,id,1,options(c)),before=JSON.stringify(spent);expect(()=>resolveInventoryLastCharge(spent,id,21,options(spent))).toThrow(/válido/);expect(JSON.stringify(spent)).toBe(before);expect(()=>resolveInventoryLastCharge(c,id,1,options(c))).toThrow(/No hay una tirada/);});
 it('un uno retira solo el ejemplar destruido y sus conjuros de la ficha',async()=>{const c=fixture();await syncInventorySpellGrants(c);c.inventory.push({...structuredClone(c.inventory[0]!),id:'inv_22222222222222222222222222222222',equipped:false,attuned:false});const repository=new InMemoryCampaignRepository(),app=new CampaignApplication(repository);let s=await repository.save(createTestCampaign({character:c}),{kind:'empty'});
  const command=()=>({characterId:c.id,itemId:id,expectedCharacterRevision:s.campaign.characters[c.id]!.revision,expectedCampaignChecksum:s.checksum});
  s=await app.useInventoryFeature({...command(),featureId:c.inventory[0]!.features[0]!.id});s=await app.resolveInventoryLastCharge({...command(),roll:1});const next=s.campaign.characters[c.id]!;
  expect(next.inventory.map(i=>i.id)).toEqual(['inv_22222222222222222222222222222222']);expect(next.spellcasting.spells.some(s=>s.casting?.source.startsWith(`inventory:${id}:`))).toBe(false);
 });
});
