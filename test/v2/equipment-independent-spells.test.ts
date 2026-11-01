import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bardAt } from '../fixtures/bard-builder';
import { normalizeEquipmentDefinition } from '../../src/domain/equipment/equipment-catalog';
import { recoverInventoryItem,resetInventoryItemResources,useInventoryFeature } from '../../src/domain/character/character-inventory';
import { syncInventorySpellGrants,itemSpellState } from '../../src/domain/character/item-spells';
import { castCharacterSpell } from '../../src/domain/character/character-spells';
import { projectSpellcasting } from '../../src/domain/character/character-projection';
import { itemSpellOptions } from '../../src/ui/item-spell-options';
import { PHB_SPELLS } from '../../src/domain/character/phb-spells';
const row=JSON.parse(readFileSync('docs/v2/equipment-doss-2026-11-01/review.json','utf8'));
const id='inv_11111111111111111111111111111111',time='2026-11-01T15:00:00.000Z';
const options=(c:{revision:number})=>({expectedRevision:c.revision,updatedAt:time});
async function fixture(){const c=await bardAt(7);const plain=normalizeEquipmentDefinition({...row.payload,rules:{...row.payload.rules,original:{}}});c.inventory.push({...plain,id,order:c.inventory.length,group:'Equipo',equipped:true,attuned:true,features:row.features,charges:null,rules:{...plain.rules!,definition:row.definition}});await syncInventorySpellGrants(c);return c;}
const granted=(c:Awaited<ReturnType<typeof fixture>>)=>c.spellcasting.spells.filter(s=>s.casting?.source.startsWith('inventory:'+id+':'));
describe('Conjuros de objeto con usos independientes',()=>{
 it('concede los siete conjuros del laúd con Carisma sin aprenderlos como conjuros de clase',async()=>{
  const c=await fixture(),spells=granted(c);expect(spells).toHaveLength(7);expect(spells.every(s=>s.casting!.ability==='charisma')).toBe(true);
  const fly=spells.find(s=>s.casting!.key==='fly')!;expect(itemSpellState(c,fly).available).toBe(true);
  expect(projectSpellcasting(c,fly).ability).toBe('charisma');expect(c.inventory.at(-1)!.charges).toBeNull();
 });
 it('lanzar uno no gasta espacios ni los usos de los otros seis y no permite repetirlo',async()=>{
  const c=await fixture(),spell=granted(c).find(s=>s.casting!.key==='fly')!,slots=structuredClone(c.spellcasting.slots);
  const next=castCharacterSpell(c,spell.id,3,options(c));expect(next.spellcasting.slots).toEqual(slots);
  expect(granted(next).filter(s=>itemSpellState(next,s).available)).toHaveLength(6);
  expect(()=>castCharacterSpell(next,spell.id,3,options(next))).toThrow(/usos/);
  expect(()=>castCharacterSpell(c,spell.id,4,options(c))).toThrow(/nivel indicado/);
 });
 it('descansar no recupera usos al amanecer; el evento correcto sí recupera los siete',async()=>{
  const c=await fixture(),spell=granted(c)[0]!,spent=castCharacterSpell(c,spell.id,spell.level,options(c)),item=spent.inventory.at(-1)!;
  expect(resetInventoryItemResources(item,'long-rest',spent).features.find(f=>f.id===itemSpellState(c,spell).feature!.id)!.uses!.current).toBe(0);
  expect(()=>recoverInventoryItem(spent,id,'long-rest',undefined,options(spent))).toThrow(/evento/);
  const next=recoverInventoryItem(spent,id,'dawn',undefined,options(spent));expect(granted(next).every(s=>itemSpellState(next,s).available)).toBe(true);
 });
 it('exige equipo, sintonización, clase y un contador válido para lanzar',async()=>{
  const c=await fixture(),spell=granted(c)[0]!,item=c.inventory.at(-1)!;item.attuned=false;expect(itemSpellState(c,spell).available).toBe(false);
  item.attuned=true;item.features.find(f=>f.id===itemSpellState(c,spell).feature!.id)!.uses=null;
  expect(()=>useInventoryFeature(c,id,itemSpellState(c,spell).feature!.id,options(c))).toThrow(/uso independiente/);
 });
 it('muestra solo fuego como restricción del objeto sin modificar la descripción oficial del conjuro',async()=>{
  const c=await fixture(),spell=granted(c).find(s=>s.casting!.key==='protection-from-energy')!;
  expect(itemSpellOptions(c,spell)).toContain('Solo fuego');expect(spell.definition!.description).toBe(PHB_SPELLS['protection-from-energy']!.description);
 });
});
