import { EquipmentPreparationPayloadSchema, emptyEquipmentDefinition, type EquipmentPreparation, type EquipmentPreparationIssue } from "../domain/equipment/equipment-preparation";
import { equipmentCompletionIssues, type EquipmentDefinitionDraft } from "../domain/equipment/equipment-definition";
import { equipmentAutomationGaps, equipmentReviewPolicy } from "../domain/equipment/equipment-policy";
import { EQUIPMENT_RARITIES, equipmentRarityLabel } from "../domain/equipment/equipment-catalog";
import { SRD_51_ATTRIBUTION, SRD_51_SOURCE_URL } from "../domain/equipment/equipment-attribution";
import { equipmentRecoveryLabel } from "../domain/equipment/equipment-resource-runtime";

interface PreparationRuntime {
  saveEquipmentPreparation?: (value: EquipmentPreparation) => Promise<EquipmentPreparation | void>;
  prepareExistingEquipment?: (contentKey: string) => Promise<EquipmentPreparation>;
  loadPreparations: () => Promise<{ equipmentPreparations?: EquipmentPreparation[]; equipmentPreparationIssues?: EquipmentPreparationIssue[] }>;
}
const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const categories: Record<string, string> = { "adventuring-gear": "Equipo de aventura", weapon: "Arma", armor: "Armadura", shield: "Escudo", tool: "Herramienta", ammunition: "Munición", potion: "Poción", scroll: "Pergamino", wand: "Varita", staff: "Bastón", rod: "Cetro", ring: "Anillo", "wondrous-item": "Objeto maravilloso", mount: "Montura", vehicle: "Vehículo", tack: "Accesorio de montura", other: "Otro" };
const sourceKinds = { book: "Libro", srd: "SRD", campaign: "Campaña", legacy: "Versión antigua" };
const editorial = { "official-spanish": "Texto oficial español cotejado", "reviewed-translation": "Traducción propia revisada", campaign: "Texto de campaña", unreviewed: "Texto pendiente de cotejo" };
const options = (values: Record<string, string>, current: string | null): string => `<option value="" ${current === null ? "selected" : ""}>Pendiente</option>${Object.entries(values).map(([value, label]) => `<option value="${escape(value)}" ${current === value ? "selected" : ""}>${escape(label)}</option>`).join("")}`;
const flagOptions = (value: boolean | null): string => options({ yes: "Sí", no: "No" }, value === null ? null : value ? "yes" : "no");

export class EquipmentPreparationPanel {
  private records: EquipmentPreparation[] = [];
  private issues: EquipmentPreparationIssue[] = [];
  private editing: EquipmentPreparation | null = null;
  private selected = "";
  private open = false;
  private search = "";
  private limit = 50;
  private busy = false;
  private loaded = false;
  private attemptedLoad = false;
  private message = "";
  private root: HTMLElement | null = null;

  constructor(private readonly runtime: PreparationRuntime, private readonly rerender: () => void) {}
  setContent(records: EquipmentPreparation[], issues: EquipmentPreparationIssue[]): void { this.records = records; this.issues = issues; this.loaded = true; }
  canPrepare(): boolean { return !this.busy && this.editing === null; }

  async prepare(contentKey: string): Promise<void> {
    if (!this.runtime.prepareExistingEquipment || !this.canPrepare()) return;
    this.busy = true;
    try { this.editing = await this.runtime.prepareExistingEquipment(contentKey); this.selected = this.editing.payload.definition.id; this.open = true; this.message = "Original recuperado. Se guardará como borrador separado."; }
    catch (error) { this.message = error instanceof Error ? error.message : String(error); this.open = true; }
    finally { this.busy = false; this.rerender(); }
  }

  render(): string {
    if (!this.runtime.saveEquipmentPreparation) return "";
    const current = this.editing ?? this.records.find((record) => record.payload.definition.id === this.selected) ?? null;
    const query = this.search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const filtered = this.records.filter((record) => [record.payload.definition.name, ...record.payload.definition.aliases].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query));
    const gaps = this.records.flatMap((record) => equipmentAutomationGaps(record.payload.definition).map((gap) => ({ ...gap, itemName: record.payload.definition.name })));
    const reviewed = this.records.filter((record) => { const review = record.payload.definition.review; return review.identity && review.editorial && review.mechanics; }).length;
    const textReviewed = this.records.filter((record) => record.payload.definition.review.editorial).length;
    return `<details class="gm-equipment-preparation" data-equipment-preparation ${this.open ? "open" : ""}><summary>Catálogo definitivo en preparación · ${this.busy && !this.loaded ? "Cargando…" : this.loaded ? `${this.records.length} borradores` : "Abrir para cargar"}</summary>
      <p>Conservá aquí las versiones completas antes de vincular personajes y comerciantes. Guardar un borrador no reemplaza el equipo actual.</p>
      ${this.loaded ? `<p data-preparation-progress>${textReviewed} con texto revisado · ${this.records.length - textReviewed} pendientes de revisión del texto. ${reviewed} con cotejo de identidad, texto y reglas · ${this.records.length - reviewed} pendientes de ese cotejo. La recuperación de información y la integración de sus funciones se verifican por separado.</p>` : ""}
      <div class="gm-content-card-actions"><button type="button" data-preparation-refresh ${this.canPrepare() ? "" : "disabled"}>Actualizar borradores</button><button type="button" data-preparation-new ${this.canPrepare() ? "" : "disabled"}>Nuevo borrador</button><label>Importar borrador<input type="file" accept="application/json,.json" data-preparation-import ${this.canPrepare() ? "" : "disabled"}></label></div>
      <p role="status" data-preparation-message ${this.message ? "" : "hidden"}>${escape(this.message)}</p>
      ${this.issues.map((issue) => `<p role="alert">${escape(issue.name)}: ${escape(issue.message)}</p>`).join("")}
      <label>Buscar borradores<input type="search" data-preparation-search value="${escape(this.search)}" ${this.editing ? "disabled" : ""}></label>
      <div class="gm-catalog-grid">${filtered.slice(0, this.limit).map((record) => `<button type="button" data-preparation-select="${escape(record.payload.definition.id)}" ${this.canPrepare() ? "" : "disabled"}>${escape(record.payload.definition.name)} · Borrador${equipmentAutomationGaps(record.payload.definition).length ? " · Automatización pendiente" : ""}</button>`).join("") || "<p>No hay borradores guardados que coincidan.</p>"}</div>
      ${filtered.length > this.limit ? `<button type="button" data-preparation-more ${this.canPrepare() ? "" : "disabled"}>Mostrar más · ${filtered.length - this.limit} restantes</button>` : ""}
      ${current ? this.renderRecord(current) : "<p>Usá Preparar en un objeto existente para conservar su original y comenzar la revisión.</p>"}
      <details><summary>Qué falta automatizar · ${gaps.length} pendientes declarados</summary><ul>${gaps.map((gap) => `<li><strong>${escape(gap.itemName)} · ${escape(gap.capabilityName)}:</strong> ${escape(gap.description)}</li>`).join("")}</ul><p>Integración general pendiente del formato nuevo:</p><ul><li>Ejecutar las capacidades nuevas y aplicar sus efectos en las fichas.</li><li>Resolver recursos, recuperaciones por tirada y contenido almacenado.</li><li>Vincular el catálogo completo al tutorial, las posesiones y el comercio.</li></ul></details>
    </details>`;
  }

  private renderRecord(record: EquipmentPreparation): string {
    const value = record.payload.definition, editing = this.editing !== null;
    const blockers = equipmentCompletionIssues(value, equipmentReviewPolicy(value));
    const gaps = equipmentAutomationGaps(value);
    const renderBlock = (block: EquipmentDefinitionDraft["description"][number]): string => {
      const body = block.type === "paragraph" ? `<p style="white-space:pre-wrap">${escape(block.text)}</p>` : block.type === "list" ? `<${block.ordered ? "ol" : "ul"}>${block.items.map((item) => `<li style="white-space:pre-wrap">${escape(item)}</li>`).join("")}</${block.ordered ? "ol" : "ul"}>` : `<table><thead><tr>${block.columns.map((column) => `<th>${escape(column)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td style="white-space:pre-wrap">${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      return `<section><small>${escape(editorial[block.provenance])}${block.section === "gm-notes" ? " · Nota del GM" : ""}</small>${body}</section>`;
    };
    return `<article class="gm-editor-surface" data-preparation-record="${escape(value.id)}"><h3>${escape(value.name)}</h3><p>Borrador · ${escape(value.category === null ? "Categoría pendiente" : categories[value.category] ?? value.category)} · ${value.rarity === null ? "Rareza pendiente" : escape(equipmentRarityLabel(value.rarity))}</p>
      ${editing ? this.renderEditor(value) : `<button type="button" data-preparation-edit ${this.busy ? "disabled" : ""}>Editar borrador</button>`}
      <button type="button" data-preparation-export ${this.busy ? "disabled" : ""}>Exportar borrador completo</button>
      <div class="equipment-preparation-description">${value.description.map(renderBlock).join("") || "<p>Descripción pendiente.</p>"}</div>
      <details><summary>Fuentes y procedencia</summary><ul>${value.sources.map((source) => `<li>${escape(source.title)} · ${escape(sourceKinds[source.kind])} · ${source.language === "es" ? "Español" : source.language === "en" ? "Inglés" : "Idioma pendiente"} · ${source.verified ? "Cotejada" : "Sin cotejar"}${source.locator ? ` · ${escape(source.locator)}` : ""}</li>`).join("") || "<li>Fuentes pendientes.</li>"}</ul>${value.sources.some((source) => /^srd-5\.1-(es|en)-equipment$/.test(source.id)) ? `<p data-equipment-srd-attribution>${escape(SRD_51_ATTRIBUTION)}</p><p><a href="${SRD_51_SOURCE_URL}" target="_blank" rel="noopener noreferrer">Texto oficial español del SRD 5.1</a> · <a href="https://creativecommons.org/licenses/by/4.0/legalcode.es" target="_blank" rel="noopener noreferrer">Licencia CC BY 4.0</a></p><p>Adaptaciones: separación de párrafos y tablas; datos estructurados en unidades del original inglés. Las traducciones propias y las reglas de campaña se identifican por separado.</p>` : ""}</details>
      <details><summary>Recursos · ${value.resources.length}</summary><ul>${value.resources.map((resource) => `<li><strong>${escape(resource.name)}</strong>: ${resource.maximum ?? "capacidad pendiente"} ${escape(resource.unit)} · ${escape(equipmentRecoveryLabel(resource))}${resource.exhaustion ? `<p>${escape(resource.exhaustion)}</p>` : ""}</li>`).join("") || "<li>No hay recursos declarados.</li>"}</ul></details>
      <details open><summary>Capacidades y automatización pendiente</summary>${value.capabilities.map((capability) => this.renderCapability(capability, value)).join("") || "<p>No hay capacidades declaradas. Esto no certifica que el original carezca de poderes.</p>"}<ul>${gaps.map((gap) => `<li>${escape(gap.capabilityName)}: ${escape(gap.description)}</li>`).join("")}</ul></details>
      <details><summary>Qué falta para completar este objeto · ${blockers.length}</summary><ul>${blockers.map((issue) => `<li>${escape(issue)}</li>`).join("")}</ul></details>
      <details><summary>Originales conservados · ${record.payload.originals.length}</summary>${record.payload.originals.map((source) => `<details><summary>${escape(source.originalKey)} · ${escape(source.scope)}</summary><pre style="white-space:pre-wrap">${escape(JSON.stringify(source.raw, null, 2))}</pre></details>`).join("") || "<p>Falta incorporar los originales.</p>"}<p>La revisión de información se conserva por separado de los textos visibles.</p></details>
    </article>`;
  }

  private renderCapability(capability: EquipmentDefinitionDraft["capabilities"][number], definition: EquipmentDefinitionDraft): string {
    const activation = { passive: "Pasiva", action: "Acción", "bonus-action": "Acción adicional", reaction: "Reacción", trigger: "Disparador", other: "Uso especial" }[capability.activation];
    const mode = { automatic: "Automática", assisted: "Resolución asistida", narrative: "Resolución narrativa", unsupported: "Pendiente de integrar y verificar" }[capability.execution.mode];
    const presence = { possessed: "Llevar encima", worn: "Llevar puesto", held: "Sostener o empuñar", equipped: "Equipar", other: "Condición especial" }[capability.requirements.presence];
    const facts = [["Activación", activation], ["Disparador", capability.trigger], ["Objetivo", capability.target], ["Alcance", capability.range], ["Duración", capability.duration], ["Concentración", capability.concentration === "spell-dependent" ? "Según el conjuro utilizado" : capability.concentration ? "Sí" : "No"], ["Presencia", presence], ["Sintonización", capability.requirements.attunement === null ? "Pendiente de cotejo" : capability.requirements.attunement ? "Requerida" : "No requerida"], ["Requisitos", capability.requirements.explanation]];
    const requirements = capability.requirements.bearer.map((bearer) => bearer.explanation);
    const cost = capability.costs.map((entry) => `${entry.amount} ${definition.resources.find((resource) => resource.id === entry.resourceId)?.name ?? entry.resourceId}`);
    if (capability.consumeQuantity) cost.push(`${capability.consumeQuantity} unidad(es) del objeto`);
    return `<section data-equipment-capability="${escape(capability.id)}"><strong>${escape(capability.name)}</strong><dl>${facts.filter(([, text]) => text).map(([label, text]) => `<dt>${escape(label!)}</dt><dd>${escape(text!)}</dd>`).join("")}</dl>${requirements.length ? `<ul>${requirements.map((rule) => `<li>${escape(rule)}</li>`).join("")}</ul>` : ""}${cost.length ? `<p>Costes: ${cost.map(escape).join(" · ")}</p>` : ""}<p>${mode}${capability.execution.explanation ? ` · ${escape(capability.execution.explanation)}` : ""}</p></section>`;
  }

  private renderEditor(value: EquipmentDefinitionDraft): string {
    return `<form data-preparation-form><fieldset ${this.busy ? "disabled" : ""}><label>Nombre<input name="name" value="${escape(value.name)}" required></label><label>Nombres alternativos · uno por línea<textarea name="aliases">${escape(value.aliases.join("\n"))}</textarea></label>
      <label>Categoría<select name="category">${options(categories, value.category)}</select></label><label>Procedencia<select name="origin">${options({ official: "Oficial", campaign: "Campaña" }, value.origin === "unknown" ? null : value.origin)}</select></label>
      <label>Rareza<select name="rarity">${options(Object.fromEntries(EQUIPMENT_RARITIES.map((rarity) => [rarity, equipmentRarityLabel(rarity)])), value.rarity)}</select></label>
      <label>Mágico<select name="magical">${flagOptions(value.magical)}</select></label><label>Consumible<select name="consumable">${flagOptions(value.consumable)}</select></label><label>Requiere sintonización<select name="attunement">${flagOptions(value.requirements.attunement)}</select></label>
      ${value.sources.map((source, index) => `<fieldset><legend>Fuente ${index + 1}</legend><label>Libro o autoría<input name="source-${index}-title" value="${escape(source.title)}"></label><label>Tipo<select name="source-${index}-kind">${options(sourceKinds, source.kind)}</select></label><label>Idioma de la fuente<select name="source-${index}-language">${options({ es: "Español", en: "Inglés", unknown: "Desconocido" }, source.language)}</select></label><label>Edición de reglas<select name="source-${index}-edition">${options({ "2014": "2014" }, source.rulesEdition)}</select></label><label>Página, sección o referencia<input name="source-${index}-locator" value="${escape(source.locator ?? "")}"></label><label><input type="checkbox" name="source-${index}-verified" ${source.verified ? "checked" : ""}>Fuente cotejada</label></fieldset>`).join("")}
      <button type="button" data-preparation-add="source">Añadir fuente</button>
      ${value.description.map((block, index) => `<fieldset><legend>Texto ${index + 1}</legend><label>Procedencia del texto<select name="block-${index}-provenance">${options(editorial, block.provenance)}</select></label>${block.type === "paragraph" ? `<textarea name="block-${index}-text">${escape(block.text)}</textarea>` : block.type === "list" ? block.items.map((item, itemIndex) => `<label>Elemento ${itemIndex + 1}<textarea name="block-${index}-item-${itemIndex}">${escape(item)}</textarea></label>`).join("") : `<div>${block.columns.map((column, columnIndex) => `<label>Columna ${columnIndex + 1}<input name="block-${index}-column-${columnIndex}" value="${escape(column)}"></label>`).join("")}${block.rows.map((row, rowIndex) => row.map((cell, columnIndex) => `<label>Fila ${rowIndex + 1}, columna ${columnIndex + 1}<textarea name="block-${index}-cell-${rowIndex}-${columnIndex}">${escape(cell)}</textarea></label>`).join("")).join("")}</div>`}</fieldset>`).join("")}
      <button type="button" data-preparation-add="paragraph">Añadir párrafo</button><button type="button" data-preparation-add="list">Añadir lista</button><button type="button" data-preparation-add="table">Añadir tabla</button>
      ${value.capabilities.map((capability, index) => `<fieldset><legend>${escape(capability.name)} · Revisión de automatización</legend><label>Cómo se resuelve actualmente<textarea name="capability-${index}-explanation">${escape(capability.execution.explanation)}</textarea></label><label>Qué falta automatizar · un punto por línea<textarea name="capability-${index}-pending">${escape(capability.execution.pendingAutomation.join("\n"))}</textarea></label></fieldset>`).join("")}
      <fieldset><legend>Cotejos realizados</legend>${Object.entries({ identity: "Identidad y variantes", information: "Información útil recuperada", editorial: "Texto español cotejado", mechanics: "Reglas y mecánicas cotejadas" }).map(([key, label]) => `<label><input type="checkbox" name="review-${key}" ${value.review[key as "identity" | "information" | "editorial" | "mechanics"] ? "checked" : ""}>${label}</label>`).join("")}</fieldset>
      <label>Decisiones y revisiones pendientes · una por línea<textarea name="unresolved">${escape(value.review.unresolved.join("\n"))}</textarea></label>
      <p>Esta edición conserva las fuentes, capacidades, recursos y originales completos. No marca el objeto como definitivo.</p>
      <button type="submit" ${this.busy ? "disabled" : ""}>Guardar borrador</button><button type="button" data-preparation-cancel ${this.busy ? "disabled" : ""}>Cancelar edición</button></fieldset></form>`;
  }

  private captureForm(root: HTMLElement): void {
    if (!this.editing) return;
    const form = root.querySelector<HTMLFormElement>("[data-preparation-form]");
    if (!form) return;
    const data = new FormData(form), value = this.editing.payload.definition;
    const text = (name: string): string => String(data.get(name) ?? "");
    const unchanged = (name: string): boolean => {
      const control = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      return control !== null && "defaultValue" in control && control.value === control.defaultValue;
    };
    const preserve = (name: string, original: string): string => unchanged(name) ? original : text(name);
    const flag = (name: string): boolean | null => text(name) === "yes" ? true : text(name) === "no" ? false : null;
    const candidate = { ...value, name: preserve("name", value.name), aliases: unchanged("aliases") ? value.aliases : text("aliases").split("\n").filter((line) => line.trim()),
      category: text("category") || null, origin: text("origin") || "unknown", rarity: text("rarity") || null,
      magical: flag("magical"), consumable: flag("consumable"), requirements: { ...value.requirements, attunement: flag("attunement") },
      sources: value.sources.map((source, index) => ({ ...source, title: preserve(`source-${index}-title`, source.title), kind: text(`source-${index}-kind`), language: text(`source-${index}-language`), rulesEdition: text(`source-${index}-edition`) || null, locator: preserve(`source-${index}-locator`, source.locator ?? "") || null, verified: data.has(`source-${index}-verified`) })),
      description: value.description.map((block, index) => { const common = { ...block, provenance: text(`block-${index}-provenance`) }; return block.type === "paragraph" ? { ...common, text: preserve(`block-${index}-text`, block.text) } : block.type === "list" ? { ...common, items: block.items.map((item, itemIndex) => preserve(`block-${index}-item-${itemIndex}`, item)) } : { ...common, columns: block.columns.map((column, columnIndex) => preserve(`block-${index}-column-${columnIndex}`, column)), rows: block.rows.map((row, rowIndex) => row.map((cell, columnIndex) => preserve(`block-${index}-cell-${rowIndex}-${columnIndex}`, cell))) }; }),
      capabilities: value.capabilities.map((capability, index) => ({ ...capability, execution: { ...capability.execution, explanation: preserve(`capability-${index}-explanation`, capability.execution.explanation), pendingAutomation: unchanged(`capability-${index}-pending`) ? capability.execution.pendingAutomation : text(`capability-${index}-pending`).split("\n").filter((line) => line.trim()) } })),
      review: { identity: data.has("review-identity"), information: data.has("review-information"), editorial: data.has("review-editorial"), mechanics: data.has("review-mechanics"), unresolved: unchanged("unresolved") ? value.review.unresolved : text("unresolved").split("\n").filter((line) => line.trim()) },
    };
    this.editing = { ...this.editing, payload: EquipmentPreparationPayloadSchema.parse({ ...this.editing.payload, definition: candidate }) };
  }

  bind(root: HTMLElement): void {
    this.root = root;
    if (this.editing) {
      const value = this.editing.payload.definition;
      const flag = (input: boolean | null): string => input === null ? "" : input ? "yes" : "no";
      const selected: Record<string, string> = { category: value.category ?? "", origin: value.origin === "unknown" ? "" : value.origin, rarity: value.rarity ?? "", magical: flag(value.magical), consumable: flag(value.consumable), attunement: flag(value.requirements.attunement) };
      value.sources.forEach((source, index) => { selected[`source-${index}-kind`] = source.kind; selected[`source-${index}-language`] = source.language; selected[`source-${index}-edition`] = source.rulesEdition ?? ""; });
      value.description.forEach((block, index) => { selected[`block-${index}-provenance`] = block.provenance; });
      for (const [name, initial] of Object.entries(selected)) {
        const select = root.querySelector<HTMLSelectElement>(`[data-preparation-form] select[name="${name}"]`);
        if (select) select.value = initial;
      }
      const checked: Record<string, boolean> = { "review-identity": value.review.identity, "review-information": value.review.information, "review-editorial": value.review.editorial, "review-mechanics": value.review.mechanics };
      value.sources.forEach((source, index) => { checked[`source-${index}-verified`] = source.verified; });
      for (const [name, initial] of Object.entries(checked)) { const input = root.querySelector<HTMLInputElement>(`[data-preparation-form] input[name="${name}"]`); if (input) input.checked = initial; }
    }
    root.querySelector<HTMLDetailsElement>("[data-equipment-preparation]")?.addEventListener("toggle", (event) => { this.open = (event.currentTarget as HTMLDetailsElement).open; if (this.open && !this.loaded && !this.attemptedLoad && this.canPrepare()) void this.refresh(); });
    root.querySelector<HTMLButtonElement>("[data-preparation-refresh]")?.addEventListener("click", () => { void this.refresh(); });
    root.querySelector<HTMLInputElement>("[data-preparation-search]")?.addEventListener("input", (event) => {
      if (this.editing) return; this.search = (event.currentTarget as HTMLInputElement).value; this.limit = 50; this.rerender();
      const input = root.querySelector<HTMLInputElement>("[data-preparation-search]"); input?.focus(); input?.setSelectionRange(this.search.length, this.search.length);
    });
    root.querySelector<HTMLButtonElement>("[data-preparation-new]")?.addEventListener("click", () => {
      if (this.editing) { this.message = "Guardá o cancelá la edición actual antes de comenzar otra."; return; }
      this.editing = { payload: EquipmentPreparationPayloadSchema.parse({ schemaVersion: 2, kind: "equipment", language: "es", format: "equipment-preparation", definition: emptyEquipmentDefinition(crypto.randomUUID(), "Nuevo objeto"), originals: [], decisions: [] }), catalog: null };
      this.open = true; this.rerender();
    });
    root.querySelectorAll<HTMLButtonElement>("[data-preparation-select]").forEach((button) => button.addEventListener("click", () => { if (this.editing) return; this.selected = button.dataset.preparationSelect ?? ""; this.rerender(); }));
    root.querySelector<HTMLButtonElement>("[data-preparation-more]")?.addEventListener("click", () => { this.limit += 50; this.rerender(); });
    root.querySelector<HTMLButtonElement>("[data-preparation-edit]")?.addEventListener("click", () => { const record = this.records.find((item) => item.payload.definition.id === this.selected); if (record) { this.editing = structuredClone(record); this.rerender(); } });
    root.querySelector<HTMLButtonElement>("[data-preparation-cancel]")?.addEventListener("click", () => { this.editing = null; this.message = ""; this.rerender(); });
    root.querySelector<HTMLFormElement>("[data-preparation-form]")?.addEventListener("submit", (event) => { event.preventDefault(); void this.save(root); });
    const invalidateReview = (event: Event): void => {
      const input = event.target as HTMLInputElement;
      if (!input.name || input.name.startsWith("review-") || input.name === "unresolved") return;
      root.querySelectorAll<HTMLInputElement>('[data-preparation-form] input[name^="review-"]').forEach((checkbox) => { checkbox.checked = false; });
    };
    root.querySelector("[data-preparation-form]")?.addEventListener("input", invalidateReview);
    root.querySelector("[data-preparation-form]")?.addEventListener("change", invalidateReview);
    root.querySelectorAll<HTMLButtonElement>("[data-preparation-add]").forEach((button) => button.addEventListener("click", () => {
      if (this.busy) return;
      try {
        this.captureForm(root); if (!this.editing) return;
        const value = this.editing.payload.definition, type = button.dataset.preparationAdd;
        if (type === "source") value.sources.push({ id: crypto.randomUUID(), title: "Fuente pendiente", kind: "legacy", language: "es", rulesEdition: null, locator: null, verified: false });
        else {
          const source = value.sources[0]; if (!source) throw new Error("Agregá primero la fuente del texto.");
          const common = { id: crypto.randomUUID(), section: "rules" as const, provenance: "unreviewed" as const, sourceIds: [source.id] };
          if (type === "paragraph") value.description.push({ ...common, type: "paragraph", text: "Texto pendiente de completar." });
          if (type === "list") value.description.push({ ...common, type: "list", ordered: false, items: ["Elemento pendiente de completar."] });
          if (type === "table") value.description.push({ ...common, type: "table", columns: ["Columna 1", "Columna 2"], rows: [["", ""]] });
        }
        value.review = { ...value.review, identity: false, information: false, editorial: false, mechanics: false };
        this.rerender();
      } catch (error) { this.fail(error); }
    }));
    root.querySelector<HTMLInputElement>("[data-preparation-import]")?.addEventListener("change", (event) => { const file = (event.currentTarget as HTMLInputElement).files?.[0]; if (file) void this.importFile(file); });
    root.querySelector<HTMLButtonElement>("[data-preparation-export]")?.addEventListener("click", () => {
      try {
        this.captureForm(root); const record = this.editing ?? this.records.find((item) => item.payload.definition.id === this.selected); if (!record) return;
        const url = URL.createObjectURL(new Blob([JSON.stringify(record.payload, null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "objeto-en-preparacion.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { this.fail(error); }
    });
  }

  private async importFile(file: File): Promise<void> {
    if (this.busy || this.editing) { this.message = "Guardá o cancelá la edición actual antes de importar."; this.rerender(); return; }
    try {
      if (file.size > 10_000_000) throw new Error("El borrador supera el tamaño de importación admitido.");
      const payload = EquipmentPreparationPayloadSchema.parse(JSON.parse(await file.text()));
      if (this.records.some((item) => item.payload.definition.id === payload.definition.id)) throw new Error("Ya existe este borrador. Abrilo para editarlo; la importación no sobrescribe versiones guardadas.");
      this.editing = { payload, catalog: null }; this.open = true; this.message = "Borrador importado para revisar; todavía no se guardó."; this.rerender();
    } catch (error) { this.fail(error); }
  }

  private async refresh(): Promise<void> {
    if (!this.canPrepare()) return;
    this.attemptedLoad = true; this.busy = true; this.message = "Cargando borradores…"; this.rerender();
    try {
      const loaded = await this.runtime.loadPreparations();
      this.setContent(loaded.equipmentPreparations ?? [], loaded.equipmentPreparationIssues ?? []);
      this.message = "Borradores actualizados.";
    } catch (error) { this.message = error instanceof Error ? error.message : String(error); }
    finally { this.busy = false; this.rerender(); }
  }

  private async save(root: HTMLElement): Promise<void> {
    if (!this.runtime.saveEquipmentPreparation || this.busy) return;
    try { this.captureForm(root); } catch (error) { this.fail(error); return; }
    let confirmed = false;
    try {
      if (!this.editing) return;
      const record = structuredClone(this.editing); this.busy = true;
      this.rerender();
      const saved = await this.runtime.saveEquipmentPreparation(record);
      confirmed = true;
      if (saved) {
        this.records = [...this.records.filter((entry) => entry.payload.definition.id !== saved.payload.definition.id), structuredClone(saved)];
        this.selected = saved.payload.definition.id; this.editing = null;
      }
      const loaded = await this.runtime.loadPreparations();
      this.setContent(loaded.equipmentPreparations ?? [], loaded.equipmentPreparationIssues ?? []);
      this.selected = record.payload.definition.id; this.editing = null; this.message = "Borrador guardado. El catálogo activo y las posesiones se conservan.";
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.message = confirmed ? `El borrador se guardó. No se pudo actualizar la lista: ${detail}. Usá Actualizar borradores para volver a cargarla.` : detail;
    }
    finally { this.busy = false; this.rerender(); }
  }
  private fail(error: unknown): void {
    this.message = error instanceof Error ? error.message : String(error);
    if (this.editing) {
      const status = this.root?.querySelector<HTMLElement>("[data-preparation-message]");
      if (status) { status.textContent = this.message; status.hidden = false; }
    } else this.rerender();
  }
}
