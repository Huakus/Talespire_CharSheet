import type { CharacterV2 } from "../domain/character/character-v2";
import type { CharacterInventoryItemV2 } from "../domain/character/character-inventory-model";
import { SAVE_DEFINITIONS, type RollMode } from "../domain/character/character-checks";
import { inventoryToolIdentity, projectEquipmentToolCheck } from "../domain/equipment/equipment-tool-checks";
import type { AbilityKey } from "../domain/character/character-projection";

const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function renderEquipmentToolCheck(item: CharacterInventoryItemV2): string {
  if (!inventoryToolIdentity(item)) return "";
  return `<details class="inventory-tool-check" data-equipment-tool-check data-tool-item-id="${escape(item.id)}"><summary>Prueba con este objeto</summary><div class="inventory-tool-check-controls"><label>Característica<select data-tool-ability><option value="">Elegí la indicada por el GM</option>${Object.entries(SAVE_DEFINITIONS).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join("")}</select></label><label>Tirada<select data-tool-mode><option value="normal">Normal</option><option value="advantage">Ventaja</option><option value="disadvantage">Desventaja</option></select></label><button type="button" class="roll-button" data-tool-roll data-roll-expression="1d20" data-roll-mode="normal" disabled>Tirar prueba</button></div><p data-tool-readout aria-live="polite">Elegí la característica para calcular la prueba.</p><p>Usá la herramienta en la tarea que indique el GM. Poseerla no concede competencia.</p></details>`;
}

export function bindEquipmentToolChecks(root: ParentNode, currentCharacter: () => CharacterV2 | undefined): void {
  for (const panel of root.querySelectorAll<HTMLElement>("[data-equipment-tool-check]")) {
    const ability = panel.querySelector<HTMLSelectElement>("[data-tool-ability]")!, mode = panel.querySelector<HTMLSelectElement>("[data-tool-mode]")!, button = panel.querySelector<HTMLButtonElement>("[data-tool-roll]")!, readout = panel.querySelector<HTMLElement>("[data-tool-readout]")!;
    const refresh = () => {
      const c = currentCharacter(), item = c?.inventory.find(i => i.id === panel.dataset.toolItemId);
      button.disabled = true;
      if (!c || !item || !Object.hasOwn(SAVE_DEFINITIONS, ability.value)) return;
      if (c.combat.hitPoints.current <= 0 || c.combat.conditions.some(p => ["incapacitated", "unconscious", "stunned", "paralyzed", "petrified", "dead"].includes(p.key))) { readout.textContent = "Necesitás poder actuar para usar la herramienta."; return; }
      try {
        const result = projectEquipmentToolCheck(c, item, ability.value as AbilityKey, mode.value as RollMode), signed = result.modifier >= 0 ? `+${result.modifier}` : String(result.modifier);
        button.disabled = false; button.dataset.rollMode = result.mode; button.dataset.rollCheckModifier = String(result.modifier); button.dataset.rollCheckMinimum = String(result.minimum);
        button.dataset.rollName = `${result.tool.name} · ${SAVE_DEFINITIONS[ability.value as AbilityKey].label} (${signed})${result.minimum > 1 ? " · Talento Seguro, mínimo 10" : ""}`;
        button.textContent = `Tirar ${signed}`;
        readout.textContent = `${result.rank === 2 ? "Pericia" : result.rank === 1 ? "Competente" : "Sin competencia"} · modificador ${signed}${result.minimum > 1 ? " · mínimo 10 al d20 elegido" : ""}.`;
      } catch (error) { readout.textContent = error instanceof Error ? error.message : "No se puede realizar la prueba."; }
    };
    ability.addEventListener("change", refresh); mode.addEventListener("change", refresh); refresh();
  }
}
