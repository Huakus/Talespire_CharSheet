import {
  SKILL_DEFINITIONS,
  SAVE_DEFINITIONS,
  type RollMode,
} from "../domain/character/character-checks";
import type {
  InventoryBonus,
  InventoryFeature,
  InventoryFeatureKind,
} from "../domain/character/character-inventory-model";
import { normalizeRollShortcut } from "../domain/dice/dice-expression";
import { createRandomId } from "../shared/id";

type Ability = NonNullable<InventoryBonus["valueSource"]>;

const abilityLabels: Record<Ability, string> = {
  strength: "FUE",
  dexterity: "DES",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "SAB",
  charisma: "CAR",
};

const bonusOptions = {
  skills: {
    label: "Habilidades",
    keys: {
      all: "Todas",
      Initiative: "Iniciativa",
      ...Object.fromEntries(Object.entries(SKILL_DEFINITIONS).map(([key, value]) => [key, value.label])),
    },
  },
  saves: {
    label: "Salvaciones",
    keys: { all: "Todas", ...Object.fromEntries(Object.entries(SAVE_DEFINITIONS).map(([key, value]) => [key, value.label])) },
  },
  attributes: {
    label: "Características",
    keys: { all: "Todas", strength: "Fuerza", dexterity: "Destreza", constitution: "Constitución", intelligence: "Inteligencia", wisdom: "Sabiduría", charisma: "Carisma" },
  },
  combatStats: {
    label: "Combate",
    keys: {
      AC: "Clase de armadura",
      toHitBonus: "Ataques",
      damageBonus: "Daño",
      AttackandDamage: "Ataques y daño",
      MeleeAttackRolls: "Ataques cuerpo a cuerpo",
      MeleeDamageRolls: "Daño cuerpo a cuerpo",
      RangedAttackRolls: "Ataques a distancia",
      RangedDamageRolls: "Daño a distancia",
      SpellAttackModifier: "Ataques de conjuro",
      SpellSaveDC: "CD de conjuros",
      SpellAttackandSave: "Ataque y CD de conjuros",
      CarryWeightBonus: "Capacidad de carga",
    },
  },
  senses: {
    label: "Sentidos",
    keys: { PassivePerception: "Percepción pasiva", PassiveInvestigation: "Investigación pasiva", PassiveInsight: "Perspicacia pasiva" },
  },
} as const;

const featureKindLabels: Record<InventoryFeatureKind, string> = {
  passive: "Pasivo",
  activation: "Activación",
  action: "Acción",
  "bonus-action": "Acción adicional",
  reaction: "Reacción",
  other: "Otro",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function options(values: Record<string, string>, selected: string): string {
  return Object.entries(values).map(([value, label]) =>
    `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");
}

function bonusKeyOptions(category: string, selected: string): string {
  const definition = bonusOptions[category as keyof typeof bonusOptions] ?? bonusOptions.skills;
  const normalized = selected.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  const abilityAliases: Record<string, string> = { str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" };
  const wanted = abilityAliases[normalized] ?? normalized;
  const canonical = Object.keys(definition.keys).find((key) => key.toLocaleLowerCase().replace(/[^a-z0-9]/g, "") === wanted)
    ?? Object.keys(definition.keys)[0]
    ?? "all";
  return options(definition.keys, canonical);
}

function renderBonusRow(bonus: InventoryBonus | null): string {
  const category = bonus && bonus.category in bonusOptions ? bonus.category : "skills";
  const valueSource = bonus?.valueSource ?? null;
  return `<div class="inventory-bonus-row" data-inventory-bonus-row>
    <select data-bonus-field="category" name="bonusCategory" aria-label="Categoría del bono">${Object.entries(bonusOptions).map(([value, definition]) => `<option value="${value}" ${category === value ? "selected" : ""}>${definition.label}</option>`).join("")}</select>
    <select data-bonus-field="key" name="bonusKey" aria-label="Estadística afectada">${bonusKeyOptions(category, bonus?.key ?? "all")}</select>
    <select data-bonus-field="source" name="bonusSource" aria-label="Origen del valor"><option value="fixed" ${valueSource === null ? "selected" : ""}>Valor</option>${Object.entries(abilityLabels).map(([value, label]) => `<option value="${value}" ${valueSource === value ? "selected" : ""}>Mod. ${label}</option>`).join("")}</select>
    <input data-bonus-field="value" name="bonusValue" type="number" step="1" value="${bonus?.value ?? 0}" aria-label="Valor del bono" ${valueSource === null ? "" : "disabled"}>
    <label class="compact-check"><input data-bonus-field="advantage" name="bonusAdvantage" type="checkbox" ${bonus?.advantage ? "checked" : ""}> Ventaja</label>
    <label class="compact-check"><input data-bonus-field="disadvantage" name="bonusDisadvantage" type="checkbox" ${bonus?.disadvantage ? "checked" : ""}> Desventaja</label>
    <button type="button" class="danger secondary-button" data-remove-inventory-bonus aria-label="Eliminar bono">Quitar</button>
  </div>`;
}

export function renderInventoryBonusEditor(bonuses: readonly InventoryBonus[], topLevel = false): string {
  return `<div class="inventory-bonus-editor" data-inventory-bonus-editor ${topLevel ? "data-inventory-top-bonuses data-structured-inventory-editor" : "data-inventory-feature-bonuses"}>
    <div data-inventory-bonus-rows>${bonuses.map(renderBonusRow).join("")}</div>
    <button type="button" class="secondary-button" data-add-inventory-bonus>+ Agregar bono mágico</button>
  </div>`;
}

function renderRollRow(roll: InventoryFeature["rolls"][number] | null): string {
  return `<div class="inventory-feature-roll-row" data-inventory-feature-roll-row>
    <input data-roll-field="label" name="featureRollLabel" value="${escapeHtml(roll?.label ?? "")}" placeholder="Nombre: daño, ataque…" aria-label="Nombre de la tirada">
    <input data-roll-field="expression" name="featureRollExpression" value="${escapeHtml(roll?.expression ?? "")}" placeholder="1d6 o +7" aria-label="Fórmula de tirada">
    <select data-roll-field="mode" name="featureRollMode" aria-label="Modo de tirada"><option value="normal" ${roll?.mode === "normal" || !roll ? "selected" : ""}>Normal</option><option value="advantage" ${roll?.mode === "advantage" ? "selected" : ""}>Ventaja</option><option value="disadvantage" ${roll?.mode === "disadvantage" ? "selected" : ""}>Desventaja</option></select>
    <button type="button" class="danger secondary-button" data-remove-feature-roll>Quitar</button>
  </div>`;
}

function renderFeatureRow(feature: InventoryFeature | null, defaultKind: InventoryFeatureKind, order: number): string {
  const kind = feature?.kind ?? defaultKind;
  const uses = feature?.uses ?? null;
  return `<article class="inventory-feature-editor-row" data-inventory-feature-row data-feature-id="${escapeHtml(feature?.id ?? "")}">
    <header><strong>${escapeHtml(feature?.name || "Nueva capacidad")}</strong><div><button type="button" class="secondary-button" data-move-feature="-1" title="Mover arriba">↑</button><button type="button" class="secondary-button" data-move-feature="1" title="Mover abajo">↓</button><button type="button" class="danger secondary-button" data-remove-inventory-feature>Eliminar</button></div></header>
    <div class="inventory-feature-main-fields">
      <label>Nombre<input data-feature-field="name" name="featureName" value="${escapeHtml(feature?.name ?? "")}" placeholder="Nombre de la capacidad"></label>
      <label>Tipo<select data-feature-field="kind" name="featureKind">${(Object.entries(featureKindLabels) as [InventoryFeatureKind, string][]).map(([value, label]) => `<option value="${value}" ${kind === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <input data-feature-field="order" name="featureOrder" type="hidden" value="${feature?.order ?? order}">
    </div>
    <label>Descripción<textarea data-feature-field="description" name="featureDescription" placeholder="Separá párrafos con una línea en blanco">${escapeHtml(feature?.description ?? "")}</textarea></label>
    <div class="inventory-feature-flags">
      <label><input data-feature-field="toggleable" name="featureToggleable" type="checkbox" ${feature?.toggleable ? "checked" : ""}> Mantiene estado activo</label>
      <label><input data-feature-field="active" name="featureActive" type="checkbox" ${feature?.active ? "checked" : ""}> Activa por defecto</label>
      <label><input data-feature-field="showInActions" name="featureShowInActions" type="checkbox" ${feature?.showInActions ? "checked" : ""}> Mostrar en Acciones</label>
    </div>
    <fieldset><legend>Consumo</legend><div class="inventory-feature-resource-fields"><label>Costo en cargas<input data-feature-field="chargeCost" name="featureChargeCost" type="number" min="0" step="1" value="${feature?.chargeCost ?? 0}"></label><label class="compact-check"><input data-feature-field="hasUses" name="featureHasUses" type="checkbox" ${uses ? "checked" : ""}> Usos propios</label><label>Disponibles<input data-feature-field="usesCurrent" name="featureUsesCurrent" type="number" min="0" step="1" value="${uses?.current ?? 1}" ${uses ? "" : "disabled"}></label><label>Máximos<input data-feature-field="usesMaximum" name="featureUsesMaximum" type="number" min="1" step="1" value="${uses?.maximum ?? 1}" ${uses ? "" : "disabled"}></label><label>Recuperación<select data-feature-field="usesReset" name="featureUsesReset" ${uses ? "" : "disabled"}>${options({ none: "Manual", "short-rest": "Descanso corto", "long-rest": "Descanso largo", dawn: "Al amanecer", daily: "Diario", never: "Nunca" }, uses?.reset ?? "long-rest")}</select></label></div></fieldset>
    <fieldset><legend>Tiradas</legend><div data-inventory-feature-rolls>${feature?.rolls.map(renderRollRow).join("") ?? ""}</div><button type="button" class="secondary-button" data-add-feature-roll>+ Agregar tirada</button><small>Un modificador como +7 se convierte en 1d20+7.</small></fieldset>
    <fieldset><legend>Bonos mientras corresponde</legend>${renderInventoryBonusEditor(feature?.bonuses ?? [])}</fieldset>
  </article>`;
}

function featureGroup(title: string, group: string, defaultKind: InventoryFeatureKind, features: readonly InventoryFeature[]): string {
  return `<section class="inventory-feature-editor-group" data-inventory-feature-group="${group}"><header><h4>${title}</h4><button type="button" class="secondary-button" data-add-inventory-feature="${defaultKind}">+ Agregar capacidad</button></header><div data-inventory-feature-rows>${features.map((feature, index) => renderFeatureRow(feature, defaultKind, index)).join("")}</div></section>`;
}

export function renderInventoryFeatureEditor(features: readonly InventoryFeature[]): string {
  const sorted = [...features].sort((left, right) => left.order - right.order);
  return `<div class="inventory-feature-editor" data-structured-inventory-editor data-inventory-feature-editor>
    ${featureGroup("Efectos pasivos", "passive", "passive", sorted.filter((feature) => feature.kind === "passive"))}
    ${featureGroup("Capacidades activables", "active", "activation", sorted.filter((feature) => !["passive", "other"].includes(feature.kind)))}
    ${featureGroup("Otros efectos y reglas", "other", "other", sorted.filter((feature) => feature.kind === "other"))}
  </div>`;
}

function readBonusRows(editor: Element | null): InventoryBonus[] {
  const rows = editor?.querySelectorAll<HTMLElement>(":scope > [data-inventory-bonus-rows] > [data-inventory-bonus-row]") ?? [];
  return [...rows].map((row) => {
    const field = <T extends HTMLInputElement | HTMLSelectElement>(name: string): T => {
      const element = row.querySelector<T>(`[data-bonus-field="${name}"]`);
      if (!element) throw new Error(`Falta el campo ${name} de un bono mágico`);
      return element;
    };
    const source = field<HTMLSelectElement>("source").value;
    return {
      category: field<HTMLSelectElement>("category").value,
      key: field<HTMLSelectElement>("key").value,
      value: Number(field<HTMLInputElement>("value").value) || 0,
      valueSource: source === "fixed" ? null : source as Ability,
      advantage: field<HTMLInputElement>("advantage").checked,
      disadvantage: field<HTMLInputElement>("disadvantage").checked,
    };
  });
}

export function readTopLevelInventoryBonuses(container: ParentNode): InventoryBonus[] {
  return readBonusRows(container.querySelector("[data-inventory-top-bonuses]"));
}

export async function readInventoryFeatures(container: ParentNode): Promise<InventoryFeature[]> {
  const rows = [...container.querySelectorAll<HTMLElement>("[data-inventory-feature-row]")];
  const result: InventoryFeature[] = [];
  for (const [order, row] of rows.entries()) {
    const input = (name: string): HTMLInputElement => {
      const element = row.querySelector<HTMLInputElement>(`[data-feature-field="${name}"]`);
      if (!element) throw new Error(`Falta el campo ${name} de una capacidad`);
      return element;
    };
    const select = (name: string): HTMLSelectElement => {
      const element = row.querySelector<HTMLSelectElement>(`[data-feature-field="${name}"]`);
      if (!element) throw new Error(`Falta el campo ${name} de una capacidad`);
      return element;
    };
    const name = input("name").value.trim();
    if (!name) throw new Error("Cada capacidad debe tener un nombre");
    const rolls = [...row.querySelectorAll<HTMLElement>(":scope > fieldset [data-inventory-feature-roll-row]")].flatMap((rollRow) => {
      const expression = rollRow.querySelector<HTMLInputElement>('[data-roll-field="expression"]')?.value.trim() ?? "";
      if (!expression) return [];
      return [{
        label: rollRow.querySelector<HTMLInputElement>('[data-roll-field="label"]')?.value.trim() || "Tirada",
        expression: normalizeRollShortcut(expression),
        mode: (rollRow.querySelector<HTMLSelectElement>('[data-roll-field="mode"]')?.value ?? "normal") as RollMode,
      }];
    });
    const hasUses = input("hasUses").checked;
    const maximum = Math.max(1, Math.trunc(Number(input("usesMaximum").value) || 1));
    result.push({
      id: row.dataset.featureId || await createRandomId("itf"),
      order,
      kind: select("kind").value as InventoryFeatureKind,
      name,
      description: row.querySelector<HTMLTextAreaElement>('[data-feature-field="description"]')?.value ?? "",
      active: input("active").checked,
      toggleable: input("toggleable").checked,
      showInActions: input("showInActions").checked,
      chargeCost: Math.max(0, Math.trunc(Number(input("chargeCost").value) || 0)),
      uses: hasUses ? {
        current: Math.min(maximum, Math.max(0, Math.trunc(Number(input("usesCurrent").value) || 0))),
        maximum,
        reset: select("usesReset").value,
      } : null,
      rolls,
      bonuses: readBonusRows(row.querySelector(":scope > fieldset [data-inventory-feature-bonuses]")),
    });
  }
  return result;
}

function refreshBonusKeySelect(category: HTMLSelectElement): void {
  const row = category.closest<HTMLElement>("[data-inventory-bonus-row]");
  const key = row?.querySelector<HTMLSelectElement>('[data-bonus-field="key"]');
  if (key) key.innerHTML = bonusKeyOptions(category.value, key.value);
}

function refreshBonusValueSource(source: HTMLSelectElement): void {
  const value = source.closest<HTMLElement>("[data-inventory-bonus-row]")?.querySelector<HTMLInputElement>('[data-bonus-field="value"]');
  if (value) value.disabled = source.value !== "fixed";
}

function refreshFeatureUses(toggle: HTMLInputElement): void {
  const row = toggle.closest<HTMLElement>("[data-inventory-feature-row]");
  row?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-feature-field^="uses"]:not([data-feature-field="hasUses"])').forEach((field) => {
    field.disabled = !toggle.checked;
  });
}

export function bindInventoryStructuredEditors(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-structured-inventory-editor]").forEach((editor) => {
    editor.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button || !editor.contains(button)) return;
      if (button.hasAttribute("data-add-inventory-bonus")) {
        button.closest<HTMLElement>("[data-inventory-bonus-editor]")?.querySelector<HTMLElement>("[data-inventory-bonus-rows]")?.insertAdjacentHTML("beforeend", renderBonusRow(null));
      } else if (button.hasAttribute("data-remove-inventory-bonus")) {
        button.closest("[data-inventory-bonus-row]")?.remove();
      } else if (button.hasAttribute("data-add-feature-roll")) {
        button.closest<HTMLElement>("[data-inventory-feature-row]")?.querySelector<HTMLElement>("[data-inventory-feature-rolls]")?.insertAdjacentHTML("beforeend", renderRollRow(null));
      } else if (button.hasAttribute("data-remove-feature-roll")) {
        button.closest("[data-inventory-feature-roll-row]")?.remove();
      } else if (button.dataset.addInventoryFeature) {
        const group = button.closest<HTMLElement>("[data-inventory-feature-group]");
        const rows = group?.querySelector<HTMLElement>("[data-inventory-feature-rows]");
        rows?.insertAdjacentHTML("beforeend", renderFeatureRow(null, button.dataset.addInventoryFeature as InventoryFeatureKind, rows.children.length));
      } else if (button.hasAttribute("data-remove-inventory-feature")) {
        button.closest("[data-inventory-feature-row]")?.remove();
      } else if (button.dataset.moveFeature) {
        const row = button.closest<HTMLElement>("[data-inventory-feature-row]");
        const direction = Number(button.dataset.moveFeature);
        if (!row?.parentElement) return;
        if (direction < 0 && row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
        if (direction > 0 && row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row);
      }
    });
    editor.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.matches('[data-bonus-field="category"]')) refreshBonusKeySelect(target);
      if (target instanceof HTMLSelectElement && target.matches('[data-bonus-field="source"]')) refreshBonusValueSource(target);
      if (target instanceof HTMLInputElement && target.matches('[data-feature-field="hasUses"]')) refreshFeatureUses(target);
    });
  });
}

export function replaceInventoryStructuredEditors(
  container: ParentNode,
  bonuses: readonly InventoryBonus[],
  features: readonly InventoryFeature[],
): void {
  const bonusContainer = container.querySelector<HTMLElement>("[data-inventory-top-bonuses-container]");
  const featureContainer = container.querySelector<HTMLElement>("[data-inventory-features-container]");
  if (bonusContainer) bonusContainer.innerHTML = renderInventoryBonusEditor(bonuses, true);
  if (featureContainer) featureContainer.innerHTML = renderInventoryFeatureEditor(features);
  bindInventoryStructuredEditors(container);
}

export function inventoryFeatureKindLabel(kind: InventoryFeatureKind): string {
  return featureKindLabels[kind];
}
