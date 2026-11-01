import type {CharacterV2}from"../domain/character/character-v2";
import type {CharacterInventoryItemV2}from"../domain/character/character-inventory-model";
import{projectConditionalEquipmentChecks}from"../domain/equipment/equipment-conditional-checks";
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function renderConditionalEquipmentChecks(character:CharacterV2,item:CharacterInventoryItemV2):string {
 const checks=projectConditionalEquipmentChecks(character,item);if(!checks.length)return '';
 return `<details class="inventory-conditional-checks"><summary>Pruebas con este objeto</summary><p>Elegí la prueba que corresponda a la situación. La ventaja se aplica únicamente al uso indicado.</p>${checks.map(c=>`<button type="button" class="roll-button" data-roll-expression="1d20" data-roll-check-modifier="${c.modifier}" data-roll-check-minimum="${c.minimum}" data-roll-mode="${c.mode}" data-roll-name="${escape(item.name+': '+c.label)}" ${c.issue?`disabled title="${escape(c.issue)}"`:''}>${escape(c.label)} · ${c.modifier>=0?'+':''}${c.modifier}</button>`).join('')}</details>`;
}
