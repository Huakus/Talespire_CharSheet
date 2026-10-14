import type { CharacterV2 } from "../domain/character/character-v2";
import type { CharacterSpellV2 } from "../domain/character/character-spell-model";
import type { WarlockAction } from "../domain/character/warlock-model";
import { replayWarlockChoices,canConjurePactWeapon } from "../domain/character/warlock-builder";
import { pactSlots,INVOCATIONS,WARLOCK_PATRONS,PACT_BOONS } from "../domain/character/warlock-catalog";
import { warlockSpellAvailable } from "../domain/character/warlock-play";
import { PHB_SPELLS } from "../domain/character/phb-spells";
import { BUILDER_WEAPONS } from "../domain/character/fighter-builder-catalog";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const button = (action: string,label: string,disabled = false) => `<button type="button" data-warlock-action="${action}" ${disabled ? "disabled" : ""}>${html(label)}</button>`;
export function warlockCastingOptions(character: CharacterV2,spell: CharacterSpellV2) {
  if (spell.casting?.kind !== "at-will") return null;
  const available = warlockSpellAvailable(character,spell);
  return `<option value="${spell.level}" data-cast-available="${available}" ${available ? "" : "disabled"}>A voluntad · nivel ${spell.level} · sin espacio</option>`;
}
export function warlockSpellExtras(character: CharacterV2,spell: CharacterSpellV2) {
  if (character.builder?.classKey !== "warlock") return "";
  const ray = spell.casting?.key === "eldritch-blast" ? `<p>${character.identity.level >= 17 ? 4 : character.identity.level >= 11 ? 3 : character.identity.level >= 5 ? 2 : 1} rayo(s): resolvé cada ataque y su daño por separado. Descarga agonizante se aplica a cada impacto.</p>` : "";
  return ray+(spell.casting?.kind === "pact-invocation" ? "<p>Consume un espacio de pacto y el uso de esta invocación por descanso largo.</p>" : spell.casting?.source.startsWith("builder:warlock:arcanum") ? "<p>Arcano místico: un lanzamiento sin espacio por descanso largo.</p>" : "");
}
export function renderWarlockPanel(character: CharacterV2) {
  if (character.builder?.classKey !== "warlock" || !character.spellcasting.warlock) return "";
  const replay = replayWarlockChoices(character.builder),runtime = character.spellcasting.warlock,slots = pactSlots(character.identity.level);
  let content = `<p>${html(WARLOCK_PATRONS[replay.patron])}${replay.boon ? ` · ${html(PACT_BOONS[replay.boon])}` : ""}. Espacios de pacto: ${slots.maximum-character.spellcasting.slots[String(slots.level)]!.used}/${slots.maximum} de nivel ${slots.level}. Se recuperan con descanso corto/largo. Arcanos e invocaciones limitadas recuperan sus propios usos según el rasgo.</p><p>Invocaciones: ${replay.invocations.map((key) => html(INVOCATIONS[key]!.name)).join(" · ") || "Se eligen desde nivel 2"}.</p>`;
  if (replay.patron === "celestial") { const pool = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds["healing-light"])!; content += `<p>Luz Sanadora: ${pool.uses.maximum-pool.uses.used}/${pool.uses.maximum}d6. Acción adicional, criatura visible a 60 pies. Tirá los dados gastados y aplicá la curación al objetivo.</p><label>Dados a gastar<input type="number" min="1" max="6" value="1" data-warlock-field="healing-dice"></label>${button("healing-light","Gastar dados de Luz Sanadora",pool.uses.used >= pool.uses.maximum)}`; }
  if (replay.patron === "hexblade") content += `<label>Arma de Guerrero Maléfico tras descanso largo<select data-warlock-field="hex-weapon">${character.inventory.filter((i) => i.weapon && !i.properties.includes("two-handed") && character.actions.some((a) => a.inventoryItemId === i.id && a.proficient)).map((i) => `<option value="${i.id}">${html(i.name)}</option>`).join("")}</select></label>${button("hex-weapon","Usar Carisma con esta arma tras descanso largo")}<p>Las armas creadas por Pacto del Filo usan Carisma automáticamente. Registrá el objetivo de Maldición en mesa; su daño y críticos son condicionales a ese objetivo.</p>`;
  if (replay.invocations.includes("eldritch-smite")) content += `<p>Castigo Sobrenatural: +${slots.level+1}d8 de fuerza; una vez por turno tras impactar con arma de pacto, y puede derribar Enorme o menor.</p>${button("eldritch-smite","Gastar espacio de pacto por el impacto",character.spellcasting.slots[String(slots.level)]!.used >= slots.maximum)}`;
  if (replay.patron === "fiend") {
    content += button("dark-blessing","Bendición: reduje una criatura hostil a 0 PG");
    if (character.identity.level >= 10) content += `<p>Resistencia infernal: ${html(runtime.resistance ?? "sin elegir")}. Las armas mágicas o de plata la ignoran.</p><label>Tipo tras descanso corto/largo<select data-warlock-field="resistance">${["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"].map((type) => `<option value="${type}" ${runtime.resistance === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>${button("resistance","Elegir resistencia tras descanso")}`;
  }
  if (replay.boon === "tome") content += `<p>Libro de las Sombras: ${runtime.bookAvailable ? "disponible" : "no disponible; sus trucos y rituales no se pueden lanzar"}.</p>${button("book-access",runtime.bookAvailable ? "Marcar libro no disponible" : "Recuperé el libro")}${button("replace-book","Recibir reemplazo tras ceremonia de una hora")}<p>El reemplazo destruye el libro anterior. Los trucos y rituales registrados se conservan.</p>`;
  if (replay.invocations.includes("book-of-ancient-secrets")) {
    const known = [...replay.rituals,...runtime.copiedRituals.map((r) => r.key)], eligible = Object.keys(PHB_SPELLS).filter((key) => PHB_SPELLS[key]!.ritual && PHB_SPELLS[key]!.level >= 1 && PHB_SPELLS[key]!.level <= Math.ceil(character.identity.level/2) && !known.includes(key));
    content += `<details><summary>Copiar ritual al Libro de las Sombras</summary><p>Conseguí la fuente y dedicá dos horas y 50 po por nivel. El GM resuelve prueba y consumo si es un pergamino. No concede lanzamiento ordinario con espacios.</p><label>Ritual<select data-warlock-field="ritual">${eligible.map((key) => `<option value="${key}">${html(PHB_SPELLS[key]!.name)} · N${PHB_SPELLS[key]!.level} · ${PHB_SPELLS[key]!.level*50} po / ${PHB_SPELLS[key]!.level*2} h</option>`).join("")}</select></label>${button("copy-ritual","Copiar desde fuente disponible y descontar materiales",!runtime.bookAvailable || !eligible.length)}</details>`;
  }
  if (replay.boon === "blade") content += `<details><summary>Forma del arma de pacto</summary><label>Arma cuerpo a cuerpo<select data-warlock-field="weapon">${Object.entries(BUILDER_WEAPONS).filter(([key]) => canConjurePactWeapon(key,replay.invocations)).map(([key,item]) => `<option value="${key}" ${key === runtime.pactWeaponKey ? "selected" : ""}>${html(item.name)}</option>`).join("")}</select></label>${button("pact-weapon","Crear esta forma con una acción")}<p>Equipala en inventario con manos libres. Guerrero Maléfico permite Carisma si elegiste Hexblade; las demás armas usan Fuerza/Destreza. Vincular un arma mágica requiere ritual de una hora: conservá esa arma en inventario y registrá su vínculo y competencia en la acción; no cambia su forma. Filo sediento y Bebedor de vida se aplican solo al arma de pacto.</p></details>`;
  if (character.identity.level >= 20) { const trait = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds["eldritch-master"]); content += `<p>Maestro sobrenatural recupera espacios de pacto, sin recuperar Arcanos ni usos de invocaciones.</p>${button("eldritch-master","Recuperar pacto tras un minuto",!trait || trait.uses.used >= trait.uses.maximum)}`; }
  return `<details class="wizard-play-panel" data-warlock-panel><summary>Magia de pacto y recursos de Brujo</summary>${content}</details>`;
}
export function bindWarlockPanel(root: HTMLElement,character: CharacterV2,options: { dispatch: (action: WarlockAction,label: string) => Promise<void>;error: (message: string) => void }) {
  const panel = root.querySelector<HTMLElement>("[data-warlock-panel]"); if (!panel) return;
  const value = (field: string) => panel.querySelector<HTMLSelectElement | HTMLInputElement>(`[data-warlock-field="${field}"]`)?.value ?? "";
  panel.querySelectorAll<HTMLButtonElement>("[data-warlock-action]").forEach((control) => control.addEventListener("click",async () => {
    if (control.disabled) return; control.disabled = true;
    try {
      const kind = control.dataset.warlockAction;
      const action: WarlockAction = kind === "healing-light" ? { kind,dice: Number(value("healing-dice")) } : kind === "hex-weapon" ? { kind,id: value("hex-weapon"),afterLongRest: true } : kind === "eldritch-smite" ? { kind,pactWeaponHit: true,oncePerTurn: true } : kind === "dark-blessing" ? { kind,hostileReducedToZero: true } : kind === "resistance" ? { kind,damageType: value("resistance") as "fire",afterRest: true } : kind === "book-access" ? { kind,available: !character.spellcasting.warlock!.bookAvailable } : kind === "replace-book" ? { kind,hours: 1 } : kind === "copy-ritual" ? { kind,key: value("ritual"),sourceAvailable: true } : kind === "pact-weapon" ? { kind,key: value("weapon") } : { kind: "eldritch-master",minutes: 1 };
      await options.dispatch(action,control.textContent ?? "Recurso de Brujo");
    } catch (error) { options.error(error instanceof Error ? error.message : "No se pudo actualizar el recurso de Brujo."); }
    finally { if (control.isConnected) control.disabled = false; }
  }));
}
