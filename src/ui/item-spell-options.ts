import type { CharacterV2 } from "../domain/character/character-v2";
import type { CharacterSpellV2 } from "../domain/character/character-spell-model";
import { itemSpellState } from "../domain/character/item-spells";
import { inventoryEquipmentDefinition } from "../domain/equipment/equipment-live";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function itemSpellOptions(character: CharacterV2, spell: CharacterSpellV2): string | null {
  if (spell.casting?.kind !== "item") return null;
  const state = itemSpellState(character,spell);
  const resource = state.item?.charges ? `${state.item.charges.current}/${state.item.charges.maximum} cargas` : state.feature?.uses ? `${state.feature.uses.current}/${state.feature.uses.maximum} usos` : "sin espacio";
  const restriction = state.item && inventoryEquipmentDefinition(state.item)?.capabilities.find(c=>c.id===state.feature?.id)?.effects.find(e=>e.kind==='spell')?.condition;
  return `<option value="${spell.casting.level}" data-cast-available="${state.available}" title="${html(state.reason)}" ${state.available ? "" : "disabled"}>Objeto · nivel ${spell.casting.level} · ${resource}${restriction?` · ${html(restriction)}`:''}${state.reason ? ` · ${html(state.reason)}` : ""}</option>`;
}
