import type { CharacterV2 } from "../domain/character/character-v2";
import type { CharacterSpellV2 } from "../domain/character/character-spell-model";
import { itemSpellState } from "../domain/character/item-spells";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function itemSpellOptions(character: CharacterV2, spell: CharacterSpellV2): string | null {
  if (spell.casting?.kind !== "item") return null;
  const state = itemSpellState(character,spell);
  const resource = state.item?.charges ? `${state.item.charges.current}/${state.item.charges.maximum} cargas` : state.feature?.uses ? `${state.feature.uses.current}/${state.feature.uses.maximum} usos` : "sin espacio";
  return `<option value="${spell.casting.level}" data-cast-available="${state.available}" title="${html(state.reason)}" ${state.available ? "" : "disabled"}>Objeto · nivel ${spell.casting.level} · ${resource}${state.reason ? ` · ${html(state.reason)}` : ""}</option>`;
}
