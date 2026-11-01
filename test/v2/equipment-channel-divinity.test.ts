import{describe,it,expect}from"vitest";
import{readFileSync}from"node:fs";
import{CharacterInventoryItemV2Schema}from"../../src/domain/character/character-inventory-model";
import{normalizeEquipmentDefinition}from"../../src/domain/equipment/equipment-catalog";
import{buildGuidedCharacter,advanceGuidedCharacter}from"../../src/domain/character/guided-character-builder";
import{performClericAction}from"../../src/domain/character/cleric-play";
import{performMartialAction,martialFeature}from"../../src/domain/character/martial-play";
import{equipmentChannelChoices}from"../../src/domain/equipment/equipment-channel-divinity";
import{useInventoryFeature,recoverInventoryItem,resetInventoryItemResources}from"../../src/domain/character/character-inventory";
import{clericCreation,clericChoice}from"../fixtures/cleric-builder";
import{martialAt}from"../fixtures/martial-builder";
const row=JSON.parse(readFileSync('docs/v2/equipment-channel-divinity-2026-11-01/reviews.json','utf8')).changes.find((r:{scope:string})=>r.scope==='ece');
const itemId='inv_11111111111111111111111111111111',time='2026-11-01T15:00:00.000Z',operation='class_11111111111111111111111111111111';
const options=(c:{revision:number})=>({expectedRevision:c.revision,updatedAt:time});
function amulet(){return CharacterInventoryItemV2Schema.parse({...normalizeEquipmentDefinition({name:row.name}),id:itemId,order:0,group:'Equipo',features:row.features,charges:{...row.charges,current:1},equipped:true,attuned:true,requiresAttunement:true,rules:{definition:row.definition,original:{},pending:[],personalDescription:'',slotUsage:{},storage:null}});}
async function cleric(){let c=await buildGuidedCharacter('chr_11111111111111111111111111111111','build_11111111111111111111111111111111',clericCreation('life'),time);c=await advanceGuidedCharacter(c,clericChoice(c),time);c.inventory.push(amulet());return c;}
describe('Canalizar Divinidad con el Amuleto del devoto',()=>{
 it('funciona sin usos de clase y reintentar la misma operación no gasta de nuevo',async()=>{
  const c=await cleric(),pool=c.traits.flatMap(g=>g.traits).find(t=>t.id===c.spellcasting.cleric!.resourceIds.channel)!;pool.uses.used=pool.uses.maximum;
  const action={kind:'channel'as const,key:'turn-undead',channelItemId:itemId};const next=await performClericAction(c,operation,action,options(c));expect(next.inventory.find(i=>i.id===itemId)!.charges!.current).toBe(0);expect(next.traits.flatMap(g=>g.traits).find(t=>t.id===pool.id)!.uses.used).toBe(pool.uses.maximum);
  expect(await performClericAction(next,operation,action,options(c))).toEqual(next);
  await expect(performClericAction(next,operation,{...action,channelItemId:'inv_22222222222222222222222222222222'},options(next))).rejects.toThrow(/otras elecciones/);
 });
 it('valida el poder y sus requisitos antes de gastar y no crea créditos sueltos',async()=>{
  const c=await cleric(),before=JSON.stringify(c),cap=row.definition.capabilities.find((c:{id:string})=>c.id==='daily-property');
  await expect(performClericAction(c,operation,{kind:'channel',key:'no-existe',channelItemId:itemId},options(c))).rejects.toThrow(/no está disponible/);expect(JSON.stringify(c)).toBe(before);
  expect(()=>useInventoryFeature(c,itemId,cap.id,options(c))).toThrow(/Elegí una opción/);
  c.inventory.find(i=>i.id===itemId)!.attuned=false;
  await expect(performClericAction(c,operation,{kind:'channel',key:'turn-undead',channelItemId:itemId},options(c))).rejects.toThrow(/sintonizá/);
 });
 it('se recupera al amanecer y no con los descansos',async()=>{
  const c=await cleric(),next=await performClericAction(c,operation,{kind:'channel',key:'turn-undead',channelItemId:itemId},options(c)),item=next.inventory.find(i=>i.id===itemId)!;
  expect(resetInventoryItemResources(item,'long-rest',next).charges!.current).toBe(0);expect(recoverInventoryItem(next,itemId,'dawn',undefined,options(next)).inventory.find(i=>i.id===itemId)!.charges!.current).toBe(1);
 });
 it('aplica la misma propiedad a Paladín sin sustituir otros recursos',async()=>{
  const c=await martialAt(3,'paladin','devotion');c.inventory.push(amulet());const pool=martialFeature(c,'channel')!;pool.uses.used=pool.uses.maximum;
  const choice=equipmentChannelChoices(c).find(c=>c.key!=='sacred-weapon')!;expect(choice).toBeTruthy();
  const next=await performMartialAction(c,operation,{kind:'feature',key:choice.key,requirementsConfirmed:true,channelItemId:itemId},options(c));expect(martialFeature(next,'channel')!.uses.used).toBe(pool.uses.maximum);expect(next.inventory.find(i=>i.id===itemId)!.charges!.current).toBe(0);
  await expect(performMartialAction(c,operation,{kind:'feature',key:'divine-sense',requirementsConfirmed:true,channelItemId:itemId},options(c))).rejects.toThrow(/solo sustituye/);
 });
});
