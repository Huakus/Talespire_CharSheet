import type { CharacterV2 } from "../domain/character/character-v2";
import type { BardAction } from "../domain/character/bard-model";
import { bardCollege,bardDie,songRestDie,bardMantleHp,psychicBladesDice } from "../domain/character/bard-catalog";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
export function renderBardPanel(c: CharacterV2) {
  if (c.builder?.classKey !== "bard" || !c.spellcasting.bard) return "";
  const pool = c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.bard!.inspirationId);
  if (!pool) return "";
  const level = c.identity.level,college = bardCollege(c.builder),remaining = pool.uses.maximum-pool.uses.used;
  const button = (use: string,label: string,free = false) => `<button type="button" data-bard-use="${use}" ${!remaining && !free ? "disabled" : ""}>${html(label)}${free ? " · sin gasto" : " · gastar 1 uso"}</button>`;
  const roll = (expression: string,name: string) => `<button type="button" class="roll-button" data-roll-name="${html(name)}" data-roll-expression="${expression}" data-roll-mode="normal">Tirar ${expression} · ${html(name)}</button>`;
  return `<details data-bard-panel class="wizard-play-panel"><summary>Inspiración y talentos de Bardo · ${remaining}/${pool.uses.maximum} · d${bardDie(level)}</summary><p>Recuperación: descanso ${level >= 5 ? "corto o largo" : "largo"}. Todos los usos de inspiración del colegio gastan esta misma reserva.</p><label class="checkbox"><input type="checkbox" data-bard-confirm> Confirmo alcance, objetivo, acción/reacción y límites de turno/ronda del rasgo elegido.</label>${button("inspire","Inspirar a otra criatura")}${roll(`1d${bardDie(level)}`,"Dado de Inspiración (tirarlo no gasta otro uso)")}${college === "lore" ? button("cutting-words","Palabras Hirientes")+(level >= 14 ? button("peerless","Habilidad Incomparable") : "") : ""}${college === "glamour" ? `${button("mantle-inspiration","Manto de Inspiración")}<p>Hasta CAR (mínimo uno) criaturas: ${bardMantleHp(level)} PG temporales y movimiento como reacción sin ataques de oportunidad; podés incluirte. Aplicá cada efecto a su objetivo; no se tira dado.</p>` : ""}${college === "swords" ? `${button("flourish","Ademán de Cuchilla")}${level >= 14 ? button("master-flourish","Ademán del Maestro · d6",true)+roll("1d6","Ademán del Maestro") : ""}<p>Al usar Atacar, +10 pies hasta fin de turno. Un ademán por turno al impactar con arma de esa acción. Elegí Defensivo, Cortante o Móvil y aplicá el dado al daño y al efecto correspondiente en mesa.</p>` : ""}${college === "whispers" ? button("psychic-blades","Cuchillas Psíquicas")+roll(`${psychicBladesDice(level)}d6`,"Daño psíquico (una vez por ronda en tu turno)") : ""}${level >= 2 ? `<details><summary>Canción de Descanso · d${songRestDie(level)}</summary><p>Solo al finalizar descanso corto y gastar al menos un Dado de Golpe, una vez por criatura y descanso. Tirá el dado y aplicá la curación adicional desde PG; no se añade por cada Dado de Golpe.</p>${roll(`1d${songRestDie(level)}`,"Canción de Descanso")}</details>` : ""}${level >= 20 ? `<button type="button" data-bard-superior ${remaining ? "disabled" : ""}>Tiré iniciativa sin usos: recuperar uno</button>` : ""}<p>Los rasgos con usos propios se administran con sus contadores en Rasgos. Duraciones, concentración de Manto de Majestad, sombras de Manto de Susurros, bonificaciones temporales y efectos sobre objetivos se resuelven en mesa siguiendo los textos de la ficha.</p></details>`;
}
export function bindBardPanel(root: HTMLElement,_c: CharacterV2,options: { dispatch: (action: BardAction,label: string) => Promise<void>;error: (message: string) => void }) {
  root.querySelectorAll<HTMLElement>("[data-bard-panel]").forEach((panel) => {
    panel.querySelectorAll<HTMLButtonElement>("[data-bard-use], [data-bard-superior]").forEach((button) => button.addEventListener("click",async () => {
      if (button.disabled) return;
      try {
        const use = button.dataset.bardUse;
        if (use && !panel.querySelector<HTMLInputElement>("[data-bard-confirm]")?.checked) throw new Error("Confirmá los requisitos del rasgo antes de gastar inspiración.");
        button.disabled = true;
        await options.dispatch(use ? { kind: "inspiration",use: use as Extract<BardAction,{ kind: "inspiration" }>["use"],requirementsConfirmed: true } : { kind: "superior",rolledInitiative: true },"Inspiración de Bardo actualizada");
      } catch (e) { options.error(e instanceof Error ? e.message : "No se pudo actualizar inspiración."); }
      finally { if (button.isConnected) button.disabled = false; }
    }));
  });
}
