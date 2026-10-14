import type { CharacterV2 } from "../domain/character/character-v2";
import type { ClericAction } from "../domain/character/cleric-model";
import { CLERIC_FEATURES,clericDomainSpells } from "../domain/character/cleric-catalog";
import { clericPreparationLimit } from "../domain/character/cleric-builder";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
export function renderClericPanel(character: CharacterV2) {
  if (character.builder?.classKey !== "cleric" || !character.spellcasting.cleric) return "";
  const level = character.identity.level, domain = character.builder.creation.cleric.domain!, runtime = character.spellcasting.cleric;
  const free = clericDomainSpells(domain,level), spells = character.spellcasting.spells.filter((s) => s.casting?.kind === "cleric" && s.level > 0), used = spells.filter((s) => s.prepared && !free.includes(s.casting!.key)).length;
  const channel = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds.channel);
  const intervention = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds.intervention);
  return `<details data-cleric-panel class="wizard-play-panel"><summary>Preparación y recursos de Clérigo · ${used}/${clericPreparationLimit(character)}</summary><p>${html(character.builder.creation.cleric.deity)}. Lista completa disponible por nivel; los conjuros de dominio no ocupan cupo.</p><details><summary>Preparar tras descanso largo</summary><p>Oración y meditación: al menos un minuto por nivel de cada conjuro preparado. Los rituales también requieren preparación.</p><p data-cleric-count></p><div class="wizard-preparation-list">${spells.map((s) => `<label class="checkbox"><input type="checkbox" data-cleric-key="${s.casting!.key}" ${s.prepared ? "checked" : ""} ${free.includes(s.casting!.key) ? 'disabled title="Siempre preparado por tu dominio, no ocupa cupo"' : ""}> ${html(s.name)} · N${s.level}${free.includes(s.casting!.key) ? " · dominio" : ""}</label>`).join("")}</div><button type="button" data-cleric-action="prepare">Preparar esta lista (tras descanso largo)</button></details>${channel ? `<details><summary>Canalizar Divinidad · ${channel.uses.maximum-channel.uses.used}/${channel.uses.maximum}</summary><p>Todas estas opciones gastan el mismo recurso; se recupera con descanso corto o largo.</p>${[{ key: "turn-undead",name: "Expulsar Muertos Vivientes" },...CLERIC_FEATURES[domain].filter((f) => f.channel && f.level <= level)].map((f) => `<button type="button" data-cleric-channel="${f.key}" ${channel.uses.used >= channel.uses.maximum ? "disabled" : ""}>${html(f.name)}</button>`).join("")}</details>` : ""}${level >= 10 ? `<details><summary>Intervención Divina · ${runtime.interventionCooldownDays ? `faltan ${runtime.interventionCooldownDays} días` : "sin espera por éxito previo"}</summary><p>${level === 20 ? "Éxito automático." : `Éxito con d100 ≤ ${level}; si falla, se recupera tras descanso largo.`} Si tiene éxito, debe transcurrir una semana. El GM decide el efecto.</p>${level < 20 ? '<label>Resultado d100<input type="number" min="1" max="100" value="100" data-cleric-roll></label>' : ""}<button type="button" data-cleric-action="intervention" ${runtime.interventionCooldownDays || !intervention || intervention.uses.used >= intervention.uses.maximum ? "disabled" : ""}>Invocar ayuda divina</button>${runtime.interventionCooldownDays ? '<label>Días transcurridos en la campaña<input type="number" min="1" max="365" value="1" data-cleric-days></label><button type="button" data-cleric-action="elapsed-days">Registrar días transcurridos</button>' : ""}</details>` : ""}<p>Los efectos sobre otras criaturas, Golpe Divino, resistencias condicionales y curación especial se resuelven siguiendo los rasgos de la ficha. Usá sus contadores para los rasgos con usos propios.</p></details>`;
}
export function bindClericPanel(root: HTMLElement,character: CharacterV2,options: { dispatch: (action: ClericAction,label: string) => Promise<void>; error: (message: string) => void }) {
  const panel = root.querySelector<HTMLElement>("[data-cleric-panel]");
  if (!panel || !character.builder) return;
  const free = clericDomainSpells(character.builder.creation.cleric.domain!,character.identity.level);
  const inputs = [...panel.querySelectorAll<HTMLInputElement>("[data-cleric-key]")];
  const refresh = () => {
    const count = inputs.filter((i) => i.checked && !free.includes(i.dataset.clericKey!)).length, limit = clericPreparationLimit(character);
    panel.querySelector("[data-cleric-count]")!.textContent = `${count}/${limit} preparados, sin contar dominio.`;
    for (const input of inputs) if (!free.includes(input.dataset.clericKey!)) { input.disabled = !input.checked && count >= limit; input.title = input.disabled ? "Alcanzaste el límite de preparación; desmarcá otro conjuro primero" : ""; }
  };
  inputs.forEach((i) => i.addEventListener("change",refresh)); refresh();
  panel.querySelectorAll<HTMLButtonElement>("[data-cleric-action], [data-cleric-channel]").forEach((button) => button.addEventListener("click",async () => {
    if (button.disabled) return; button.disabled = true;
    try {
      const kind = button.dataset.clericAction;
      const action: ClericAction = button.dataset.clericChannel ? { kind: "channel",key: button.dataset.clericChannel } : kind === "prepare" ? { kind,keys: inputs.filter((i) => i.checked).map((i) => i.dataset.clericKey!),afterLongRest: true } : kind === "intervention" ? { kind,roll: character.identity.level >= 20 ? null : Number(panel.querySelector<HTMLInputElement>("[data-cleric-roll]")!.value) } : { kind: "elapsed-days",days: Number(panel.querySelector<HTMLInputElement>("[data-cleric-days]")!.value) };
      await options.dispatch(action,kind === "prepare" ? "Preparación de Clérigo actualizada" : "Recurso de Clérigo actualizado");
    } catch (e) { options.error(e instanceof Error ? e.message : "No se pudo actualizar el recurso."); }
    finally { if (button.isConnected) button.disabled = false; }
  }));
}
