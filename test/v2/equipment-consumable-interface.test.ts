import { it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import { createCharacter } from '../../src/domain/character/create-character';
import { normalizeEquipmentDefinition } from '../../src/domain/equipment/equipment-catalog';
import { bindReviewedEquipment } from '../../src/domain/equipment/equipment-live';
import { renderEquipmentConsumable, renderEquipmentActiveEffects } from '../../src/ui/equipment-consumables';
import { BrowserApp } from '../../src/ui/browser-app';
import { CampaignApplication } from '../../src/application/campaign/campaign-application';
import { InMemoryCampaignRepository } from '../../src/infrastructure/persistence/in-memory-campaign-repository';
import { createTestCampaign } from '../fixtures/native-campaign';
import { useEquipmentConsumable } from '../../src/domain/equipment/equipment-consumables';

const time='2026-11-01T15:00:00.000Z',id='inv_11111111111111111111111111111111';
const rows=JSON.parse(readFileSync('docs/v2/equipment-consumables-2026-11-01/reviews.json','utf8')).changes.filter((r:{scope:string})=>r.scope==='ece');
function fixture(name:string){const row=rows.find((r:{name:string})=>r.name===name),c=createCharacter('chr_11111111111111111111111111111111','Prueba',time);c.combat.hitPoints={current:50,maximum:50,temporary:0};
 c.inventory=[bindReviewedEquipment(JSON.parse(JSON.stringify({...normalizeEquipmentDefinition({name}),id,order:0,group:'Mochila',features:row.features})),row.definition)];return c;}
async function setup(c:ReturnType<typeof fixture>){
 const repo=new InMemoryCampaignRepository(),application=new CampaignApplication(repo),snapshot=await repo.save(createTestCampaign({character:c}),{kind:'empty'}),doc=new Window().document,root=doc.createElement('div');
 const app=new BrowserApp(root as unknown as HTMLElement,application,{storageLabel:'test',diceRoller:{roll:async()=>({kind:'rolled',totals:[],summary:'Ingresar resultado'})}});
 const view=app as unknown as {snapshot:typeof snapshot;selectedCharacterId:string;render():void;acceptCharacterSnapshot(s:typeof snapshot):void;handleEquipmentConsumable(b:HTMLButtonElement):Promise<void>;handleEquipmentEffectAction(b:HTMLButtonElement):Promise<void>};
 view.snapshot=snapshot;view.selectedCharacterId=c.id;view.render=()=>{};view.acceptCharacterSnapshot=s=>{view.snapshot=s;};return{view,root};
}
it('la tarjeta guarda juntos el consumo y el daño, y conserva la primera tirada si falta la segunda',async()=>{
 const c=fixture('Poción de veneno'),{view,root}=await setup(c);root.innerHTML=`<div data-inventory-id="${id}">${renderEquipmentConsumable(c,c.inventory[0]!,[c])}</div>`;
 const damage=root.querySelector('[data-consumable-damage]')! as unknown as HTMLInputElement;damage.value='10';(root.querySelector('[data-consumable-confirm]')! as unknown as HTMLInputElement).checked=true;
 const button=root.querySelector('button')! as unknown as HTMLButtonElement,before=view.snapshot.checksum;
 await view.handleEquipmentConsumable(button);expect(damage.value).toBe('10');expect(view.snapshot.checksum).toBe(before);expect(button.disabled).toBe(false);
 (root.querySelector('[data-consumable-save]')! as unknown as HTMLInputElement).value='13';await view.handleEquipmentConsumable(button);
 expect(view.snapshot.campaign.characters[c.id]!.inventory).toEqual([]);expect(view.snapshot.campaign.characters[c.id]!.combat.hitPoints.current).toBe(40);
});
it('el efecto se puede gestionar sin el objeto original y un control viejo no repite el daño',async()=>{
 const c=fixture('Fuego de alquimista (frasco)'),next=useEquipmentConsumable(c,c,id,{kind:'alchemist-fire',attackRoll:20,distanceFeet:0,targetConfirmed:true},{expectedSourceRevision:c.revision,expectedTargetRevision:c.revision,updatedAt:time,effectId:'ite_11111111111111111111111111111111'}).source;
 const{view,root}=await setup(next);root.innerHTML=renderEquipmentActiveEffects(next);
 (root.querySelector('[data-consumable-tick]')! as unknown as HTMLInputElement).value='4';const button=root.querySelector('[data-equipment-effect-action="damage"]')! as unknown as HTMLButtonElement;
 await view.handleEquipmentEffectAction(button);expect(view.snapshot.campaign.characters[c.id]!.combat.hitPoints.current).toBe(46);
 await view.handleEquipmentEffectAction(button);expect(view.snapshot.campaign.characters[c.id]!.combat.hitPoints.current).toBe(46);expect(root.querySelector('[role=status]')!.textContent).toContain('ya está registrado');
});
