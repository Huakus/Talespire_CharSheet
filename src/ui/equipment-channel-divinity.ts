import type{CharacterV2}from"../domain/character/character-v2";
import type{CharacterInventoryItemV2}from"../domain/character/character-inventory-model";
import{equipmentChannelChoices,equipmentChannelIssue}from"../domain/equipment/equipment-channel-divinity";
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function renderEquipmentChannelUse(character:CharacterV2,item:CharacterInventoryItemV2):string{
 const choices=equipmentChannelChoices(character),issue=equipmentChannelIssue(character,item);
 return `<div class="inventory-channel-use"><p>Elegí una opción de Canalizar Divinidad. Se gasta el uso del amuleto y se conservan los usos de clase.</p><label>Opción<select data-equipment-channel-choice><option value="">Elegí un poder disponible</option>${choices.map(c=>`<option value="${escape(c.key)}">${escape(c.name)}</option>`).join('')}</select></label>${choices.some(c=>c.classKey==='paladin')?'<label>Arma o criatura objetivo, si la opción lo requiere<input data-equipment-channel-target maxlength="120"></label>':''}<label><input type="checkbox" data-equipment-channel-confirm>Se cumplen los requisitos del poder elegido</label><button type="button" data-equipment-channel-use ${issue?`disabled title="${escape(issue)}"`:''}>Usar poder con el amuleto</button>${issue?`<p>${escape(issue)}</p>`:''}</div>`;
}
