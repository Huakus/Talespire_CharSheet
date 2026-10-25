import type { MonsterDefinition, MonsterFeature } from "../domain/monsters/monster-catalog";
import { DAMAGE_TYPES } from "../domain/equipment/equipment-catalog";
import { renderCheckboxGroup } from "./checkbox-group";

const FEATURE_SECTIONS = [
  ["traits", "Rasgos", "rasgo"], ["actions", "Acciones", "acción"],
  ["reactions", "Reacciones", "reacción"], ["legendaryActions", "Acciones legendarias", "acción legendaria"],
] as const;

const DAMAGE_LABELS: Record<typeof DAMAGE_TYPES[number], string> = {
  acid: "Ácido", bludgeoning: "Contundente", cold: "Frío", fire: "Fuego", force: "Fuerza",
  lightning: "Relámpago", necrotic: "Necrótico", piercing: "Perforante", poison: "Veneno",
  psychic: "Psíquico", radiant: "Radiante", slashing: "Cortante", thunder: "Trueno",
};

function html(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function readMonsterFeatures(value: string): MonsterFeature[] {
  const parsed: unknown = JSON.parse(value || "[]");
  if (!Array.isArray(parsed) || parsed.some((entry) => !entry || typeof entry.name !== "string"
    || typeof entry.content !== "string" || typeof entry.usage !== "string")) {
    throw new Error("No se pudieron leer los rasgos o acciones del borrador.");
  }
  return parsed.map(({ name, content, usage }) => ({ name, content, usage }));
}

function featureRow(feature: MonsterFeature): string {
  return `<article class="gm-monster-feature-row">
    <div class="gm-monster-feature-heading"><label>Nombre<input data-feature-part="name" value="${html(feature.name)}" placeholder="Nombre del rasgo o acción"></label><label><span>Uso <small>opcional</small></span><input data-feature-part="usage" value="${html(feature.usage)}" placeholder="Ej.: 3/día, recarga 5–6"></label><button type="button" data-remove-feature aria-label="Quitar entrada" title="Quitar entrada">×</button></div>
    <label>Descripción<textarea data-feature-part="content" rows="3" placeholder="Efecto, ataque, daño o condiciones…">${html(feature.content)}</textarea></label>
  </article>`;
}

export function renderMonsterFeatures(monster: MonsterDefinition | null): string {
  return FEATURE_SECTIONS.map(([key, label, singular]) => {
    const entries = monster?.[key] ?? [];
    return `<details class="gm-monster-section gm-monster-feature-section" data-feature-section="${key}" ${entries.length || key === "actions" ? "open" : ""}>
      <summary>${label}<small data-feature-count>${entries.length}</small></summary>
      <div class="gm-monster-section-body"><input type="hidden" name="${key}" value="${html(JSON.stringify(entries))}">
        <div class="gm-monster-feature-list">${entries.map(featureRow).join("")}</div>
        <p class="gm-monster-empty" data-feature-empty ${entries.length ? "hidden" : ""}>Sin entradas.</p>
        <button type="button" data-add-feature>+ Agregar ${singular}</button>
      </div></details>`;
  }).join("");
}

export function renderMonsterDefenses(monster: MonsterDefinition | null, conditionChoices: readonly { value: string; label: string }[]): string {
  const groups = [
    { name: "vulnerabilities", label: "Vulnerable", description: "Vulnerabilidad", values: monster?.damageVulnerabilities ?? [] },
    { name: "resistances", label: "Resiste", description: "Resistencia", values: monster?.damageResistances ?? [] },
    { name: "immunities", label: "Inmune", description: "Inmunidad", values: monster?.damageImmunities ?? [] },
  ];
  const selected = groups.reduce((count, group) => count + group.values.length, 0) + (monster?.conditionImmunities.length ?? 0);
  const known = new Set<string>(DAMAGE_TYPES);
  return `<details class="gm-monster-section" data-monster-defenses ${selected ? "open" : ""}><summary>Defensas<small data-defenses-count>${selected ? `${selected} seleccionadas` : "Daño y condiciones"}</small></summary>
    <div class="gm-monster-section-body"><table class="gm-monster-damage-matrix"><caption>Tipos de daño</caption>
      <thead><tr><th scope="col">Tipo de daño</th>${groups.map((group) => `<th scope="col">${group.label}</th>`).join("")}</tr></thead>
      <tbody>${DAMAGE_TYPES.map((type) => `<tr><th scope="row">${DAMAGE_LABELS[type]}</th>${groups.map((group) => `<td><label><input type="checkbox" name="${group.name}" value="${type}" aria-label="${group.description}: ${DAMAGE_LABELS[type]}" ${group.values.includes(type) ? "checked" : ""}></label></td>`).join("")}</tr>`).join("")}</tbody></table>
      ${groups.map((group) => { const other = group.values.filter((value) => !known.has(value)); return other.length ? renderCheckboxGroup(`Otras: ${group.description.toLocaleLowerCase()}`, group.name, [], other) : ""; }).join("")}
      ${renderCheckboxGroup("Inmunidad a condiciones", "conditionImmunities", conditionChoices, monster?.conditionImmunities ?? [])}
    </div></details>`;
}

export function renderMonsterSpells(choices: readonly string[], selected: readonly string[]): string {
  const selectedNames = new Set(selected);
  const ordered = [...selected, ...choices.filter((name) => !selectedNames.has(name))];
  return `<details class="gm-monster-section gm-monster-spells" ${selected.length ? "open" : ""}><summary>Conjuros<small data-spell-count>${selected.length} seleccionados</small></summary>
    <div class="gm-monster-section-body"><div class="gm-monster-spell-search"><input type="search" data-monster-spell-search aria-label="Buscar conjuros" placeholder="Buscar conjuro…"><label class="checkbox"><input type="checkbox" data-monster-spells-selected> Sólo seleccionados</label></div>
      ${renderCheckboxGroup("Conjuros disponibles", "spells", [...new Set(ordered)], selected)}
      <p class="gm-monster-empty" data-spell-empty hidden>Sin conjuros que coincidan.</p>
    </div></details>`;
}

export function bindMonsterEditor(form: HTMLFormElement | null): void {
  if (!form) return;
  for (const input of form.querySelectorAll<HTMLInputElement>("[data-monster-ability]")) {
    const update = () => {
      const score = input.valueAsNumber;
      const modifier = Math.floor((score - 10) / 2);
      input.parentElement!.querySelector("output")!.textContent = Number.isFinite(score) ? `${modifier >= 0 ? "+" : ""}${modifier}` : "—";
    };
    input.addEventListener("input", update);
    update();
  }
  for (const section of form.querySelectorAll<HTMLElement>("[data-feature-section]")) {
    const source = section.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    const list = section.querySelector<HTMLElement>(".gm-monster-feature-list")!;
    // The hidden JSON is the draft source; rebuild dynamic rows after draft restoration.
    list.innerHTML = readMonsterFeatures(source.value).map(featureRow).join("");
    if (list.children.length) (section as HTMLDetailsElement).open = true;
    const updateCount = () => {
      const count = list.children.length;
      section.querySelector("[data-feature-count]")!.textContent = String(count);
      section.querySelector<HTMLElement>("[data-feature-empty]")!.hidden = count > 0;
    };
    const sync = () => {
      source.value = JSON.stringify([...list.querySelectorAll<HTMLElement>(".gm-monster-feature-row")].map((row) => {
        const value = (part: string) => row.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-feature-part="${part}"]`)!.value;
        return { name: value("name"), content: value("content"), usage: value("usage") };
      }));
      updateCount();
    };
    const changed = () => { sync(); source.dispatchEvent(new Event("input", { bubbles: true })); };
    section.addEventListener("input", (event) => {
      if ((event.target as HTMLElement).matches("[data-feature-part]")) sync();
    });
    section.addEventListener("change", (event) => {
      if ((event.target as HTMLElement).matches("[data-feature-part]")) sync();
    });
    form.addEventListener("submit", changed, { capture: true });
    section.querySelector("[data-add-feature]")!.addEventListener("click", () => {
      list.insertAdjacentHTML("beforeend", featureRow({ name: "", content: "", usage: "" }));
      changed();
      list.lastElementChild?.querySelector<HTMLInputElement>("[data-feature-part=name]")?.focus();
    });
    list.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest("[data-remove-feature]");
      if (!button) return;
      const row = button.closest<HTMLElement>(".gm-monster-feature-row")!;
      const next = row.nextElementSibling ?? row.previousElementSibling;
      row.remove(); changed();
      if (next) next.querySelector<HTMLInputElement>("[data-feature-part=name]")?.focus();
      else section.querySelector<HTMLButtonElement>("[data-add-feature]")!.focus();
    });
    updateCount();
  }
  const defenses = form.querySelector<HTMLDetailsElement>("[data-monster-defenses]");
  if (defenses) {
    const count = () => {
      const selected = defenses.querySelectorAll('input[type="checkbox"]:checked').length;
      defenses.querySelector("[data-defenses-count]")!.textContent = selected ? `${selected} seleccionadas` : "Daño y condiciones";
      return selected;
    };
    defenses.addEventListener("change", count);
    if (count()) defenses.open = true;
  }
  const spells = form.querySelector<HTMLElement>(".gm-monster-spells");
  if (spells) {
    const search = spells.querySelector<HTMLInputElement>("[data-monster-spell-search]")!;
    const selectedOnly = spells.querySelector<HTMLInputElement>("[data-monster-spells-selected]")!;
    const options = [...spells.querySelectorAll<HTMLLabelElement>(".gm-checkbox-group label")];
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
    const filter = () => {
      const query = normalize(search.value);
      let visible = 0; let selected = 0;
      for (const label of options) {
        const input = label.querySelector<HTMLInputElement>("input")!;
        if (input.checked) selected++;
        label.hidden = Boolean(selectedOnly.checked && !input.checked) || !normalize(input.value).includes(query);
        if (!label.hidden) visible++;
      }
      spells.querySelector("[data-spell-count]")!.textContent = `${selected} seleccionados`;
      spells.querySelector<HTMLElement>("[data-spell-empty]")!.hidden = visible > 0 || options.length === 0;
    };
    search.addEventListener("input", filter);
    spells.addEventListener("change", filter);
    filter();
  }
}
