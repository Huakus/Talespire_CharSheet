import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCharacter } from '../../src/domain/character/create-character';
import { normalizeEquipmentDefinition } from '../../src/domain/equipment/equipment-catalog';
import { bindReviewedEquipment } from '../../src/domain/equipment/equipment-live';
import { useEquipmentConsumable, equipmentImprovisedRangedAttack } from '../../src/domain/equipment/equipment-consumables';
import { useInventoryFeature } from '../../src/domain/character/character-inventory';
import { CampaignApplication } from '../../src/application/campaign/campaign-application';
import { InMemoryCampaignRepository } from '../../src/infrastructure/persistence/in-memory-campaign-repository';
import { createTestCampaign } from '../fixtures/native-campaign';
import { Window } from 'happy-dom';
import { BrowserApp } from '../../src/ui/browser-app';
import { renderEquipmentConsumable } from '../../src/ui/equipment-consumables';

const row=JSON.parse(readFileSync('docs/v2/equipment-acid-2026-11-01/reviews.json','utf8')).changes.find((r:{scope:string})=>r.scope==='ece');
const time='2026-11-01T15:00:00.000Z',id='inv_11111111111111111111111111111111',effectId='ite_11111111111111111111111111111111';
function fixture(){const c=createCharacter('chr_11111111111111111111111111111111','Prueba',time);c.abilities.dexterity=16;c.combat.hitPoints={current:50,maximum:50,temporary:0};c.combat.armorClass=14;
 c.inventory=[bindReviewedEquipment(JSON.parse(JSON.stringify({...normalizeEquipmentDefinition({name:row.name}),id,order:0,group:'Mochila',quantity:2,features:row.features})),row.definition)];return c;}
const options=(c:ReturnType<typeof fixture>)=>({expectedSourceRevision:c.revision,expectedTargetRevision:c.revision,updatedAt:time,effectId});
const action={kind:'acid' as const,attackRoll:12,distanceFeet:20,targetConfirmed:true,delivery:'throw' as const,damageRoll:7};

describe('Ácido de 2014',()=>{
 it('suma Destreza una vez, aplica daño y gasta una unidad sin alterar el original',()=>{
  const c=fixture(),before=JSON.stringify(c),next=useEquipmentConsumable(c,c,id,action,options(c));
  expect(next.source).toEqual(next.target);expect(next.source.inventory[0]!.quantity).toBe(1);expect(next.source.combat.hitPoints.current).toBe(40);
  expect(next.source.equipmentEffects).toEqual([]);expect(next.source.revision).toBe(c.revision+1);expect(JSON.stringify(c)).toBe(before);
 });
 it('un fallo gasta el vial, no exige daño y no añade competencia por armas simples o marciales',()=>{
  const c=fixture();c.proficiencies.weapons=['Arma Simple','Arma Marcial'];
  expect(equipmentImprovisedRangedAttack(c,c,10).hit).toBe(false);
  const {damageRoll: _damage,...miss}=action;
  const next=useEquipmentConsumable(c,c,id,{...miss,attackRoll:1},options(c)).source;
  expect(next.combat.hitPoints.current).toBe(50);expect(next.inventory[0]!.quantity).toBe(1);
 });
 it('el crítico duplica solo los dados y no permite introducir una tirada fuera de 4d6',()=>{
  const c=fixture();expect(()=>useEquipmentConsumable(c,c,id,{...action,attackRoll:20,damageRoll:3},options(c))).toThrow(/4d6/);
  const next=useEquipmentConsumable(c,c,id,{...action,attackRoll:20,damageRoll:24},options(c)).source;expect(next.combat.hitPoints.current).toBe(23);
 });
 it('esparcir sigue siendo ataque a distancia y no supera cinco pies; un tiro no supera veinte',()=>{
  const c=fixture();expect(()=>useEquipmentConsumable(c,c,id,{...action,delivery:'splash',distanceFeet:6},options(c))).toThrow(/5 pies/);
  expect(()=>useEquipmentConsumable(c,c,id,{...action,distanceFeet:21},options(c))).toThrow(/20 pies/);
  const miss=useEquipmentConsumable(c,c,id,{...action,delivery:'splash',distanceFeet:5,attackRoll:1},options(c)).source;expect(miss.combat.hitPoints.current).toBe(50);
  expect(()=>useInventoryFeature(c,id,c.inventory[0]!.features[0]!.id,{expectedRevision:c.revision,updatedAt:time})).toThrow(/objetivo/);
 });
 it('aplica resistencia antes de los PG temporales y conserva la salvación de concentración',()=>{
  const c=fixture(),defense=structuredClone(c.inventory[0]!);defense.id='inv_22222222222222222222222222222222';defense.equipped=true;defense.consumable=false;
  defense.rules!.definition={...defense.rules!.definition,capabilities:[{...row.definition.capabilities[0],activation:'passive',consumeQuantity:0,execution:{mode:'automatic',handler:'equipment-defense',explanation:'Resistencia al ácido.',pendingAutomation:[]},effects:[{id:'acid-resistance',kind:'defense',defense:'resistance',target:'acid',condition:''}]}]};
  c.inventory.push(defense);c.combat.hitPoints.temporary=2;c.combat.conditions.push({id:'cnd_33333333333333333333333333333333',key:'concentration',label:'Concentración',level:null,addedAt:time});
  const next=useEquipmentConsumable(c,c,id,action,options(c)).source;
  expect(next.combat.hitPoints.current).toBe(47);expect(next.combat.hitPoints.temporary).toBe(0);expect(next.equipmentEffects[0]!.concentrationDc).toBe(10);
 });
 it('un modificador negativo puede reducir a cero sin provocar daño ni una salvación',()=>{
  const c=fixture();c.abilities.dexterity=1;
  const next=useEquipmentConsumable(c,c,id,{...action,attackRoll:20,damageRoll:4},options(c)).source;expect(next.combat.hitPoints.current).toBe(50);expect(next.inventory[0]!.quantity).toBe(1);
 });
 it('guarda fuente y objetivo juntos y un reintento no consume dos viales',async()=>{
  const c=fixture(),target=createCharacter('chr_22222222222222222222222222222222','Objetivo',time);target.combat.hitPoints={current:50,maximum:50,temporary:0};
  const repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo),campaign=createTestCampaign({character:c});campaign.characters[target.id]=target;
  const snapshot=await repo.save(campaign,{kind:'empty'}),command={characterId:c.id,itemId:id,targetCharacterId:target.id,expectedTargetRevision:target.revision,action,expectedCharacterRevision:c.revision,expectedCampaignChecksum:snapshot.checksum};
  const result=await app.useEquipmentConsumable(command);expect(result.campaign.characters[c.id]!.inventory[0]!.quantity).toBe(1);expect(result.campaign.characters[target.id]!.combat.hitPoints.current).toBe(40);
  await expect(app.useEquipmentConsumable(command)).rejects.toThrow(/conflict/i);
 });
 it('el control conserva el d20 mientras espera el daño, y nunca tira daño en un fallo',async()=>{
  const c=fixture(),repo=new InMemoryCampaignRepository(),application=new CampaignApplication(repo),snapshot=await repo.save(createTestCampaign({character:c}),{kind:'empty'}),root=new Window().document.createElement('div');
  const app=new BrowserApp(root as unknown as HTMLElement,application,{storageLabel:'test',diceRoller:{roll:async()=>({kind:'rolled',totals:[],summary:'Ingresar resultado'})}});
  const view=app as unknown as {snapshot:typeof snapshot;selectedCharacterId:string;render():void;acceptCharacterSnapshot(s:typeof snapshot):void;handleEquipmentConsumable(b:HTMLButtonElement):Promise<void>};
  view.snapshot=snapshot;view.selectedCharacterId=c.id;view.render=()=>{};view.acceptCharacterSnapshot=s=>{view.snapshot=s;};
  root.innerHTML=`<div data-inventory-id="${id}">${renderEquipmentConsumable(c,c.inventory[0]!,[c])}</div>`;
  (root.querySelector('[data-consumable-target]')! as unknown as HTMLSelectElement).value=c.id;
  (root.querySelector('[data-consumable-confirm]')! as unknown as HTMLInputElement).checked=true;
  const attack=root.querySelector('[data-consumable-attack]')! as unknown as HTMLInputElement,button=root.querySelector('button')! as unknown as HTMLButtonElement;
  attack.value='20';await view.handleEquipmentConsumable(button);expect(view.snapshot.checksum).toBe(snapshot.checksum);expect(attack.value).toBe('20');
  (root.querySelector('[data-consumable-damage]')! as unknown as HTMLInputElement).value='24';await view.handleEquipmentConsumable(button);expect(view.snapshot.campaign.characters[c.id]!.combat.hitPoints.current).toBe(23);
  attack.value='1';(root.querySelector('[data-consumable-damage]')! as unknown as HTMLInputElement).value='';await view.handleEquipmentConsumable(button);expect(view.snapshot.campaign.characters[c.id]!.inventory).toEqual([]);expect(view.snapshot.campaign.characters[c.id]!.combat.hitPoints.current).toBe(23);
 });
});
