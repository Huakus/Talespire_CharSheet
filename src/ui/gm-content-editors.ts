import type { SpellDefinition } from "../domain/character/character-spell-model";
import type { EquipmentCatalogDraft } from "../domain/equipment/equipment-catalog";
import { DAMAGE_TYPES, EQUIPMENT_CATEGORIES, EQUIPMENT_PROPERTIES, EQUIPMENT_RARITIES, equipmentRarityLabel } from "../domain/equipment/equipment-catalog";
import type { CatalogMetadata } from "../domain/content/catalog-metadata";
import { SPELL_SCHOOLS, SPELL_COMPONENTS, SPELL_CLASS_OPTIONS, spellDamageTypeName } from "../domain/spells/spell-catalog";
import { renderCheckboxGroup, type CheckboxChoice } from "./checkbox-group";
import { renderInventoryBonusEditor, renderInventoryFeatureEditor } from "./inventory-capability-editor";
import { equipmentPropertyLabel } from "../domain/equipment/equipment-constants";
import { SPELL_SOURCE_TAGS, spellSourceLabel, spellSourceTag } from "../domain/spells/spell-source";

export const editorEscape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function editorToolbar(label: string): string {
  return `<header class="gm-content-editor-toolbar"><strong>${label}</strong><div><button type="button" data-gm-cancel-edit>Descartar y volver</button><button type="submit">Guardar ${label.toLowerCase()}</button></div></header>`;
}
export function editorSection(title: string, content: string, options: { collapsible?: boolean; open?: boolean; detail?: string } = {}): string {
  const body = `<div class="gm-editor-section-body">${content}</div>`;
  return options.collapsible ? `<details class="gm-editor-section" ${options.open ? "open" : ""}><summary>${title}${options.detail ? `<small>${options.detail}</small>` : ""}</summary>${body}</details>` : `<fieldset class="gm-editor-section"><legend>${title}</legend>${body}</fieldset>`;
}
export function editorInput(name: string, label: string, value: string | number, options = "", wide = false): string {
  return `<label${wide ? ' class="gm-field-wide"' : ""}>${label}<input name="${name}" value="${editorEscape(String(value))}" ${options}></label>`;
}
export function editorNumber(name: string, label: string, value: number | null, options = 'min="0" step="1"'): string {
  return editorInput(name, label, value ?? "", `type="number" ${options}`);
}
export function editorSelect(name: string, label: string, values: readonly CheckboxChoice[], current: string, empty?: string): string {
  const choices = values.map(v => typeof v === "string" ? { value: v, label: v } : v);
  if (empty !== undefined && !choices.some(v => v.value === "")) choices.unshift({ value: "", label: empty });
  if (current && !choices.some(v => v.value === current)) choices.push({ value: current, label: current });
  return `<label>${label}<select name="${name}">${choices.map(v => `<option value="${editorEscape(v.value)}" ${v.value === current ? "selected" : ""}>${editorEscape(v.label)}</option>`).join("")}</select></label>`;
}
export function editorToggle(name: string, label: string, checked: boolean): string {
  return `<label class="gm-editor-toggle"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><span>${label}</span></label>`;
}
function editorText(name: string, label: string, value: string, rows = 4): string {
  return `<label>${label}<textarea name="${name}" rows="${rows}">${editorEscape(value)}</textarea></label>`;
}
export function editorMetadata(meta: CatalogMetadata): string {
  return editorSection("Etiquetas de campaña", `<span class="catalog-origin ${editorEscape(meta.origin)}">${({ official: "Oficial", gm: "Personalizado", imported: "Importado" })[meta.origin]}</span>${editorInput("catalogTags", "Etiquetas", meta.tags.filter(t => t.toLowerCase() !== "favorite").join(", "), 'placeholder="Separadas por comas"', true)}`, { collapsible: true });
}
const damageTypes = DAMAGE_TYPES.map(value => ({ value, label: spellDamageTypeName(value) || value }));
const categoryLabels: Record<string, string> = { "adventuring-gear": "Equipo de aventura", weapon: "Arma", armor: "Armadura", shield: "Escudo", tool: "Herramienta", ammunition: "Munición", potion: "Poción", scroll: "Pergamino", wand: "Varita", staff: "Bastón", rod: "Cetro", ring: "Anillo", "wondrous-item": "Objeto maravilloso" };
const abilities = [{ value: "strength", label: "Fuerza" }, { value: "dexterity", label: "Destreza" }, { value: "constitution", label: "Constitución" }, { value: "intelligence", label: "Inteligencia" }, { value: "wisdom", label: "Sabiduría" }, { value: "charisma", label: "Carisma" }];

export function renderSpellEditor(spell: SpellDefinition | null, meta: CatalogMetadata): string {
  return `<form data-gm-form="spell" class="gm-editor-form gm-content-editor gm-spell-editor"><input type="hidden" name="previousKey" value="${editorEscape(spell?.name ?? "")}">${editorToolbar("Conjuro")}
    ${editorSection("Identidad", `<p class="field-help">Origen: ${editorEscape(spellSourceLabel(spellSourceTag(spell) ?? "custom"))}</p><div class="gm-editor-grid">${editorInput("name", "Nombre", spell?.name ?? "", "required", true)}${editorSelect("level", "Nivel", Array.from({ length: 10 }, (_, n) => ({ value: String(n), label: n ? `Nivel ${n}` : "Truco" })), String(spell?.level ?? 0))}${editorSelect("school", "Escuela", SPELL_SCHOOLS, spell?.school ?? "", "Sin escuela")}${editorInput("year", "Edición / año", spell?.year ?? "2014", 'list="gm-spell-years"')}<datalist id="gm-spell-years"><option value="2014"></option><option value="2024"></option></datalist></div>`)}
    ${editorSection("Lanzamiento", `<div class="gm-editor-grid">${editorInput("castingTime", "Tiempo", spell?.castingTime ?? "1 acción")}${editorInput("range", "Alcance", spell?.range ?? "")}${editorInput("duration", "Duración", spell?.duration ?? "")}</div><div class="gm-editor-toggles">${editorToggle("ritual", "Ritual", spell?.ritual ?? false)}${editorToggle("concentration", "Concentración", spell?.concentration ?? false)}</div><div class="gm-editor-components">${renderCheckboxGroup("Componentes", "components", SPELL_COMPONENTS, spell?.components.split(/[, ]+/).filter(Boolean) ?? [])}${editorInput("material", "Materiales", spell?.material ?? "")}</div>`)}
    ${editorSection("Efecto y tiradas", `<div class="gm-editor-grid">${editorSelect("attackType", "Resolución", [{ value: "none", label: "Sin ataque ni salvación" }, { value: "attack", label: "Ataque de conjuro" }, { value: "save", label: "Salvación del objetivo" }], spell?.attackType ?? "none")}${editorSelect("saveAbility", "Salvación", abilities, spell?.saveAbility ?? "", "No aplica")}${editorSelect("damageType", "Tipo de daño", damageTypes, spell?.damageType ?? "", "Sin daño")}${editorInput("damageExpression", "Dados de daño / curación", spell?.damageExpression ?? "", 'placeholder="2d6"')}${editorInput("upcastDamageExpression", "Dados por nivel adicional", spell?.upcastDamageExpression ?? "", 'placeholder="1d6"')}</div><div class="gm-editor-toggles">${editorToggle("addAbilityModifier", "Sumar modificador de conjuración al efecto", spell?.addAbilityModifier ?? false)}</div><p class="field-help">La CD y el bono de ataque pertenecen al lanzador. Estos campos definen el efecto del conjuro y su escalado.</p>`)}
    ${editorSection("Reglas", `${editorText("description", "Descripción", spell?.description ?? "", 6)}${editorText("higherLevels", "A niveles superiores", spell?.higherLevels ?? "", 3)}`)}
    ${editorSection("Clases", renderCheckboxGroup("Disponible para", "classes", SPELL_CLASS_OPTIONS, spell?.classes ?? []), { collapsible: true, open: true })}
    ${editorMetadata({ ...meta, tags: meta.tags.filter(tag => !SPELL_SOURCE_TAGS.some(source => source === tag.toLowerCase())) })}
  </form>`;
}

export function renderEquipmentEditor(item: EquipmentCatalogDraft | null, meta: CatalogMetadata, canPrepare = false): string {
  const kind = item?.weapon ? "weapon" : item?.armor ? "armor" : "gear";
  const weapon = item?.weapon, armor = item?.armor;
  return `<form data-gm-form="equipment" class="gm-editor-form gm-content-editor gm-equipment-editor"><input type="hidden" name="previousKey" value="${editorEscape(item?.name ?? "")}">${editorToolbar("Objeto")}
    ${editorSection("Identidad y valor", `<div class="gm-editor-grid">${editorInput("name", "Nombre", item?.name ?? "", "required", true)}${editorSelect("itemKind", "Tipo", [{ value: "gear", label: "Objeto" }, { value: "weapon", label: "Arma" }, { value: "armor", label: "Armadura / escudo" }], kind)}${editorSelect("category", "Categoría", EQUIPMENT_CATEGORIES.map(value => ({ value, label: categoryLabels[value] ?? value })), item?.category ?? "adventuring-gear")}${editorSelect("rarity", "Rareza", EQUIPMENT_RARITIES.map(value => ({ value, label: equipmentRarityLabel(value) })), item?.rarity ?? "none")}${editorNumber("weight", "Peso unitario (lb)", item?.unitWeight ?? 0, 'min="0" step="0.01"')}${editorNumber("quantity", "Cantidad inicial", item?.quantity ?? 1)}${editorNumber("costQuantity", "Precio unitario", item?.cost.quantity ?? 0, 'min="0" step="0.01"')}${editorSelect("costUnit", "Moneda", ["cp", "sp", "ep", "gp", "pp"], item?.cost.unit ?? "gp")}</div>`)}
    <fieldset class="gm-editor-section" data-equipment-section="weapon" ${kind === "weapon" ? "" : "hidden"}><legend>Arma</legend><div class="gm-editor-section-body gm-editor-grid">${editorInput("weaponCategory", "Categoría de arma", weapon?.category ?? "")}${editorInput("weaponRange", "Alcance / tipo", weapon?.range ?? "")}${editorNumber("normalRange", "Alcance normal (pies)", weapon?.normalRange ?? null)}${editorNumber("longRange", "Alcance largo (pies)", weapon?.longRange ?? null)}${editorInput("damageExpression", "Dados de daño", weapon?.damageExpression ?? "")}${editorInput("versatileDamageExpression", "Daño versátil", weapon?.versatileDamageExpression ?? "")}${editorSelect("damageType", "Tipo de daño", damageTypes, weapon?.damageType ?? "", "Sin daño")}${editorNumber("attackBonus", "Bono de ataque", weapon?.attackBonus ?? 0, 'step="1"')}${editorNumber("damageBonus", "Bono de daño", weapon?.damageBonus ?? 0, 'step="1"')}</div></fieldset>
    <fieldset class="gm-editor-section" data-equipment-section="armor" ${kind === "armor" ? "" : "hidden"}><legend>Armadura / escudo</legend><div class="gm-editor-section-body"><div class="gm-editor-grid">${editorNumber("armorBase", "CA base", armor?.base ?? 10, 'step="1"')}${editorSelect("armorCategory", "Categoría", [{ value: "light", label: "Ligera" }, { value: "medium", label: "Media" }, { value: "heavy", label: "Pesada" }, { value: "shield", label: "Escudo" }], armor?.armorCategory ?? "", "Sin categoría")}${editorNumber("maximumDexterityBonus", "Límite de DES", armor?.maximumDexterityBonus ?? null)}${editorNumber("strengthRequirement", "Fuerza requerida", armor?.strengthRequirement ?? null)}</div><div class="gm-editor-toggles">${editorToggle("dexterityBonus", "Sumar Destreza", armor?.dexterityBonus ?? false)}${editorToggle("stealthDisadvantage", "Desventaja en Sigilo", armor?.stealthDisadvantage ?? false)}</div></div></fieldset>
    ${editorSection("Propiedades", renderCheckboxGroup("Propiedades del objeto", "properties", EQUIPMENT_PROPERTIES.map(value => ({ value, label: equipmentPropertyLabel(value) })), item?.properties ?? []), { collapsible: true, detail: `${item?.properties.length ?? 0} seleccionadas` })}
    ${editorSection("Uso y cargas", `<div class="gm-editor-toggles">${editorToggle("usable", "Usable", item?.usable ?? false)}${editorToggle("consumable", "Consumible", item?.consumable ?? false)}${editorToggle("requiresAttunement", "Requiere sintonización", item?.requiresAttunement ?? false)}${editorToggle("hasCharges", "Usa cargas", Boolean(item?.charges))}</div><div class="gm-editor-grid" data-equipment-charge-fields ${item?.charges ? "" : "hidden"}>${editorNumber("chargesCurrent", "Cargas actuales", item?.charges?.current ?? 0)}${editorNumber("chargesMaximum", "Cargas máximas", item?.charges?.maximum ?? 0)}${editorSelect("chargesReset", "Recuperación", [{ value: "none", label: "Sin recuperación" }, { value: "short-rest", label: "Descanso corto" }, { value: "long-rest", label: "Descanso largo" }, { value: "dawn", label: "Al amanecer" }, { value: "daily", label: "Diaria" }, { value: "never", label: "Nunca" }], item?.charges?.reset ?? "none")}</div>`, { collapsible: true, open: true })}
    ${editorSection("Bonificaciones permanentes", `<p class="field-help">Se aplican al equipar y sintonizar.</p><div data-inventory-top-bonuses-container>${renderInventoryBonusEditor(item?.bonuses ?? [], true)}</div>`, { collapsible: true, open: Boolean(item?.bonuses.length), detail: String(item?.bonuses.length ?? 0) })}
    ${editorSection("Capacidades", `<div data-inventory-features-container>${renderInventoryFeatureEditor(item?.features ?? [])}</div>`, { collapsible: true, open: Boolean(item?.features.length), detail: String(item?.features.length ?? 0) })}
    ${editorSection("Descripción", editorText("description", "Descripción del objeto", item?.description ?? "", 5))}
    ${editorSection("Estado inicial y efecto adicional", `<div class="gm-editor-toggles">${editorToggle("equipped", "Equipado inicialmente", item?.equipped ?? false)}${editorToggle("attuned", "Sintonizado inicialmente", item?.attuned ?? false)}${editorToggle("effectActive", "Efecto adicional activo", item?.effect.active ?? false)}</div>${editorText("effectDescription", "Efecto adicional", item?.effect.description ?? "", 3)}`, { collapsible: true })}
    ${item?.rules ? editorSection("Reglas avanzadas", `<p class="field-help">Las reglas y recursos vinculados se conservan al guardar. Usá la preparación del objeto para editar su definición completa.</p>${canPrepare && meta.contentKey ? `<button type="button" data-gm-edit-equipment-rules="${editorEscape(meta.contentKey)}">Editar reglas en preparación</button>` : ""}`, { collapsible: true }) : ""}
    ${editorMetadata(meta)}
  </form>`;
}

export function bindContentEditorVisibility(root: ParentNode): void {
  const item = root.querySelector<HTMLFormElement>('[data-gm-form="equipment"]');
  const update = () => {
    const kind = item?.querySelector<HTMLSelectElement>('[name="itemKind"]')?.value;
    item?.querySelectorAll<HTMLElement>("[data-equipment-section]").forEach(section => { section.hidden = section.dataset.equipmentSection !== kind; });
    const charges = item?.querySelector<HTMLElement>("[data-equipment-charge-fields]");
    if (charges) charges.hidden = !item?.querySelector<HTMLInputElement>('[name="hasCharges"]')?.checked;
  };
  item?.querySelector('[name="itemKind"]')?.addEventListener("change", update);
  item?.querySelector('[name="hasCharges"]')?.addEventListener("change", update);
  update();
}
