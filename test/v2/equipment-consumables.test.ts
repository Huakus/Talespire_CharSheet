import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createCharacter } from "../../src/domain/character/create-character";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { useEquipmentConsumable, performEquipmentEffectAction } from "../../src/domain/equipment/equipment-consumables";
import { reconcileEquipmentActiveEffects } from "../../src/domain/equipment/equipment-active-effects";
import { CharacterV2Schema } from "../../src/domain/character/character-v2";
import { useInventoryFeature } from "../../src/domain/character/character-inventory";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createTestCampaign } from "../fixtures/native-campaign";
import { martialAt } from "../fixtures/martial-builder";

const rows=JSON.parse(readFileSync('docs/v2/equipment-consumables-2026-11-01/reviews.json','utf8')).changes.filter((r:{scope:string})=>r.scope==='ece');
const time='2026-11-01T15:00:00.000Z',itemId='inv_11111111111111111111111111111111',effectId='ite_11111111111111111111111111111111';
function character(suffix='1'){const c=createCharacter(`chr_${suffix.repeat(32)}`,'Prueba',time);c.combat.hitPoints={current:50,maximum:50,temporary:0};c.combat.armorClass=14;return c;}
function fixture(name='Poción de veneno',quantity=1){const row=rows.find((r:{name:string})=>r.name===name),c=character();
 c.inventory=[bindReviewedEquipment(JSON.parse(JSON.stringify({...normalizeEquipmentDefinition({name}),id:itemId,order:0,group:'Equipo',quantity,features:row.features})),row.definition)];return c;}
const options=(source:ReturnType<typeof fixture>,target=source)=>({expectedSourceRevision:source.revision,expectedTargetRevision:target.revision,updatedAt:time,effectId});
const step=(c:ReturnType<typeof fixture>,action:Parameters<typeof performEquipmentEffectAction>[2])=>performEquipmentEffectAction(c,effectId,action,{expectedRevision:c.revision,updatedAt:time});
const drink={kind:'potion-poison' as const,damageRoll:10,saveTotal:12,ingested:true};
const throwFire={kind:'alchemist-fire' as const,attackRoll:20,distanceFeet:20,targetConfirmed:true};

describe('Consumibles con objetivo y efectos persistentes de 2014',()=>{
 it('beber consume una unidad, causa el daño y conserva el efecto aunque el objeto desaparezca',()=>{
  const c=fixture(),before=JSON.stringify(c),next=useEquipmentConsumable(c,c,itemId,drink,options(c));
  expect(next.source).toEqual(next.target);expect(next.source.revision).toBe(c.revision+1);
  expect(next.source.inventory).toHaveLength(0);expect(next.source.combat.hitPoints.current).toBe(40);
  expect(next.source.combat.conditions.some(p=>p.key==='poisoned')).toBe(true);expect(next.source.equipmentEffects[0]!.dice).toBe(3);
  expect(CharacterV2Schema.parse(JSON.parse(JSON.stringify(next.source))).equipmentEffects).toEqual(next.source.equipmentEffects);
  expect(JSON.stringify(c)).toBe(before);
 });
 it('salvar inicialmente evita el estado pero no el daño de la poción',()=>{const c=fixture(),next=useEquipmentConsumable(c,c,itemId,{...drink,saveTotal:13},options(c)).source;expect(next.combat.hitPoints.current).toBe(40);expect(next.equipmentEffects).toEqual([]);});
 it('reduce solo el daño de turnos posteriores y termina tras tres salvaciones exitosas',()=>{
  const c=fixture();let next=useEquipmentConsumable(c,c,itemId,drink,options(c)).source;
  expect(()=>step(next,{kind:'end-turn',saveTotal:13})).toThrow(/primero el daño/);
  for(const dice of [3,2,1]){
   expect(next.equipmentEffects[0]!.dice).toBe(dice);next=step(next,{kind:'damage',damageRoll:6});
   expect(()=>step(next,{kind:'damage',damageRoll:6})).toThrow(/ya está registrado/);
   next=step(next,{kind:'end-turn',saveTotal:13});
  }
  expect(next.equipmentEffects).toEqual([]);expect(next.combat.conditions.some(p=>p.key==='poisoned')).toBe(false);
 });
 it('una salvación fallida no reduce dados y curarlo no retira otras condiciones',()=>{
  const c=fixture();let next=useEquipmentConsumable(c,c,itemId,drink,options(c)).source;
  next=step(next,{kind:'damage',damageRoll:6});next=step(next,{kind:'end-turn',saveTotal:12});expect(next.equipmentEffects[0]!.dice).toBe(3);
  next.combat.conditions.push({id:'cnd_22222222222222222222222222222222',key:'poisoned',label:'Otro veneno',level:null,addedAt:time});
  next.combat.conditions=next.combat.conditions.filter(p=>p.id!==next.equipmentEffects[0]!.conditionId);reconcileEquipmentActiveEffects(next);
  expect(next.equipmentEffects).toEqual([]);expect(next.combat.conditions[0]!.label).toBe('Otro veneno');
 });
 it('Cuerpo Puro del monje evita daño y estado sin impedir gastar la poción',async()=>{
  const c=fixture(),monk=await martialAt(10,'monk','open-hand');monk.combat.hitPoints={current:50,maximum:50,temporary:0};
  const next=useEquipmentConsumable(c,monk,itemId,drink,options(c,monk));expect(next.source.inventory).toEqual([]);
  expect(next.target.combat.hitPoints.current).toBe(50);expect(next.target.equipmentEffects).toEqual([]);expect(next.target.combat.conditions.some(p=>p.key==='poisoned')).toBe(false);
 });
 it('valida tiradas y confirmación antes de consumir; el botón genérico no puede saltarse el objetivo',()=>{
  const c=fixture(),before=JSON.stringify(c);
  expect(()=>useEquipmentConsumable(c,c,itemId,{...drink,damageRoll:19},options(c))).toThrow(/3d6/);
  expect(()=>useEquipmentConsumable(c,c,itemId,{...drink,ingested:false},options(c))).toThrow(/bebe/);
  expect(()=>useInventoryFeature(c,itemId,c.inventory[0]!.features[0]!.id,{expectedRevision:c.revision,updatedAt:time})).toThrow(/objetivo/);
  expect(JSON.stringify(c)).toBe(before);
 });
 it('el fuego comienza en el siguiente turno y un fallo del ataque también gasta el frasco',()=>{
  const c=fixture('Fuego de alquimista (frasco)',2),t=character('2');
  const missed=useEquipmentConsumable(c,t,itemId,{...throwFire,attackRoll:1},options(c,t));expect(missed.source.inventory[0]!.quantity).toBe(1);expect(missed.target.equipmentEffects).toEqual([]);
  const hit=useEquipmentConsumable(c,t,itemId,throwFire,options(c,t));expect(hit.target.combat.hitPoints.current).toBe(50);
  const tick=step(hit.target,{kind:'damage',damageRoll:4});expect(tick.combat.hitPoints.current).toBe(46);expect(tick.equipmentEffects[0]!.phase).toBe('end');
  const end=step(tick,{kind:'end-turn'});expect(end.equipmentEffects[0]!.phase).toBe('start');
 });
 it('extinguir exige la prueba CD 10; otra criatura puede ayudar al objetivo inconsciente',()=>{
  const c=fixture('Fuego de alquimista (frasco)'),t=character('2');let next=useEquipmentConsumable(c,t,itemId,throwFire,options(c,t)).target;
  next=step(next,{kind:'extinguish',checkTotal:9});expect(next.equipmentEffects).toHaveLength(1);
  next.combat.hitPoints.current=0;expect(()=>step(next,{kind:'extinguish',checkTotal:10})).toThrow(/actuar/);
  const helped=performEquipmentEffectAction(next,effectId,{kind:'extinguish',checkTotal:10},{expectedRevision:next.revision,updatedAt:time,actor:c});expect(helped.equipmentEffects).toEqual([]);
 });
 it('la distancia inválida no gasta y dos frascos no duplican el mismo fuego persistente',()=>{
  const c=fixture('Fuego de alquimista (frasco)',2),t=character('2');expect(()=>useEquipmentConsumable(c,t,itemId,{...throwFire,distanceFeet:21},options(c,t))).toThrow(/20 pies/);
  let next=useEquipmentConsumable(c,t,itemId,throwFire,options(c,t));
  next=useEquipmentConsumable(next.source,next.target,itemId,throwFire,{...options(next.source,next.target),effectId:'ite_22222222222222222222222222222222'});
  expect(next.source.inventory).toEqual([]);expect(next.target.equipmentEffects).toHaveLength(1);
 });
 it('conserva la salvación de concentración aun si se resiste el estado y bloquea perderla al avanzar',()=>{
  const c=fixture();c.combat.conditions.push({id:'cnd_33333333333333333333333333333333',key:'concentration',label:'Concentración',level:null,addedAt:time});
  let next=useEquipmentConsumable(c,c,itemId,{...drink,saveTotal:13},options(c)).source;
  expect(next.equipmentEffects[0]!.kind).toBe('concentration-check');expect(next.equipmentEffects[0]!.concentrationDc).toBe(10);
  expect(()=>step(next,{kind:'end-turn'})).toThrow(/concentración/);
  next=step(next,{kind:'concentration',saveTotal:9});expect(next.combat.conditions.some(p=>p.key==='concentration')).toBe(false);expect(next.equipmentEffects).toEqual([]);
 });
 it('guardar a fuente y objetivo es atómico y no admite reintentos con el checksum gastado',async()=>{
  const c=fixture('Fuego de alquimista (frasco)'),t=character('2'),repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo),campaign=createTestCampaign({character:c});campaign.characters[t.id]=t;
  const s=await repo.save(campaign,{kind:'empty'}),command={characterId:c.id,itemId,targetCharacterId:t.id,expectedTargetRevision:t.revision,action:throwFire,expectedCharacterRevision:c.revision,expectedCampaignChecksum:s.checksum};
  const next=await app.useEquipmentConsumable(command);expect(next.campaign.characters[c.id]!.inventory).toEqual([]);expect(next.campaign.characters[t.id]!.equipmentEffects).toHaveLength(1);
  await expect(app.useEquipmentConsumable(command)).rejects.toThrow(/conflict/i);
 });
});
