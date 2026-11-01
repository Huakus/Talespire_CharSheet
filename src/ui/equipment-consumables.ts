import type { CharacterV2 } from "../domain/character/character-v2";
import type { CharacterInventoryItemV2 } from "../domain/character/character-inventory-model";
import { equipmentConsumableRule } from "../domain/equipment/equipment-consumables";
const escape = (s: string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const result = (key: string, label: string) => `<label>${label}<input type="number" data-consumable-${key} placeholder="Vacío para tirar"></label>`;

export function renderEquipmentConsumable(actor: CharacterV2, item: CharacterInventoryItemV2, targets: CharacterV2[]): string {
  const rule = equipmentConsumableRule(item); if (!rule) return '';
  return `<details class="equipment-consumable-use"><summary>${rule.rule === 'potion-poison' ? 'Beber o administrar' : 'Lanzar el frasco'}</summary>
    <label>Objetivo<select data-consumable-target><option value="">Elegí un personaje</option>${targets.map(c=>`<option value="${c.id}" ${rule.rule==='potion-poison'&&c.id===actor.id?'selected':''}>${escape(c.name)}</option>`).join('')}</select></label>
    ${rule.rule==='potion-poison'?`${result('damage','Daño inicial · 3d6 veneno')}${result('save','Salvación de Constitución · CD 13 (total)')}<label><input type="checkbox" data-consumable-confirm>El objetivo bebe la poción.</label>`:`${rule.rule==='acid'?'<label>Forma de uso<select data-consumable-delivery><option value="throw">Lanzar · hasta 20 pies</option><option value="splash">Esparcir · hasta 5 pies</option></select></label>':''}<label>Distancia al objetivo (pies)<input type="number" data-consumable-distance min="0" max="20" value="20"></label>${result('attack','D20 del ataque a distancia improvisado')}${rule.rule==='acid'?result('damage','Suma de dados de daño · 2d6, o 4d6 con 20 natural (sin modificador)'):''}<label><input type="checkbox" data-consumable-confirm>El objetivo es válido y está al alcance.</label>`}
    <label>Modo de la tirada d20<select data-consumable-mode><option value="normal">Normal</option><option value="advantage">Ventaja</option><option value="disadvantage">Desventaja</option></select></label>
    <p>${rule.rule==='potion-poison'?'El daño se aplica al beber; si falla la salvación, el veneno continúa y se reduce con sus siguientes salvaciones.':rule.rule==='acid'?'Gasta un vial aunque falle. Un impacto causa 2d6 + Destreza de ácido; con 20 natural, 4d6 + Destreza. Esparcir también requiere un ataque a distancia.':'Gasta un frasco aunque falle. Si impacta, causa 1d4 de fuego al principio de cada turno hasta extinguirlo con una acción y una prueba de Destreza CD 10.'}</p>
    ${rule.rule!=='potion-poison'?'<p>Elegí desventaja si estás a 5 pies de un enemigo que puede verte y no está incapacitado; resolvé las demás circunstancias antes de confirmar.</p>':''}
    <p data-consumable-status role="status"></p><button type="button" data-equipment-consumable="${rule.rule}" ${item.quantity?'':'disabled'}>Resolver y consumir una unidad</button>
  </details>`;
}

export function renderEquipmentActiveEffects(c: CharacterV2, helpers: CharacterV2[] = [c]): string {
  if (!c.equipmentEffects.length) return '';
  return `<section class="equipment-ongoing-effects"><h3>Efectos de objetos</h3>${c.equipmentEffects.map(e=>`<article class="equipment-ongoing-effect" data-equipment-effect-id="${e.id}"><h4>${escape(e.sourceName)}</h4>
    ${e.kind==='concentration-check'?'':`<p>${e.kind==='potion-poison'?`Envenenado · ${e.dice}d6 de veneno`:'Ardiendo · 1d4 de fuego'} al principio del turno.</p>${e.phase==='start'?`${result('tick','Resultado del daño')}<button type="button" data-equipment-effect-action="damage">Aplicar daño del principio del turno</button>`:`${e.kind==='potion-poison'?result('save','Salvación de Constitución CD 13 · total'):''}<button type="button" data-equipment-effect-action="end-turn">${e.kind==='potion-poison'?'Resolver salvación del final del turno':'Finalizar turno'}</button>`}`}
    ${e.kind==='alchemist-fire'?`<label>Quién extingue<select data-equipment-effect-helper>${helpers.map(h=>`<option value="${h.id}" ${h.id===c.id?'selected':''}>${escape(h.name)}</option>`).join('')}</select></label>${result('extinguish','Prueba de Destreza CD 10 · total')}<button type="button" data-equipment-effect-action="extinguish">Usar acción para extinguir</button>`:''}
    ${e.concentrationDc!==null?`${result('concentration',`Salvación de concentración CD ${e.concentrationDc} · total`)}<button type="button" data-equipment-effect-action="concentration">Resolver concentración</button>`:''}
    <p data-consumable-status role="status"></p></article>`).join('')}</section>`;
}
