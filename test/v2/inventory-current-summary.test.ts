import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { CharacterInventoryItemV2Schema } from '../../src/domain/character/character-inventory-model';
import { EquipmentDefinitionDraftSchema } from '../../src/domain/equipment/equipment-definition';
import { equipmentPlainDescription } from '../../src/domain/equipment/equipment-live';
import { renderCollapsibleInventoryDescription } from '../../src/ui/inventory-description-view';
import { renderInventoryItemPreview } from '../../src/ui/inventory-item-preview';

const originals=JSON.parse(readFileSync('docs/v2/equipment-copy-text-2026-11-01/before.json','utf8'));
function fixture(name='Armadura de cuero tachonado +1') {
 const item=CharacterInventoryItemV2Schema.parse(originals.find((r:{payload:{name:string}})=>r.payload.name===name).payload);
 const definition=EquipmentDefinitionDraftSchema.parse(item.rules!.definition);
 return {item,definition};
}
function body(html:string){const document=new Window().document;document.body.innerHTML=html;return document.body;}

describe('Estadísticas actuales en lugar de tablas de referencia del objeto base',()=>{
 it('muestra la copia modificada y conserva la tabla de tiempos para ponerse y quitarse la armadura',()=>{
  const {item,definition}=fixture();item.cost={quantity:731,unit:'gp'};item.unitWeight=17;
  item.armor!.base=18;item.armor!.dexterityBonus=true;item.armor!.maximumDexterityBonus=1;item.armor!.strengthRequirement=15;item.armor!.stealthDisadvantage=true;
  const table=definition.description.find(b=>b.id==='official-base-table');if(table?.type!=='table')throw Error('fixture');
  table.rows[0]![table.columns.indexOf('Precio del objeto mundano')]='9999 po';
  const before=structuredClone(item),source=structuredClone(definition);
  const card=body(renderCollapsibleInventoryDescription(equipmentPlainDescription(definition),item.id,definition,true,item));
  expect(card.querySelectorAll('.inventory-current-facts')).toHaveLength(1);
  expect(card.textContent).toContain('731 po');expect(card.textContent).toContain('17 lb');expect(card.textContent).toContain('18 + DES (máx. +1)');expect(card.textContent).toContain('Fuerza mínima 15');expect(card.textContent).toContain('Sigilo Desventaja');
  expect(card.textContent).not.toContain('9999 po');expect(card.textContent).not.toContain('Precio del objeto mundano');
  expect(card.querySelectorAll('.inventory-rule-table')).toHaveLength(1);expect(card.textContent).toContain('Poner');expect(card.textContent).toContain('Quitar');
  expect(item).toEqual(before);expect(definition).toEqual(source);
 });
 it('la vista previa de comerciante también usa la copia actual y no repite la tabla en las capacidades',()=>{
  const {item,definition}=fixture();item.cost={quantity:731,unit:'gp'};item.description=equipmentPlainDescription(definition);
  item.features=[{id:'personal',order:0,kind:'other',name:'Instrucción del portador',description:'Conservar lejos del agua.',active:false,toggleable:false,showInActions:false,chargeCost:0,uses:null,rolls:[],bonuses:[]}];
  const card=body(renderInventoryItemPreview(item,{key:item.id,expanded:true,showDescriptions:true}));
  expect(card.textContent).toContain('731 po');expect(card.textContent).not.toContain('Precio del objeto mundano');expect(card.textContent).toContain('Conservar lejos del agua.');
 });
 it('mantiene una tabla con unidades por paquete y cualquier tabla escrita por el GM',()=>{
  const {item,definition}=fixture();
  definition.description=[{id:'official-table',type:'table',section:'rules',provenance:'campaign',sourceIds:[],columns:['Objeto','Precio base','Peso','Unidades por paquete'],rows:[['Flecha','1 po','1 lb','20']]},{id:'gm-custom',type:'table',section:'rules',provenance:'campaign',sourceIds:[],columns:['Objeto','Precio','Peso'],rows:[['Recompensa del gremio','10 po','1 lb']]}];
  const card=body(renderCollapsibleInventoryDescription(equipmentPlainDescription(definition),item.id,definition,true,item));
  expect(card.querySelectorAll('.inventory-rule-table')).toHaveLength(2);expect(card.textContent).toContain('Unidades por paquete');expect(card.textContent).toContain('Recompensa del gremio');
 });
 it('no oculta daño o CA si falta el perfil vivo que los sustituiría',()=>{
  const {item,definition}=fixture();item.armor=null;
  const card=body(renderCollapsibleInventoryDescription(equipmentPlainDescription(definition),item.id,definition,true,item));
  expect(card.textContent).toContain('Precio del objeto mundano');expect(card.querySelector('.inventory-current-facts')).toBeNull();
 });
 it('reconoce descripciones equivalentes con saltos escapados sin borrar aclaraciones distintas',()=>{
  const {item,definition}=fixture(),text=equipmentPlainDescription(definition);
  const equivalent=body(renderCollapsibleInventoryDescription(text.replaceAll('\n','\\n'),item.id,definition,true,item));
  expect(equivalent.querySelector('.inventory-current-facts')).not.toBeNull();
  const personal=body(renderCollapsibleInventoryDescription(text+'\n\nSolo funciona de noche.',item.id,definition,true,item));
  expect(personal.textContent).toContain('Solo funciona de noche.');
 });
});
