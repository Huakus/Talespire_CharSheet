import type { CharacterV2 } from "../domain/character/character-v2";
import type { RogueAction } from "../domain/character/rogue-model";
import { rogueArchetype,THIEVES_EXPERTISE } from "../domain/character/rogue-catalog";
import { rogueSkillMinimum,rogueThievesToolModifier } from "../domain/character/rogue-play";
import { PHB_SPELLS } from "../domain/character/phb-spells";
import { projectCharacterStatistics } from "../domain/character/character-projection";
import { SKILL_DEFINITIONS,SAVE_DEFINITIONS,type SkillKey } from "../domain/character/character-checks";
const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const signed = (n: number) => n >= 0 ? `+${n}` : String(n);
export function renderRoguePanel(character: CharacterV2) {
  if (character.builder?.classKey !== "rogue" || !character.spellcasting.rogue) return "";
  const archetype = rogueArchetype(character.builder), level = character.identity.level, runtime = character.spellcasting.rogue;
  const feature = character.traits.flatMap((g) => g.traits).find((t) => t.id === runtime.resourceIds["spell-thief"]);
  return `<details data-rogue-panel class="wizard-play-panel"><summary>Talentos de Pícaro · Ataque Furtivo ${Math.ceil(level/2)}d6</summary><p>El daño furtivo se tira aparte desde Acciones cuando se cumplen sus condiciones; comparte tipo y crítico con el arma. Los efectos sobre objetivos y los límites por turno se resuelven en la mesa siguiendo los rasgos de la ficha.</p><label>Característica para herramientas de ladrón<select data-rogue-tool-ability>${Object.entries(SAVE_DEFINITIONS).map(([k,v]) => `<option value="${k}" ${k === "dexterity" ? "selected" : ""}>${v.label}</option>`).join("")}</select></label><button type="button" class="roll-button" data-rogue-tool-roll data-roll-name="Herramientas de ladrón" data-roll-expression="1d20${signed(rogueThievesToolModifier(character))}" data-roll-mode="normal">Herramientas de ladrón ${signed(rogueThievesToolModifier(character))}${runtime.expertise.includes(THIEVES_EXPERTISE) ? " · pericia" : ""}</button>${level >= 11 || archetype === "inquisitive" ? `<details><summary>Aplicar mínimo al d20 de una prueba</summary><p>${level >= 11 ? "Talento Seguro: mínimo 10 si sumás competencia. No afecta ataques ni salvaciones." : "Oído para el Engaño: mínimo 8 al usar Perspicacia para detectar mentiras."} Registrá el d20 elegido después de ventaja/desventaja; añadí aparte Guía u otros dados adicionales.</p><label>Prueba<select data-rogue-check>${Object.entries(SKILL_DEFINITIONS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join("")}<option value="thieves-tools">Herramientas de ladrón</option></select></label><label class="checkbox"><input type="checkbox" data-rogue-detect-lies> Perspicacia para detectar mentiras</label><label>Resultado natural del d20<input type="number" min="1" max="20" value="1" data-rogue-natural></label><p data-rogue-check-result aria-live="polite"></p></details>` : ""}${archetype === "arcane-trickster" && level >= 17 ? `<details><summary>Ladrón de Conjuros · ${feature ? feature.uses.maximum-feature.uses.used : 0}/1</summary><p>Reacción al recibir un conjuro o estar en su área. El lanzador salva con su característica de lanzamiento contra tu CD. Registrá el resultado después de resolverla. Fallar niega sus efectos sobre vos; solo robás conjuros de nivel 1+ que puedas lanzar. Se consume el uso incluso si el lanzador tiene éxito.</p><label>Conjuro recibido<select data-rogue-stolen-key>${Object.entries(PHB_SPELLS).sort(([,a],[,b]) => a.name.localeCompare(b.name,"es")).map(([k,s]) => `<option value="${k}">${html(s.name)} · N${s.level}</option>`).join("")}</select></label><label class="checkbox"><input type="checkbox" data-rogue-targeted> Fui objetivo o quedé incluido en el área</label><label class="checkbox"><input type="checkbox" data-rogue-failed> El lanzador falló la salvación</label><button type="button" data-rogue-action="spell-thief" ${!feature || feature.uses.used >= feature.uses.maximum ? "disabled" : ""}>Usar reacción y registrar resultado</button>${runtime.stolenSpell ? `<p>Robado: ${html(PHB_SPELLS[runtime.stolenSpell]?.name ?? runtime.stolenSpell)} · quedan ${runtime.stolenHoursRemaining} horas de campaña. El lanzador no puede lanzarlo durante ese período.</p><label>Horas de campaña transcurridas fuera de descansos<input type="number" min="0.01" step="0.25" value="1" data-rogue-hours></label><button type="button" data-rogue-action="pass-time">Registrar tiempo transcurrido</button>` : ""}<p>Los descansos descuentan su duración mínima: una hora el corto y ocho el largo. Registrá tiempo adicional si duraron más. El conjuro robado se retira al vencer.</p></details>` : ""}<p>Golpe de Suerte, Maestro Duelista y Ojo Infalible usan sus contadores en Rasgos y recuperan usos con el descanso correspondiente.</p></details>`;
}
export function bindRoguePanel(root: HTMLElement,character: CharacterV2,options: { dispatch: (action: RogueAction,label: string) => Promise<void>;error: (message: string) => void }) {
  for (const panel of root.querySelectorAll<HTMLElement>("[data-rogue-panel]")) {
    const ability = panel.querySelector<HTMLSelectElement>("[data-rogue-tool-ability]")!;
    ability.addEventListener("change",() => {
      const bonus = rogueThievesToolModifier(character,ability.value as keyof CharacterV2["abilities"]), button = panel.querySelector<HTMLButtonElement>("[data-rogue-tool-roll]")!;
      button.dataset.rollExpression = `1d20${signed(bonus)}`; button.textContent = `Herramientas de ladrón ${signed(bonus)}`;
      refresh();
    });
    const refresh = () => {
      const result = panel.querySelector<HTMLElement>("[data-rogue-check-result]"); if (!result) return;
      const key = panel.querySelector<HTMLSelectElement>("[data-rogue-check]")!.value, natural = Number(panel.querySelector<HTMLInputElement>("[data-rogue-natural]")!.value);
      if (!Number.isInteger(natural) || natural < 1 || natural > 20) { result.textContent = "Ingresá un d20 entre 1 y 20."; return; }
      const minimum = key === THIEVES_EXPERTISE ? character.identity.level >= 11 ? 10 : 1 : rogueSkillMinimum(character,key as SkillKey,panel.querySelector<HTMLInputElement>("[data-rogue-detect-lies]")!.checked);
      const bonus = key === THIEVES_EXPERTISE ? rogueThievesToolModifier(character,ability.value as keyof CharacterV2["abilities"]) : projectCharacterStatistics(character).skills[key as SkillKey];
      result.textContent = `d20: ${natural} → ${Math.max(minimum,natural)} ${signed(bonus)} = ${Math.max(minimum,natural)+bonus}${minimum > 1 ? ` (mínimo ${minimum} al d20)` : " (sin mínimo especial)"}.`;
    };
    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-rogue-check], [data-rogue-natural], [data-rogue-detect-lies]").forEach((i) => i.addEventListener("input",refresh)); refresh();
    panel.querySelectorAll<HTMLButtonElement>("[data-rogue-action]").forEach((button) => button.addEventListener("click",async () => {
      if (button.disabled) return; button.disabled = true;
      try {
        const action: RogueAction = button.dataset.rogueAction === "pass-time" ? { kind: "pass-time",hours: Number(panel.querySelector<HTMLInputElement>("[data-rogue-hours]")!.value) } : { kind: "spell-thief",key: panel.querySelector<HTMLSelectElement>("[data-rogue-stolen-key]")!.value,targetedOrIncluded: panel.querySelector<HTMLInputElement>("[data-rogue-targeted]")!.checked as true,targetFailedSave: panel.querySelector<HTMLInputElement>("[data-rogue-failed]")!.checked };
        await options.dispatch(action,"Recurso de Pícaro actualizado");
      } catch (e) { options.error(e instanceof Error ? e.message : "No se pudo actualizar el recurso."); }
      finally { if (button.isConnected) button.disabled = false; }
    }));
  }
}
