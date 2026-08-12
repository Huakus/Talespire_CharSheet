import type { CampaignSnapshot } from "../application/ports/campaign-repository";
import type { CharacterInventoryItemV2 } from "../domain/character/character-inventory-model";
import { inventoryItemsCanStack } from "../domain/character/character-inventory";
import type { SpellDefinition } from "../domain/character/character-spell-model";
import { inventoryCostInCopper, merchantChallengeTarget, merchantNpcStatistics, normalizeMerchantInteraction } from "../domain/commerce/merchant-interaction";
import {
  DAMAGE_TYPES, EQUIPMENT_CATEGORIES, EQUIPMENT_PROPERTIES, EQUIPMENT_RARITIES,
  equipmentRarityLabel, normalizeEquipmentDefinition, normalizeEquipmentRarity, type EquipmentCatalogDraft,
} from "../domain/equipment/equipment-catalog";
import { SPELL_CLASSES, SPELL_COMPONENTS, SPELL_SAVE_ABILITIES, SPELL_SCHOOLS } from "../domain/spells/spell-catalog";
import { type GmChecklistItem, type GmShop } from "../domain/gm/gm-global-content";
import { removeGmNoteGroup, type GmWorkspace } from "../domain/gm/gm-workspace";
import type { CampaignContent } from "../domain/content/campaign-content";
import type { CatalogMetadata } from "../domain/content/catalog-metadata";
import { createRandomId } from "../shared/id";
import { renderCheckboxGroup } from "./checkbox-group";
import { inventoryViewIsVisible, inventoryViewMatchesBasicFilter, renderSharedInventoryCard } from "./inventory-view";

export type GmSection = "encounter" | "content" | "notes" | "tools";
export type GmContentSection = "spell" | "equipment" | "shop";
export type GmToolSection = "checklist" | "tables" | "travel" | "npc" | "reference" | "docs";

export interface GmToolsRuntime {
  loadGmContent?: () => Promise<CampaignContent>;
  saveCustomSpell?: (definition: SpellDefinition, previousKey: string | null) => Promise<void>;
  deleteCustomSpell?: (key: string) => Promise<void>;
  saveCustomEquipment?: (definition: EquipmentCatalogDraft, previousKey: string | null) => Promise<void>;
  deleteCustomEquipment?: (key: string) => Promise<void>;
  saveShop?: (shop: GmShop, previousKey: string | null) => Promise<void>;
  saveCustomMonster?: (monster: CampaignContent["monsters"][number], previousKey: string | null) => Promise<void>;
  deleteShop?: (key: string) => Promise<void>;
  saveChecklistItem?: (item: GmChecklistItem) => Promise<void>;
  deleteChecklistItem?: (key: string) => Promise<void>;
  saveGmWorkspace?: (workspace: GmWorkspace, expectedChecksum: string) => Promise<CampaignSnapshot>;
}

type Message = { kind: "success" | "error"; text: string };
const FAVORITE_TAG = "favorite";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function number(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

interface ContentFilterGroup { key: string; label: string; values: string[] }

function filterToken(group: string, value: string): string { return `${group}\u0000${value}`; }
function selectedFilterValues(filters: ReadonlySet<string>, group: string): string[] {
  const prefix = `${group}\u0000`;
  return [...filters].filter((filter) => filter.startsWith(prefix)).map((filter) => filter.slice(prefix.length));
}
export function matchesGroupedFilters(filters: ReadonlySet<string>, values: Record<string, readonly string[]>): boolean {
  const groups = new Set([...filters].map((filter) => filter.slice(0, filter.indexOf("\u0000"))));
  return [...groups].every((group) => {
    const selected = new Set(selectedFilterValues(filters, group).map(normalizedSearch));
    return (values[group] ?? []).some((value) => selected.has(normalizedSearch(value)));
  });
}
function splitValues(value: string): string[] {
  return value.split(/[,;]+/).map((entry) => entry.trim()).filter(Boolean);
}
function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "es", { numeric: true, sensitivity: "base" }));
}

function catalogMetadata(value: { catalog?: CatalogMetadata | null } | null): CatalogMetadata {
  return value?.catalog ?? { origin: "gm", tags: ["gm"], contentKey: "", revision: 0 };
}

function visibleCatalogTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => normalizedSearch(tag) !== FAVORITE_TAG);
}

function isCatalogFavorite(value: { catalog?: CatalogMetadata | null } | null): boolean {
  return catalogMetadata(value).tags.some((tag) => normalizedSearch(tag) === FAVORITE_TAG);
}

function withFavoriteTag<T extends { catalog?: CatalogMetadata | null }>(value: T, favorite: boolean): T {
  const metadata = catalogMetadata(value);
  const tags = visibleCatalogTags(metadata.tags);
  if (favorite) tags.push(FAVORITE_TAG);
  return { ...value, catalog: { ...metadata, tags } };
}

function catalogFormMetadata(value: { catalog?: CatalogMetadata | null } | null, data: FormData): CatalogMetadata {
  const current = catalogMetadata(value);
  const tags = String(data.get("catalogTags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  if (current.tags.some((tag) => normalizedSearch(tag) === FAVORITE_TAG)) tags.push(FAVORITE_TAG);
  return { ...current, tags };
}

function selectOptions(values: readonly string[], selected: string, emptyLabel?: string): string {
  return [...new Set([...(emptyLabel === undefined ? [] : [""]), ...values, ...(selected && !values.includes(selected) ? [selected] : [])])]
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value || emptyLabel || "—")}</option>`).join("");
}

export class GmToolsPanel {
  private content: CampaignContent = { spells: [], equipment: [], monsters: [], shops: [], checklist: [] };
  private selectedSpell = "";
  private selectedEquipment = "";
  private selectedShop = "";
  private activeTool: GmToolSection = "checklist";
  private editingContent: GmContentSection | null = null;
  private contentTemplate: { section: GmContentSection; value: SpellDefinition | EquipmentCatalogDraft | GmShop } | null = null;
  private shopInventoryDraft: CharacterInventoryItemV2[] | null = null;
  private shopInventorySearch = "";
  private shopInventoryFilters = new Set<string>();
  private shopInventoryTagFilters = new Set<string>();
  private shopInventoryRarityFilters = new Set<string>();
  private shopInventoryIncludeCatalog = false;
  private shopInventoryNpcId = "";
  private contentSearch: Record<GmContentSection, string> = { spell: "", equipment: "", shop: "" };
  private contentFilters: Record<GmContentSection, Set<string>> = { spell: new Set(), equipment: new Set(), shop: new Set() };
  private contentShowAll: Record<GmContentSection, boolean> = { spell: true, equipment: true, shop: true };
  private contentFavoritesOnly: Record<GmContentSection, boolean> = { spell: false, equipment: false, shop: false };
  private pendingDeleteContent: { section: GmContentSection; key: string } | null = null;
  private openContentFilterGroup: Record<GmContentSection, string | null> = { spell: null, equipment: null, shop: null };
  private showContentDescriptions = true;

  constructor(
    private readonly root: HTMLElement,
    private readonly runtime: GmToolsRuntime,
    private readonly updateSnapshot: (snapshot: CampaignSnapshot, label?: string) => void,
    private readonly setMessage: (message: Message) => void,
    private readonly rerender: () => void,
    private readonly recordAction: (label: string, kind?: "action" | "roll" | "system") => void = () => undefined,
  ) {}

  async load(): Promise<void> {
    if (!this.runtime.loadGmContent) return;
    this.content = await this.runtime.loadGmContent();
    this.selectedSpell = this.content.spells[0]?.name ?? "";
    this.selectedEquipment = this.content.equipment[0]?.name ?? "";
    this.selectedShop = this.content.shops[0]?.name ?? "";
  }

  contentCount(section: GmContentSection): number {
    return section === "spell" ? this.content.spells.length : section === "equipment" ? this.content.equipment.length : this.content.shops.length;
  }

  render(section: GmSection, workspace: GmWorkspace, contentSection: GmContentSection = "spell"): string {
    if (section === "content") return this.renderContent(contentSection);
    if (section === "notes") return this.renderNotes(workspace);
    if (section === "tools") return this.renderTools(workspace);
    return "";
  }

  bind(section: GmSection, workspace: GmWorkspace, checksum: string): void {
    if (section === "content") this.bindContent();
    if (section === "notes") this.bindNotes(workspace, checksum);
    if (section === "tools") this.bindTools(workspace, checksum);
  }

  private renderContent(section: GmContentSection): string {
    const template = this.contentTemplate?.section === section ? this.contentTemplate.value : null;
    const spell = (section === "spell" && template ? template as SpellDefinition : this.content.spells.find((entry) => entry.name === this.selectedSpell)) ?? null;
    const equipment = (section === "equipment" && template ? template as EquipmentCatalogDraft : this.content.equipment.find((entry) => entry.name === this.selectedEquipment)) ?? null;
    const shop = (section === "shop" && template ? template as GmShop : this.content.shops.find((entry) => entry.name === this.selectedShop)) ?? null;
    const editing = this.editingContent === section;
    if (editing) {
      const form = section === "spell" ? this.renderSpellForm(spell) : section === "equipment" ? this.renderEquipmentForm(equipment) : this.renderShopForm(shop);
      return `<section class="gm-editor-surface"><div class="gm-edit-heading"><strong>${spell?.name ?? equipment?.name ?? shop?.name ?? (section === "spell" ? "Nuevo conjuro" : section === "equipment" ? "Nuevo objeto" : "Nuevo comerciante")}</strong><button type="button" data-gm-cancel-edit>Volver</button></div>${form}</section>`;
    }
    const query = normalizedSearch(this.contentSearch[section]);
    const favoriteFirst = <T,>(entries: T[], favorite: (entry: T) => boolean, name: (entry: T) => string): T[] => entries.sort((left, right) =>
      Number(favorite(right)) - Number(favorite(left)) || name(left).localeCompare(name(right), "es", { sensitivity: "base" }));
    const cards = section === "spell"
      ? favoriteFirst(this.content.spells.filter((entry) => { const meta = catalogMetadata(entry); return (!this.contentFavoritesOnly.spell || isCatalogFavorite(entry)) && this.matchesSpellFilters(entry) && (!query || normalizedSearch([entry.name, entry.school, entry.description, entry.damageType, entry.classes, meta.origin, ...visibleCatalogTags(meta.tags)].join(" ")).includes(query)); }), isCatalogFavorite, (entry) => entry.name).map((entry) => this.renderSpellCard(entry)).join("")
      : section === "equipment"
        ? favoriteFirst(this.content.equipment.filter((entry) => { const meta = catalogMetadata(entry); return (!this.contentFavoritesOnly.equipment || isCatalogFavorite(entry)) && this.matchesEquipmentFilters(entry) && (!query || normalizedSearch([entry.name, entry.category, entry.rarity, entry.description, ...entry.properties, meta.origin, ...visibleCatalogTags(meta.tags)].join(" ")).includes(query)); }), isCatalogFavorite, (entry) => entry.name).map((entry) => this.renderEquipmentCard(entry)).join("")
        : favoriteFirst(this.content.shops.filter((entry) => (!this.contentFavoritesOnly.shop || this.isShopFavorite(entry)) && this.matchesShopFilters(entry) && (!query || normalizedSearch([entry.name, ...this.shopVisibleTags(entry), ...Object.keys(entry.categories), ...Object.values(entry.categories).flat()].join(" ")).includes(query))), (entry) => this.isShopFavorite(entry), (entry) => entry.name).map((entry) => this.renderShopCard(entry)).join("");
    const label = section === "spell" ? "conjuro" : section === "equipment" ? "objeto" : "comerciante";
    return `<section class="gm-content-catalog">${this.renderContentDiscovery(section, label)}${this.renderContentFilterBar(section)}<div class="gm-catalog-grid">${cards}</div><div class="sheet-empty gm-content-empty" ${cards ? "hidden" : ""}><strong>Sin resultados</strong><p>No hay ${label}s que coincidan con los filtros.</p></div></section>`;
  }

  syncMonsterInventory(monster: CampaignContent["monsters"][number]): void {
    const key = normalizedSearch(monster.id || monster.name);
    this.content.monsters = [...this.content.monsters.filter((entry) => normalizedSearch(entry.id || entry.name) !== key), monster];
  }

  private isShopFavorite(shop: GmShop): boolean {
    return (shop.tags ?? []).some((tag) => normalizedSearch(tag) === FAVORITE_TAG);
  }

  private shopVisibleTags(shop: GmShop): string[] {
    return visibleCatalogTags(shop.tags ?? []);
  }

  private linkedMerchantNpc(shop: GmShop) {
    const key = normalizedSearch(shop.npcId ?? "");
    return key ? this.content.monsters.find((monster) => normalizedSearch(monster.id) === key || normalizedSearch(monster.name) === key) ?? null : null;
  }

  private renderContentDiscovery(section: GmContentSection, label: string): string {
    return `<div class="spell-search-row gm-content-search-row"><label class="spell-search"><span>Buscar</span><input data-gm-content-search="${section}" type="search" value="${escapeHtml(this.contentSearch[section])}" placeholder="Nombre, tipo, propiedad…"></label><button type="button" class="description-toggle" data-gm-toggle-descriptions>${this.showContentDescriptions ? "Ocultar descripciones" : "Mostrar descripciones"}</button><button type="button" data-gm-new="${section}">+ ${label}</button></div>`;
  }

  private renderContentFilterBar(section: GmContentSection): string {
    const groups = this.contentFilterGroups(section);
    const active = this.contentFilters[section];
    const showingAll = !this.contentSearch[section].trim() && active.size === 0 && !this.contentFavoritesOnly[section];
    return `<nav class="filter-bar property-filter gm-content-filter-bar gm-grouped-filters"><button type="button" data-gm-show-all-content="${section}" class="${showingAll ? "active" : ""}" aria-pressed="${showingAll}">Todos</button><button type="button" data-gm-favorites-only="${section}" class="gm-favorites-filter ${this.contentFavoritesOnly[section] ? "active" : ""}" aria-pressed="${this.contentFavoritesOnly[section]}">★ Favoritos</button>${groups.map((group) => { const selected = selectedFilterValues(active, group.key); return `<details class="gm-filter-group ${selected.length ? "active" : ""}" ${this.openContentFilterGroup[section] === group.key ? "open" : ""}><summary>${escapeHtml(group.label)}${selected.length ? `<strong>${selected.length}</strong>` : ""}</summary><div>${group.values.map((value) => { const token = filterToken(group.key, value); const label = group.key === "rarity" ? equipmentRarityLabel(value) : value; return `<button type="button" data-gm-content-filter-value="${escapeHtml(value)}" data-gm-filter-group="${escapeHtml(group.key)}" data-gm-filter-section="${section}" class="${active.has(token) ? "active" : ""}" aria-pressed="${active.has(token)}">${escapeHtml(label)}</button>`; }).join("")}</div></details>`; }).join("")}</nav>`;
  }

  private contentFilterGroups(section: GmContentSection): ContentFilterGroup[] {
    if (section === "spell") return [
      { key: "level", label: "Nivel", values: uniqueValues(this.content.spells.map((spell) => String(spell.level))) },
      { key: "school", label: "Escuela", values: uniqueValues(this.content.spells.map((spell) => spell.school)) },
      { key: "class", label: "Clase", values: uniqueValues(this.content.spells.flatMap((spell) => splitValues(spell.classes))) },
      { key: "component", label: "Componente", values: uniqueValues(this.content.spells.flatMap((spell) => spell.components.split(/[,;\s]+/).filter(Boolean))) },
      { key: "damage", label: "Tipo de daño", values: uniqueValues(this.content.spells.map((spell) => spell.damageType)) },
      { key: "resolution", label: "Resolución", values: uniqueValues(this.content.spells.map((spell) => spell.attackType === "attack" ? "Ataque" : spell.attackType === "save" ? "Salvación" : "")) },
      { key: "edition", label: "Edición", values: uniqueValues(this.content.spells.map((spell) => spell.year)) },
      { key: "tag", label: "Etiquetas", values: uniqueValues(this.content.spells.flatMap((spell) => visibleCatalogTags(catalogMetadata(spell).tags))) },
    ].filter((group) => group.values.length);
    if (section === "equipment") return [
      { key: "category", label: "Categoría", values: uniqueValues(this.content.equipment.map((item) => item.category)) },
      { key: "rarity", label: "Rareza", values: uniqueValues(this.content.equipment.map((item) => item.rarity)) },
      { key: "property", label: "Propiedad", values: uniqueValues(this.content.equipment.flatMap((item) => item.properties)) },
      { key: "kind", label: "Tipo", values: uniqueValues(this.content.equipment.map((item) => item.weapon ? "Arma" : item.armor ? "Armadura" : "Equipo")) },
      { key: "damage", label: "Tipo de daño", values: uniqueValues(this.content.equipment.map((item) => item.weapon?.damageType ?? "")) },
      { key: "weaponCategory", label: "Categoría de arma", values: uniqueValues(this.content.equipment.map((item) => item.weapon?.category ?? "")) },
      { key: "armorCategory", label: "Categoría de armadura", values: uniqueValues(this.content.equipment.map((item) => item.armor?.armorCategory ?? "")) },
      { key: "tag", label: "Etiquetas", values: uniqueValues(this.content.equipment.flatMap((item) => visibleCatalogTags(catalogMetadata(item).tags))) },
    ].filter((group) => group.values.length);
    return [
      { key: "category", label: "Categoría", values: uniqueValues(this.content.shops.flatMap((shop) => Object.keys(shop.categories))) },
      { key: "tag", label: "Etiquetas", values: uniqueValues(this.content.shops.flatMap((shop) => this.shopVisibleTags(shop))) },
    ].filter((group) => group.values.length);
  }

  private matchesSpellFilters(spell: SpellDefinition): boolean {
    return matchesGroupedFilters(this.contentFilters.spell, {
      level: [String(spell.level)], school: [spell.school], class: splitValues(spell.classes),
      component: spell.components.split(/[,;\s]+/).filter(Boolean), damage: [spell.damageType],
      resolution: [spell.attackType === "attack" ? "Ataque" : spell.attackType === "save" ? "Salvación" : ""], edition: [spell.year],
      tag: visibleCatalogTags(catalogMetadata(spell).tags),
    });
  }

  private matchesEquipmentFilters(item: EquipmentCatalogDraft): boolean {
    return matchesGroupedFilters(this.contentFilters.equipment, {
      category: [item.category], rarity: [item.rarity], property: item.properties,
      kind: [item.weapon ? "Arma" : item.armor ? "Armadura" : "Equipo"], damage: [item.weapon?.damageType ?? ""],
      weaponCategory: [item.weapon?.category ?? ""], armorCategory: [item.armor?.armorCategory ?? ""],
      tag: visibleCatalogTags(catalogMetadata(item).tags),
    });
  }

  private matchesShopFilters(shop: GmShop): boolean {
    return matchesGroupedFilters(this.contentFilters.shop, { category: Object.keys(shop.categories), tag: this.shopVisibleTags(shop) });
  }

  private renderCatalogCardActions(section: GmContentSection, key: string): string {
    const confirming = this.pendingDeleteContent?.section === section && this.pendingDeleteContent.key === key;
    return `<div class="gm-content-card-actions"><div><button type="button" data-gm-edit="${section}" data-gm-content-key="${escapeHtml(key)}">Editar</button><button type="button" data-gm-delete="${section}" data-gm-content-key="${escapeHtml(key)}" class="${confirming ? "danger-confirm" : ""}">${confirming ? "Confirmar eliminación" : "Eliminar"}</button></div><button type="button" data-gm-template="${section}" data-gm-content-key="${escapeHtml(key)}" title="Crear una copia editable">Clonar</button></div>`;
  }

  private renderFavoriteButton(section: GmContentSection, key: string, favorite: boolean): string {
    return `<button type="button" class="favorite-toggle ${favorite ? "active" : ""}" data-gm-toggle-favorite="${section}" data-gm-content-key="${escapeHtml(key)}" aria-pressed="${favorite}" title="${favorite ? "Quitar de favoritos" : "Agregar a favoritos"}">${favorite ? "★" : "☆"}</button>`;
  }

  private renderSpellCard(spell: SpellDefinition): string {
    const meta = catalogMetadata(spell);
    const tags = visibleCatalogTags(meta.tags);
    const search = [spell.name, spell.school, spell.description, spell.damageType, spell.classes, meta.origin, ...tags].join(" ").toLocaleLowerCase();
    return `<article class="play-card spell-play-card gm-catalog-card ${isCatalogFavorite(spell) ? "favorite" : ""}" data-gm-content-card data-search="${escapeHtml(search)}"><header class="spell-play-header"><div class="spell-title"><div class="spell-meta-line"><span class="catalog-origin ${escapeHtml(meta.origin)}">${escapeHtml(meta.origin)}</span><span class="school-badge">${escapeHtml(spell.school || "Sin escuela")}</span><span class="action-kind-label">Nivel ${spell.level}</span></div><div class="spell-name-line"><h3>${escapeHtml(spell.name)}</h3>${this.renderFavoriteButton("spell", spell.name, isCatalogFavorite(spell))}</div></div>${this.renderCatalogCardActions("spell", spell.name)}</header><div class="gm-card-facts"><span><small>Tiempo</small>${escapeHtml(spell.castingTime || "—")}</span><span><small>Alcance</small>${escapeHtml(spell.range || "—")}</span><span><small>Duración</small>${escapeHtml(spell.duration || "—")}</span><span><small>Clases</small>${escapeHtml(spell.classes || "—")}</span>${spell.ritual ? "<span>Ritual</span>" : ""}${spell.concentration ? "<span>Concentración</span>" : ""}</div>${tags.length ? `<div class="catalog-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}${this.showContentDescriptions ? `<p class="card-description">${escapeHtml(spell.description || "Sin descripción.")}</p>` : ""}</article>`;
  }

  private renderEquipmentCard(item: EquipmentCatalogDraft): string {
    const meta = catalogMetadata(item);
    const tags = visibleCatalogTags(meta.tags);
    const search = [item.name, item.category, item.rarity, item.description, ...item.properties, meta.origin, ...tags].join(" ").toLocaleLowerCase();
    return `<article class="inventory-row gm-catalog-card ${isCatalogFavorite(item) ? "favorite" : ""}" data-gm-content-card data-search="${escapeHtml(search)}"><header class="inventory-row-header"><div class="inventory-row-main"><div><strong>${escapeHtml(item.name)}</strong>${this.renderFavoriteButton("equipment", item.name, isCatalogFavorite(item))}</div><span class="inventory-category">${escapeHtml(item.category)}</span><span class="rarity-badge" data-rarity="${escapeHtml(normalizeEquipmentRarity(item.rarity))}">${escapeHtml(equipmentRarityLabel(item.rarity))}</span><span class="catalog-origin ${escapeHtml(meta.origin)}">${escapeHtml(meta.origin)}</span></div>${this.renderCatalogCardActions("equipment", item.name)}</header><div class="inventory-row-stats"><span><small>Peso</small>${item.unitWeight} lb</span><span><small>Costo</small>${item.cost.quantity} ${escapeHtml(item.cost.unit)}</span>${item.weapon ? `<span><small>Daño</small>${escapeHtml(item.weapon.damageExpression)} ${escapeHtml(item.weapon.damageType)}</span>` : ""}${item.consumable ? "<span>Consumible</span>" : ""}</div>${tags.length ? `<div class="catalog-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}${this.showContentDescriptions ? `<p class="card-description">${escapeHtml(item.description || "Sin descripción.")}</p>` : ""}</article>`;
  }

  private renderShopCard(shop: GmShop): string {
    const tags = this.shopVisibleTags(shop);
    const interaction = normalizeMerchantInteraction(shop.interactions);
    const npc = this.linkedMerchantNpc(shop);
    const items = npc?.inventory ?? [];
    const statistics = npc ? merchantNpcStatistics(npc) : { charisma: 0, perception: 0 };
    const enabled = [interaction.negotiation ? "Negociar" : "", interaction.barter ? "Trueque" : "", interaction.loot ? "Loot" : "", interaction.steal ? "Robo" : ""].filter(Boolean);
    const search = [shop.name, ...tags, ...items.flatMap((item) => [item.name, item.category, ...item.properties])].join(" ").toLocaleLowerCase();
    return `<article class="play-card gm-catalog-card gm-shop-card ${this.isShopFavorite(shop) ? "favorite" : ""}" data-gm-content-card data-search="${escapeHtml(search)}"><header><div><span class="card-kicker">${npc ? `NPC asociado · ${escapeHtml(npc.name)} · ` : "Sin NPC asociado · "}${items.reduce((sum, item) => sum + item.quantity, 0)} objetos</span><div class="gm-card-title-row"><h3>${escapeHtml(shop.name)}</h3>${this.renderFavoriteButton("shop", shop.name, this.isShopFavorite(shop))}</div></div>${this.renderCatalogCardActions("shop", shop.name)}</header><div class="gm-card-facts"><span><small>Reputación</small>${interaction.reputation}</span><span><small>Comisión</small>${interaction.commissionPercent}%</span><span><small>Fondos</small>${interaction.fundsCopper} PC</span><span><small>CAR del NPC</small>${statistics.charisma >= 0 ? "+" : ""}${statistics.charisma}</span><span><small>PER del NPC</small>${statistics.perception >= 0 ? "+" : ""}${statistics.perception}</span><span><small>CD negociación</small>${merchantChallengeTarget(interaction, statistics.charisma)}</span><span><small>CD hurto base</small>${merchantChallengeTarget(interaction, statistics.perception)}</span></div>${tags.length ? `<div class="catalog-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}<div class="gm-shop-category-tags">${enabled.map((label) => `<span>${label}</span>`).join("")}</div>${this.showContentDescriptions ? `<p class="card-description">${escapeHtml(items.slice(0, 8).map((item) => `${item.name} ×${item.quantity}`).join(" · ") || "Sin objetos")}${items.length > 8 ? "…" : ""}</p>` : ""}</article>`;
  }

  private renderSpellView(spell: SpellDefinition): string {
    const flags = [spell.ritual ? "Ritual" : "", spell.concentration ? "Concentración" : "", spell.attackType === "attack" ? "Ataque" : spell.attackType === "save" ? "Salvación" : ""].filter(Boolean);
    return `<article class="gm-content-view"><div class="gm-content-facts"><span>Nivel <strong>${spell.level}</strong></span><span>${escapeHtml(spell.school || "Sin escuela")}</span><span>${escapeHtml(spell.castingTime || "—")}</span><span>${escapeHtml(spell.range || "—")}</span><span>${escapeHtml(spell.duration || "—")}</span></div>${flags.length ? `<p class="gm-content-tags">${flags.join(" · ")}</p>` : ""}${spell.damageExpression ? `<p><b>Daño:</b> ${escapeHtml(spell.damageExpression)} ${escapeHtml(spell.damageType)}</p>` : ""}<p>${escapeHtml(spell.description || "Sin descripción.")}</p>${spell.higherLevels ? `<p><b>A niveles superiores:</b> ${escapeHtml(spell.higherLevels)}</p>` : ""}</article>`;
  }

  private renderEquipmentView(item: EquipmentCatalogDraft): string {
    return `<article class="gm-content-view"><div class="gm-content-facts"><span>${escapeHtml(item.category)}</span><span>Rareza <strong>${escapeHtml(equipmentRarityLabel(item.rarity))}</strong></span><span>Peso <strong>${item.unitWeight}</strong></span><span>Costo <strong>${item.cost.quantity} ${escapeHtml(item.cost.unit)}</strong></span>${item.consumable ? "<span>Consumible</span>" : ""}${item.requiresAttunement ? "<span>Sintonización</span>" : ""}</div>${item.weapon ? `<p><b>Daño:</b> ${escapeHtml(item.weapon.damageExpression)} ${escapeHtml(item.weapon.damageType)}</p>` : ""}${item.properties.length ? `<p><b>Propiedades:</b> ${escapeHtml(item.properties.join(", "))}</p>` : ""}<p>${escapeHtml(item.description || "Sin descripción.")}</p></article>`;
  }

  private shopInventoryDefinition(item: CharacterInventoryItemV2 | EquipmentCatalogDraft): EquipmentCatalogDraft | null {
    return "rarity" in item ? item : this.content.equipment.find((entry) => normalizedSearch(entry.name) === normalizedSearch(item.name)) ?? null;
  }

  private shopInventoryRarity(item: CharacterInventoryItemV2 | EquipmentCatalogDraft): string {
    return normalizeEquipmentRarity(this.shopInventoryDefinition(item)?.rarity);
  }

  private shopInventoryTags(item: CharacterInventoryItemV2 | EquipmentCatalogDraft): string[] {
    return visibleCatalogTags(catalogMetadata(this.shopInventoryDefinition(item) ?? item).tags);
  }

  private shopInventoryVisible(item: CharacterInventoryItemV2 | EquipmentCatalogDraft): boolean {
    return inventoryViewIsVisible(item, {
      search: this.shopInventorySearch, filters: this.shopInventoryFilters,
      tagFilters: this.shopInventoryTagFilters, rarityFilters: this.shopInventoryRarityFilters,
    }, this.shopInventoryRarity(item), this.shopInventoryTags(item));
  }

  private renderShopInventoryCard(item: CharacterInventoryItemV2 | EquipmentCatalogDraft, catalog = false): string {
    const owned = !catalog && "id" in item ? item : null;
    const quantity = owned?.quantity ?? 1;
    const rarity = this.shopInventoryRarity(item);
    const category = normalizedSearch(item.category);
    const tone = item.weapon ? "weapon" : item.armor ? "armor" : item.consumable ? "consumable" : category.includes("tool") ? "tool" : "gear";
    const labels: Record<string, string> = { weapon: "Arma", armor: "Armadura", consumable: "Consumible", tool: "Herramienta", gear: "Equipo" };
    const controls = owned
      ? `<div class="inventory-quantity-control" aria-label="Cantidad de ${escapeHtml(item.name)}"><button type="button" data-gm-shop-inventory-quantity="-1">−</button><strong>${quantity}</strong><button type="button" data-gm-shop-inventory-quantity="1">+</button></div>`
      : '<span class="inventory-catalog-state">No adquirido</span>';
    const actions = catalog
      ? `<div class="inventory-row-actions"><button type="button" data-gm-shop-add-catalog="${escapeHtml(item.name)}">Agregar</button></div>`
      : `<div class="inventory-row-actions">${owned?.usable ? '<button type="button" data-gm-shop-inventory-action="use">Usar</button>' : ""}<button type="button" class="secondary-button" data-gm-shop-inventory-action="equip">${owned?.equipped ? "Quitar" : "Equipar"}</button>${owned?.requiresAttunement && owned.equipped ? `<button type="button" class="secondary-button" data-gm-shop-inventory-action="attune">${owned.attuned ? "Desintonizar" : "Sintonizar"}</button>` : ""}<button type="button" class="secondary-button danger" data-gm-shop-inventory-action="remove">Eliminar</button></div>`;
    return renderSharedInventoryCard({
      item, rarity, rarityLabel: equipmentRarityLabel(rarity), categoryTone: tone, categoryLabel: labels[tone] ?? item.category,
      quantity, catalog, articleAttributes: owned ? `data-gm-shop-inventory-item="${escapeHtml(owned.id)}"` : "",
      headerControlHtml: controls,
      statsHtml: `<span><small>Costo unitario</small>${item.cost.quantity} ${escapeHtml(item.cost.unit)}</span><span><small>Total</small>${inventoryCostInCopper(item.cost) * quantity} PC</span>${item.weapon?.damageExpression ? `<span><small>Daño</small>${escapeHtml(item.weapon.damageExpression)} ${escapeHtml(item.weapon.damageType)}</span>` : ""}${item.charges ? `<span><small>Cargas</small>${item.charges.current}/${item.charges.maximum}</span>` : ""}${owned?.attuned ? "<span>Sintonizado</span>" : ""}${owned?.equipped ? "<span>Equipado</span>" : ""}`,
      descriptionHtml: this.showContentDescriptions && item.description ? `<p class="card-description">${escapeHtml(item.description)}</p>` : "",
      tags: this.shopInventoryTags(item), actionsHtml: actions,
    });
  }

  private renderShopInventory(shop: GmShop | null): string {
    const npcKey = normalizedSearch(this.shopInventoryNpcId || shop?.npcId || "");
    const npc = this.content.monsters.find((monster) => normalizedSearch(monster.id) === npcKey || normalizedSearch(monster.name) === npcKey) ?? null;
    const inventory = this.shopInventoryDraft ?? npc?.inventory ?? [];
    const items = inventory.filter((item) => this.shopInventoryVisible(item));
    const ownedNames = new Set(inventory.map((item) => normalizedSearch(item.name)));
    const catalog = this.shopInventoryIncludeCatalog
      ? this.content.equipment.filter((item) => !ownedNames.has(normalizedSearch(item.name)) && this.shopInventoryVisible(item))
      : [];
    const source = [...inventory, ...this.content.equipment];
    const filters: readonly [string, string][] = [["equipped", "Equipado"], ["weapon", "Armas"], ["armor", "Armaduras"], ["consumable", "Consumibles"], ["usable", "Usables"], ["attunement", "Sintonización"]];
    const tags = uniqueValues(source.flatMap((item) => this.shopInventoryTags(item)));
    const rarities = uniqueValues(source.map((item) => this.shopInventoryRarity(item)));
    const noFilters = !this.shopInventoryFilters.size && !this.shopInventoryTagFilters.size && !this.shopInventoryRarityFilters.size;
    const tagMenu = tags.length ? `<details class="gm-filter-group player-filter-group ${this.shopInventoryTagFilters.size ? "active" : ""}"><summary>Etiquetas${this.shopInventoryTagFilters.size ? `<strong>${this.shopInventoryTagFilters.size}</strong>` : ""}</summary><div>${tags.map((tag) => `<button type="button" data-gm-shop-inventory-tag="${escapeHtml(tag)}" class="${this.shopInventoryTagFilters.has(tag) ? "active" : ""}">${escapeHtml(tag)}</button>`).join("")}</div></details>` : "";
    const rarityMenu = rarities.length ? `<details class="gm-filter-group player-filter-group ${this.shopInventoryRarityFilters.size ? "active" : ""}"><summary>Rareza${this.shopInventoryRarityFilters.size ? `<strong>${this.shopInventoryRarityFilters.size}</strong>` : ""}</summary><div>${rarities.map((rarity) => `<button type="button" data-gm-shop-inventory-rarity="${escapeHtml(rarity)}" class="${this.shopInventoryRarityFilters.has(rarity) ? "active" : ""}">${escapeHtml(equipmentRarityLabel(rarity))}</button>`).join("")}</div></details>` : "";
    const cards = `${items.map((item) => this.renderShopInventoryCard(item)).join("")}${catalog.map((item) => this.renderShopInventoryCard(item, true)).join("")}`;
    return `<section class="gm-shop-inventory"><div class="section-heading"><h3>Inventario del comerciante</h3><span>${inventory.reduce((sum, item) => sum + item.quantity, 0)} objetos</span></div>${npc ? `<div class="spell-discovery inventory-discovery"><div class="spell-search-row inventory-search-row"><label class="spell-search inventory-search"><span>Buscar</span><input data-gm-shop-inventory-search type="search" value="${escapeHtml(this.shopInventorySearch)}" placeholder="Nombre, tipo, propiedad…"></label><button type="button" class="description-toggle" data-gm-shop-inventory-descriptions>${this.showContentDescriptions ? "Ocultar descripciones" : "Mostrar descripciones"}</button></div><nav class="filter-bar property-filter inventory-filter-bar"><button type="button" data-gm-shop-inventory-clear class="${noFilters ? "active" : ""}">Limpiar</button>${filters.map(([value, label]) => `<button type="button" data-gm-shop-inventory-filter="${value}" class="${this.shopInventoryFilters.has(value) ? "active" : ""}"><span>${label}</span><strong>${inventory.filter((item) => inventoryViewMatchesBasicFilter(item, value)).length}</strong></button>`).join("")}${tagMenu}${rarityMenu}<button type="button" class="catalog-toggle ${this.shopInventoryIncludeCatalog ? "active" : ""}" data-gm-shop-inventory-catalog>${this.shopInventoryIncludeCatalog ? "Ocultar catálogo" : "Mostrar catálogo"}</button></nav></div><div class="inventory-dense-list">${cards || '<div class="sheet-empty"><p>No hay objetos que coincidan con la búsqueda y los filtros.</p></div>'}</div>` : '<div class="sheet-empty"><p>Seleccioná un NPC asociado para administrar su inventario.</p></div>'}</section>`;
  }

  private renderSpellForm(spell: SpellDefinition | null): string {
    const components = spell?.components.split(/[, ]+/).filter(Boolean) ?? [];
    const classes = spell?.classes.split(/[,;]+/).map((value) => value.trim()).filter(Boolean) ?? [];
    const meta = catalogMetadata(spell);
    return `<form data-gm-form="spell" class="gm-editor-form">
      <input type="hidden" name="previousKey" value="${escapeHtml(spell?.name ?? "")}">
      <div class="catalog-editor-meta"><span class="catalog-origin ${escapeHtml(meta.origin)}">${escapeHtml(meta.origin)}</span><label>Etiquetas de campaña<input name="catalogTags" value="${escapeHtml(visibleCatalogTags(meta.tags).join(", "))}" placeholder="oficial, reglas, fuego"></label></div>
      <div class="gm-form-grid"><label>Nombre<input name="name" required value="${escapeHtml(spell?.name ?? "")}"></label><label>Nivel<select name="level">${Array.from({ length: 10 }, (_, level) => `<option value="${level}" ${spell?.level === level ? "selected" : ""}>${level === 0 ? "Truco" : `Nivel ${level}`}</option>`).join("")}</select></label><label>Escuela<select name="school">${selectOptions(SPELL_SCHOOLS, spell?.school ?? "", "Sin escuela")}</select></label><label>Tiempo<input name="castingTime" value="${escapeHtml(spell?.castingTime ?? "1 acción")}"></label><label>Alcance<input name="range" value="${escapeHtml(spell?.range ?? "")}"></label><label>Duración<input name="duration" value="${escapeHtml(spell?.duration ?? "")}"></label>${renderCheckboxGroup("Componentes", "components", SPELL_COMPONENTS, components)}${renderCheckboxGroup("Clases", "classes", SPELL_CLASSES, classes)}<label>Daño<input name="damageExpression" value="${escapeHtml(spell?.damageExpression ?? "")}" placeholder="2d6"></label><label>Daño al escalar<input name="upcastDamageExpression" value="${escapeHtml(spell?.upcastDamageExpression ?? "")}" placeholder="1d6"></label><label>Tipo de daño<select name="damageType">${selectOptions(DAMAGE_TYPES, spell?.damageType ?? "", "Sin daño")}</select></label><label>Resolución<select name="attackType"><option value="none">Ninguna</option><option value="attack" ${spell?.attackType === "attack" ? "selected" : ""}>Ataque</option><option value="save" ${spell?.attackType === "save" ? "selected" : ""}>Salvación</option></select></label><label>Salvación<select name="saveAbility">${selectOptions(SPELL_SAVE_ABILITIES, spell?.saveAbility ?? "", "No aplica")}</select></label><label>Edición<select name="year">${selectOptions(["2014", "2024"], spell?.year ?? "2014")}</select></label></div>
      <div class="gm-check-row"><label><input name="ritual" type="checkbox" ${spell?.ritual ? "checked" : ""}> Ritual</label><label><input name="concentration" type="checkbox" ${spell?.concentration ? "checked" : ""}> Concentración</label><label><input name="addAbilityModifier" type="checkbox" ${spell?.addAbilityModifier ? "checked" : ""}> Sumar característica al daño</label></div>
      <label>Material<input name="material" value="${escapeHtml(spell?.material ?? "")}"></label><label>Descripción<textarea name="description">${escapeHtml(spell?.description ?? "")}</textarea></label><label>A niveles superiores<textarea name="higherLevels">${escapeHtml(spell?.higherLevels ?? "")}</textarea></label><button type="submit">Guardar conjuro</button>
    </form>`;
  }

  private renderEquipmentForm(item: EquipmentCatalogDraft | null): string {
    const kind = item?.weapon ? "weapon" : item?.armor ? "armor" : "gear";
    const bonusText = item?.bonuses.map((bonus) => `${bonus.category} | ${bonus.key} | ${bonus.value} | ${bonus.advantage ? "ventaja" : ""} | ${bonus.disadvantage ? "desventaja" : ""}`).join("\n") ?? "";
    const meta = catalogMetadata(item);
    return `<form data-gm-form="equipment" class="gm-editor-form"><input type="hidden" name="previousKey" value="${escapeHtml(item?.name ?? "")}">
      <div class="catalog-editor-meta"><span class="catalog-origin ${escapeHtml(meta.origin)}">${escapeHtml(meta.origin)}</span><label>Etiquetas de campaña<input name="catalogTags" value="${escapeHtml(visibleCatalogTags(meta.tags).join(", "))}" placeholder="oficial, tesoro, mágico"></label></div>
      <div class="gm-form-grid"><label>Nombre<input name="name" required value="${escapeHtml(item?.name ?? "")}"></label><label>Tipo<select name="itemKind">${[["gear","Objeto"],["weapon","Arma"],["armor","Armadura"]].map(([value,label]) => `<option value="${value}" ${kind === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Categoría<select name="category">${selectOptions(EQUIPMENT_CATEGORIES, item?.category ?? "adventuring-gear")}</select></label><label>Rareza<select name="rarity">${selectOptions(EQUIPMENT_RARITIES, item?.rarity ?? "none")}</select></label><label>Peso<input name="weight" type="number" min="0" step="0.01" value="${item?.unitWeight ?? 0}"></label><label>Costo<input name="costQuantity" type="number" min="0" step="0.01" value="${item?.cost.quantity ?? 0}"></label><label>Moneda<select name="costUnit">${selectOptions(["cp","sp","ep","gp","pp"], item?.cost.unit ?? "gp")}</select></label>${renderCheckboxGroup("Propiedades", "properties", EQUIPMENT_PROPERTIES, item?.properties ?? [])}</div>
      <fieldset><legend>Arma</legend><div class="gm-form-grid"><label>Categoría de arma<input name="weaponCategory" value="${escapeHtml(item?.weapon?.category ?? "")}"></label><label>Alcance/tipo<input name="weaponRange" value="${escapeHtml(item?.weapon?.range ?? "")}"></label><label>Alcance normal<input name="normalRange" type="number" min="0" value="${item?.weapon?.normalRange ?? ""}"></label><label>Alcance largo<input name="longRange" type="number" min="0" value="${item?.weapon?.longRange ?? ""}"></label><label>Daño<input name="damageExpression" value="${escapeHtml(item?.weapon?.damageExpression ?? "")}"></label><label>Daño versátil<input name="versatileDamageExpression" value="${escapeHtml(item?.weapon?.versatileDamageExpression ?? "")}"></label><label>Tipo de daño<select name="damageType">${selectOptions(DAMAGE_TYPES, item?.weapon?.damageType ?? "", "Sin daño")}</select></label><label>Bono ataque<input name="attackBonus" type="number" step="1" value="${item?.weapon?.attackBonus ?? 0}"></label><label>Bono daño<input name="damageBonus" type="number" step="1" value="${item?.weapon?.damageBonus ?? 0}"></label></div></fieldset>
      <fieldset><legend>Armadura</legend><div class="gm-form-grid"><label>CA base<input name="armorBase" type="number" step="1" value="${item?.armor?.base ?? 10}"></label><label>Categoría<select name="armorCategory">${selectOptions(["light", "medium", "heavy", "shield"], item?.armor?.armorCategory ?? "", "Sin categoría")}</select></label><label>Máx. DES<input name="maximumDexterityBonus" type="number" min="0" value="${item?.armor?.maximumDexterityBonus ?? ""}"></label></div><div class="gm-check-row"><label><input name="dexterityBonus" type="checkbox" ${item?.armor?.dexterityBonus ? "checked" : ""}> Suma DES</label><label><input name="stealthDisadvantage" type="checkbox" ${item?.armor?.stealthDisadvantage ? "checked" : ""}> Desventaja en sigilo</label></div></fieldset>
      <fieldset><legend>Uso y cargas</legend><div class="gm-check-row"><label><input name="usable" type="checkbox" ${item?.usable ? "checked" : ""}> Usable</label><label><input name="consumable" type="checkbox" ${item?.consumable ? "checked" : ""}> Consumible</label><label><input name="requiresAttunement" type="checkbox" ${item?.requiresAttunement ? "checked" : ""}> Requiere sintonización</label><label><input name="hasCharges" type="checkbox" ${item?.charges ? "checked" : ""}> Usa cargas</label></div><div class="gm-form-grid"><label>Cargas actuales<input name="chargesCurrent" type="number" min="0" value="${item?.charges?.current ?? 0}"></label><label>Cargas máximas<input name="chargesMaximum" type="number" min="0" value="${item?.charges?.maximum ?? 0}"></label><label>Recuperación<select name="chargesReset">${selectOptions(["none", "short-rest", "long-rest", "dawn", "daily", "never"], item?.charges?.reset ?? "none")}</select></label></div></fieldset>
      <label>Bonificadores <small>categoría | clave | valor | ventaja | desventaja</small><textarea name="bonuses">${escapeHtml(bonusText)}</textarea></label><label>Efecto activable<input name="effectDescription" value="${escapeHtml(item?.effect.description ?? "")}"></label><label class="checkbox"><input name="effectActive" type="checkbox" ${item?.effect.active ? "checked" : ""}> Efecto activo por defecto</label>
      <label>Descripción<textarea name="description">${escapeHtml(item?.description ?? "")}</textarea></label><button type="submit">Guardar objeto</button>
    </form>`;
  }

  private renderShopForm(shop: GmShop | null): string {
    const interaction = normalizeMerchantInteraction(shop?.interactions);
    const selectedNpcId = this.shopInventoryNpcId || shop?.npcId || "";
    const npcKey = normalizedSearch(selectedNpcId);
    const npc = this.content.monsters.find((monster) => normalizedSearch(monster.id) === npcKey || normalizedSearch(monster.name) === npcKey) ?? null;
    const statistics = npc ? merchantNpcStatistics(npc) : null;
    const npcOptions = this.content.monsters.map((monster) => `<option value="${escapeHtml(monster.id || monster.name)}" ${selectedNpcId === (monster.id || monster.name) ? "selected" : ""}>${escapeHtml(monster.name)}</option>`).join("");
    const toggle = (name: keyof typeof interaction, label: string): string => `<label><input name="${name}" type="checkbox" ${interaction[name] ? "checked" : ""}> ${label}</label>`;
    const npcStatistics = statistics
      ? `<p class="merchant-derived-stats">Estadísticas del NPC asociado <strong>${escapeHtml(npc!.name)}</strong>: CAR ${statistics.charisma >= 0 ? "+" : ""}${statistics.charisma} · PER ${statistics.perception >= 0 ? "+" : ""}${statistics.perception}</p>`
      : '<p class="merchant-derived-stats">Seleccioná un NPC asociado. CAR y Percepción se obtienen de sus estadísticas.</p>';
    return `<form data-gm-form="shop" class="gm-editor-form">
      <input type="hidden" name="previousKey" value="${escapeHtml(shop?.name ?? "")}">
      <div class="gm-form-grid">
        <label>Nombre del comerciante<input name="name" required value="${escapeHtml(shop?.name ?? "")}"></label>
        <label>NPC asociado<select name="npcId" required><option value="">Seleccionar NPC…</option>${npcOptions}</select></label>
        <label>Estado del NPC<select name="merchantState"><option value="active" ${interaction.state === "active" ? "selected" : ""}>Activo</option><option value="unconscious" ${interaction.state === "unconscious" ? "selected" : ""}>Inconsciente</option><option value="dead" ${interaction.state === "dead" ? "selected" : ""}>Muerto</option></select></label>
        <label>Reputación del grupo<input name="reputation" type="number" step="1" value="${interaction.reputation}"></label>
        <label>Comisión (%)<input name="commissionPercent" type="number" min="0" max="100" step="0.1" value="${interaction.commissionPercent}"></label>
        <label>Fondos disponibles (PC)<input name="fundsCopper" type="number" min="0" step="1" value="${interaction.fundsCopper}"></label>
        <label>Reducción por persuasión (%)<input name="negotiationStep" type="number" min="0" max="100" step="0.1" value="${interaction.negotiationStep}"></label>
        <label>Pérdida de reputación al intimidar<input name="intimidationReputationLoss" type="number" min="0" step="1" value="${interaction.intimidationReputationLoss}"></label>
        <label>Modificador de dificultad<input name="merchantDifficulty" type="number" step="1" value="${interaction.difficulty}"></label>
        <label>Límite de objetos al asaltar<input name="assaultMaxItems" type="number" min="1" step="1" value="${interaction.assaultMaxItems}"></label>
        <label>Límite de peso al asaltar (lb)<input name="assaultMaxWeight" type="number" min="0.1" step="0.1" value="${interaction.assaultMaxWeight}"></label>
      </div>
      ${npcStatistics}
      <fieldset><legend>Acciones habilitadas</legend><div class="gm-check-row">${toggle("interaction", "Abrir comerciante")}${toggle("negotiation", "Persuadir")}${toggle("intimidation", "Intimidar")}${toggle("barter", "Comprar y vender")}${toggle("loot", "Saquear")}${toggle("steal", "Hurtar")}${toggle("assault", "Asaltar")}${toggle("plantEvidence", "Implantar pruebas")}</div></fieldset>
      <p class="merchant-rule-note">Con éxito, Persuadir reduce la comisión ${interaction.negotiationStep} puntos e Intimidar la reduce ${interaction.negotiationStep * 2}. Intimidar resta ${interaction.intimidationReputationLoss} de reputación si tiene éxito y el doble si falla. Hurtar e Implantar suman +2 a la CD por sospecha en cada intento. Asaltar usa Intimidación con Fuerza, transfiere objetos sin dinero y reduce 5 puntos de reputación.</p>
      <label>Etiquetas<input name="catalogTags" value="${escapeHtml(this.shopVisibleTags(shop ?? { name: "", categories: {} }).join(", "))}" placeholder="mercado, ciudad, pociones"></label>
      ${this.renderShopInventory(shop)}
      <button type="submit">Guardar comerciante</button>
    </form>`;
  }

  private rerenderPreservingShopForm(focusSelector?: string): void {
    const form = this.root.querySelector<HTMLFormElement>('[data-gm-form="shop"]');
    const controls = form ? [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]")].map((control) => ({
      name: control.name, value: control.value, checked: control instanceof HTMLInputElement && control.type === "checkbox" ? control.checked : null,
    })) : [];
    this.rerender();
    const replacement = this.root.querySelector<HTMLFormElement>('[data-gm-form="shop"]');
    for (const saved of controls) {
      const control = replacement?.elements.namedItem(saved.name);
      const entries = control instanceof RadioNodeList ? [...control] : control ? [control] : [];
      for (const entry of entries) if (entry instanceof HTMLInputElement || entry instanceof HTMLSelectElement || entry instanceof HTMLTextAreaElement) {
        entry.value = saved.value;
        if (saved.checked !== null && entry instanceof HTMLInputElement) entry.checked = saved.checked;
      }
    }
    const focused = focusSelector ? this.root.querySelector<HTMLInputElement>(focusSelector) : null;
    focused?.focus();
    if (focused) focused.setSelectionRange(focused.value.length, focused.value.length);
  }

  private renderNotes(workspace: GmWorkspace): string {
    return `<section class="gm-notes"><form data-gm-add="note-group" class="gm-inline-form"><input name="title" required placeholder="Nuevo grupo de notas"><button>Agregar grupo</button></form>${workspace.noteGroups.length ? workspace.noteGroups.map((group) => `<details class="gm-tool-card" open data-note-group="${group.id}"><summary>${escapeHtml(group.title)} <small>${group.notes.length}</small></summary><form data-gm-group="${group.id}" class="gm-group-actions"><input name="title" required value="${escapeHtml(group.title)}"><button>Renombrar</button><button type="button" data-gm-delete-group="${group.id}">Eliminar grupo</button></form><div class="gm-note-grid">${group.notes.map((note) => `<form data-gm-note="${note.id}" class="gm-note-card"><input name="title" required value="${escapeHtml(note.title)}"><textarea name="content">${escapeHtml(note.content)}</textarea><div><button>Guardar</button><button type="button" data-gm-delete-note="${note.id}">Eliminar</button></div></form>`).join("")}<form data-gm-add-note="${group.id}" class="gm-note-card new"><input name="title" required placeholder="Título"><textarea name="content" placeholder="Contenido"></textarea><button>Agregar nota</button></form></div></details>`).join("") : '<div class="sheet-empty"><strong>No hay notas de GM</strong><p>Creá un grupo para organizar la campaña.</p></div>'}</section>`;
  }

  private renderTools(workspace: GmWorkspace): string {
    const docUrl = this.validGoogleDocsUrl(workspace.googleDocsUrl) ? workspace.googleDocsUrl : "";
    const tabs: [GmToolSection, string, string][] = [
      ["checklist", "Checklist", `${this.content.checklist.filter((item) => item.checked).length}/${this.content.checklist.length}`],
      ["tables", "Tablas", String(workspace.randomTables.length)], ["travel", "Viaje y salto", ""],
      ["npc", "PNJ", ""], ["reference", "Referencia", ""], ["docs", "Google Docs", ""],
    ];
    const content = this.activeTool === "checklist"
      ? `<section class="gm-tool-surface"><form data-gm-add="checklist" class="gm-inline-form"><input name="text" required placeholder="Nueva tarea"><button>Agregar</button></form><div class="gm-checklist">${this.content.checklist.map((item) => `<label class="${item.checked ? "done" : ""}"><input type="checkbox" data-gm-check="${escapeHtml(item.id)}" ${item.checked ? "checked" : ""}><span>${escapeHtml(item.text)}</span><button type="button" data-gm-delete-check="${escapeHtml(item.id)}">×</button></label>`).join("")}</div></section>`
      : this.activeTool === "tables"
        ? `<section class="gm-tool-surface"><form data-gm-add="table" class="gm-editor-form gm-create-table"><input name="name" required placeholder="Nombre de la tabla"><textarea name="entries" required placeholder="Una opción por línea"></textarea><button>Crear tabla</button></form><div class="gm-random-tables">${workspace.randomTables.map((table) => `<form data-gm-table="${table.id}" class="gm-table-editor"><input name="name" required value="${escapeHtml(table.name)}"><textarea name="entries">${escapeHtml(table.entries.join("\n"))}</textarea><small>${table.entries.length} resultados</small><button>Guardar</button><button type="button" data-gm-roll-table="${table.id}">Tirar</button><button type="button" data-gm-delete-table="${table.id}">Eliminar</button></form>`).join("")}</div></section>`
        : this.activeTool === "travel"
          ? `<section class="gm-tool-surface"><div class="gm-calculators"><form data-gm-calc="travel"><label>Distancia (km)<input name="distance" type="number" min="0" step="0.1" value="40"></label><label>Velocidad (km/h)<input name="speed" type="number" min="0.1" step="0.1" value="4"></label><label>Horas por día<input name="hours" type="number" min="0.1" step="0.1" value="8"></label><button>Calcular</button><output data-gm-output="travel"></output></form><form data-gm-calc="jump"><label>FUE<input name="strength" type="number" min="1" step="1" value="10"></label><label>Altura (cm)<input name="height" type="number" min="1" step="1" value="175"></label><button>Calcular</button><output data-gm-output="jump"></output></form></div></section>`
          : this.activeTool === "npc"
            ? `<section class="gm-tool-surface"><form data-gm-calc="npc" class="gm-npc-generator"><label>Nombre opcional<input name="name" placeholder="Aleatorio"></label><label>Rol<select name="role"><option value="random">Aleatorio</option><option>Aliado</option><option>Neutral</option><option>Rival</option><option>Villano</option></select></label><button>Generar</button><output data-gm-output="npc"></output></form></section>`
            : this.activeTool === "reference"
              ? `<section class="gm-tool-surface gm-reference"><p><b>Condiciones:</b> Cegado, hechizado, ensordecido, asustado, agarrado, incapacitado, invisible, paralizado, petrificado, envenenado, derribado, apresado, aturdido e inconsciente.</p><p><b>Escuelas:</b> Abjuración, adivinación, conjuración, encantamiento, evocación, ilusión, nigromancia y transmutación.</p><p><b>Concentración:</b> termina al quedar incapacitado, morir o fallar la salvación de CON tras recibir daño.</p></section>`
              : `<section class="gm-tool-surface"><form data-gm-form="google-doc" class="gm-inline-form"><input name="url" type="url" placeholder="https://docs.google.com/document/..." value="${escapeHtml(workspace.googleDocsUrl)}"><button>Guardar</button></form>${docUrl ? `<p class="gm-doc-link"><a href="${escapeHtml(docUrl)}" target="_blank" rel="noreferrer">Abrir documento</a></p><iframe class="gm-doc-frame" src="${escapeHtml(docUrl)}" title="Documento de campaña"></iframe>` : ""}</section>`;
    return `<section class="gm-tools-grid"><nav class="filter-bar gm-subsection-nav" aria-label="Tipo de herramienta">${tabs.map(([key, label, count]) => `<button type="button" data-gm-tool="${key}" class="${this.activeTool === key ? "active" : ""}"><span>${label}</span>${count ? `<strong>${count}</strong>` : ""}</button>`).join("")}</nav>${content}</section>`;
  }

  private bindContent(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-new]").forEach((button) => button.addEventListener("click", () => {
      const section = button.dataset.gmNew as GmContentSection;
      this.contentTemplate = null;
      if (section === "spell") this.selectedSpell = "";
      if (section === "equipment") this.selectedEquipment = "";
      if (section === "shop") { this.selectedShop = ""; this.shopInventoryNpcId = ""; this.shopInventoryDraft = []; }
      this.editingContent = section;
      this.rerender();
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-edit]").forEach((button) => button.addEventListener("click", () => {
      const section = button.dataset.gmEdit as GmContentSection;
      this.contentTemplate = null;
      const key = button.dataset.gmContentKey ?? "";
      if (section === "spell") this.selectedSpell = key;
      if (section === "equipment") this.selectedEquipment = key;
      if (section === "shop") { this.selectedShop = key; const shop = this.content.shops.find((entry) => entry.name === key); this.shopInventoryNpcId = shop?.npcId ?? ""; this.shopInventoryDraft = this.linkedMerchantNpc(shop ?? { name: "", categories: {} })?.inventory.map((item) => structuredClone(item)) ?? []; }
      this.editingContent = section;
      this.rerender();
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-template]").forEach((button) => button.addEventListener("click", () => {
      const section = button.dataset.gmTemplate as GmContentSection;
      const key = button.dataset.gmContentKey ?? "";
      const source = section === "spell" ? this.content.spells.find((entry) => entry.name === key)
        : section === "equipment" ? this.content.equipment.find((entry) => entry.name === key)
          : this.content.shops.find((entry) => entry.name === key);
      if (!source) return;
      const value = { ...structuredClone(source), name: `COPIA DE ${source.name}` } as SpellDefinition | EquipmentCatalogDraft | GmShop;
      if ("catalog" in value) value.catalog = null;
      else value.tags = visibleCatalogTags(value.tags ?? []);
      this.contentTemplate = { section, value };
      if (section === "shop") { const shop = source as GmShop; this.shopInventoryNpcId = shop.npcId ?? ""; this.shopInventoryDraft = this.linkedMerchantNpc(shop)?.inventory.map((item) => structuredClone(item)) ?? []; }
      this.editingContent = section;
      this.rerender();
    }));
    this.root.querySelector("[data-gm-cancel-edit]")?.addEventListener("click", () => { this.contentTemplate = null; this.editingContent = null; this.shopInventoryDraft = null; this.shopInventoryNpcId = ""; this.rerender(); });
    this.root.querySelector<HTMLInputElement>("[data-gm-content-search]")?.addEventListener("input", (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const section = input.dataset.gmContentSearch as GmContentSection;
      this.contentSearch[section] = input.value;
      this.contentShowAll[section] = false;
      this.rerender();
      const replacement = this.root.querySelector<HTMLInputElement>(`[data-gm-content-search="${section}"]`);
      replacement?.focus();
      replacement?.setSelectionRange(replacement.value.length, replacement.value.length);
    });
    this.root.querySelector("[data-gm-toggle-descriptions]")?.addEventListener("click", () => { this.showContentDescriptions = !this.showContentDescriptions; this.rerender(); });
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-content-filter-value]").forEach((button) => button.addEventListener("click", () => {
      const section = button.dataset.gmFilterSection as GmContentSection;
      const group = button.dataset.gmFilterGroup ?? "";
      const filter = filterToken(group, button.dataset.gmContentFilterValue ?? "");
      this.openContentFilterGroup[section] = group;
      this.contentShowAll[section] = false;
      if (this.contentFilters[section].has(filter)) this.contentFilters[section].delete(filter); else this.contentFilters[section].add(filter);
      this.rerender();
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-favorites-only]").forEach((button) => button.addEventListener("click", () => {
      const section = button.dataset.gmFavoritesOnly as GmContentSection;
      this.contentFavoritesOnly[section] = !this.contentFavoritesOnly[section];
      this.contentShowAll[section] = false;
      this.rerender();
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-show-all-content]").forEach((button) => button.addEventListener("click", () => {
      const section = button.dataset.gmShowAllContent as GmContentSection;
      this.contentShowAll[section] = true;
      this.contentFavoritesOnly[section] = false;
      this.contentFilters[section].clear();
      this.contentSearch[section] = "";
      this.openContentFilterGroup[section] = null;
      this.rerender();
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-toggle-favorite]").forEach((button) => button.addEventListener("click", () => {
      void this.toggleFavorite(button.dataset.gmToggleFavorite as GmContentSection, button.dataset.gmContentKey ?? "");
    }));
    this.root.querySelector<HTMLFormElement>('[data-gm-form="spell"]')?.addEventListener("submit", (event) => { event.preventDefault(); void this.saveSpell(new FormData(event.currentTarget as HTMLFormElement)); });
    this.root.querySelector<HTMLFormElement>('[data-gm-form="equipment"]')?.addEventListener("submit", (event) => { event.preventDefault(); void this.saveEquipment(new FormData(event.currentTarget as HTMLFormElement)); });
    this.root.querySelector<HTMLFormElement>('[data-gm-form="shop"]')?.addEventListener("submit", (event) => { event.preventDefault(); void this.saveShop(new FormData(event.currentTarget as HTMLFormElement)); });
    this.root.querySelector<HTMLSelectElement>('[data-gm-form="shop"] select[name="npcId"]')?.addEventListener("change", (event) => {
      this.shopInventoryNpcId = (event.currentTarget as HTMLSelectElement).value;
      const key = normalizedSearch(this.shopInventoryNpcId);
      const npc = this.content.monsters.find((monster) => normalizedSearch(monster.id) === key || normalizedSearch(monster.name) === key);
      this.shopInventoryDraft = npc?.inventory.map((item) => structuredClone(item)) ?? [];
      this.rerenderPreservingShopForm();
    });
    this.root.querySelector<HTMLInputElement>("[data-gm-shop-inventory-search]")?.addEventListener("input", (event) => {
      this.shopInventorySearch = (event.currentTarget as HTMLInputElement).value;
      this.rerenderPreservingShopForm("[data-gm-shop-inventory-search]");
    });
    this.root.querySelector("[data-gm-shop-inventory-descriptions]")?.addEventListener("click", () => { this.showContentDescriptions = !this.showContentDescriptions; this.rerenderPreservingShopForm(); });
    this.root.querySelector("[data-gm-shop-inventory-clear]")?.addEventListener("click", () => { this.shopInventoryFilters.clear(); this.shopInventoryTagFilters.clear(); this.shopInventoryRarityFilters.clear(); this.shopInventorySearch = ""; this.shopInventoryIncludeCatalog = false; this.rerenderPreservingShopForm(); });
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-shop-inventory-filter]").forEach((button) => button.addEventListener("click", () => { const value = button.dataset.gmShopInventoryFilter ?? ""; if (this.shopInventoryFilters.has(value)) this.shopInventoryFilters.delete(value); else this.shopInventoryFilters.add(value); this.rerenderPreservingShopForm(); }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-shop-inventory-tag]").forEach((button) => button.addEventListener("click", () => { const value = button.dataset.gmShopInventoryTag ?? ""; if (this.shopInventoryTagFilters.has(value)) this.shopInventoryTagFilters.delete(value); else this.shopInventoryTagFilters.add(value); this.rerenderPreservingShopForm(); }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-shop-inventory-rarity]").forEach((button) => button.addEventListener("click", () => { const value = button.dataset.gmShopInventoryRarity ?? ""; if (this.shopInventoryRarityFilters.has(value)) this.shopInventoryRarityFilters.delete(value); else this.shopInventoryRarityFilters.add(value); this.rerenderPreservingShopForm(); }));
    this.root.querySelector("[data-gm-shop-inventory-catalog]")?.addEventListener("click", () => { this.shopInventoryIncludeCatalog = !this.shopInventoryIncludeCatalog; this.rerenderPreservingShopForm(); });
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-shop-add-catalog]").forEach((button) => button.addEventListener("click", () => { void (async () => {
      const definition = this.content.equipment.find((item) => item.name === button.dataset.gmShopAddCatalog); if (!definition) return;
      const { rarity: _rarity, ...draft } = definition;
      const inventory = this.shopInventoryDraft ?? [];
      const stack = inventory.find((item) => inventoryItemsCanStack({ ...draft, id: item.id, order: item.order, group: item.group }, item));
      this.shopInventoryDraft = stack
        ? inventory.map((item) => item.id === stack.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...inventory, { ...draft, id: await createRandomId("inv"), order: inventory.length, group: "backpack", quantity: 1 }];
      this.rerenderPreservingShopForm();
    })(); }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-shop-inventory-quantity], [data-gm-shop-inventory-action]").forEach((button) => button.addEventListener("click", () => {
      const id = button.closest<HTMLElement>("[data-gm-shop-inventory-item]")?.dataset.gmShopInventoryItem;
      const inventory = this.shopInventoryDraft ?? [];
      const item = inventory.find((entry) => entry.id === id); if (!item) return;
      if (button.dataset.gmShopInventoryQuantity) {
        const quantity = item.quantity + Number(button.dataset.gmShopInventoryQuantity);
        this.shopInventoryDraft = quantity > 0 ? inventory.map((entry) => entry.id === item.id ? { ...entry, quantity } : entry) : inventory.filter((entry) => entry.id !== item.id);
      } else if (button.dataset.gmShopInventoryAction === "remove") this.shopInventoryDraft = inventory.filter((entry) => entry.id !== item.id);
      else if (button.dataset.gmShopInventoryAction === "equip") this.shopInventoryDraft = inventory.map((entry) => entry.id === item.id ? { ...entry, equipped: !entry.equipped, attuned: entry.equipped ? false : entry.attuned } : entry);
      else if (button.dataset.gmShopInventoryAction === "attune") this.shopInventoryDraft = inventory.map((entry) => entry.id === item.id ? { ...entry, attuned: !entry.attuned } : entry);
      else if (button.dataset.gmShopInventoryAction === "use") this.shopInventoryDraft = inventory.flatMap((entry) => entry.id !== item.id ? [entry] : entry.charges && entry.charges.current > 0 ? [{ ...entry, charges: { ...entry.charges, current: entry.charges.current - 1 } }] : entry.consumable && entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : entry.consumable ? [] : [{ ...entry, effect: { ...entry.effect, active: true } }]);
      this.rerenderPreservingShopForm();
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-delete]").forEach((button) => button.addEventListener("click", () => {
      const section = button.dataset.gmDelete as GmContentSection;
      const key = button.dataset.gmContentKey ?? "";
      if (this.pendingDeleteContent?.section !== section || this.pendingDeleteContent.key !== key) {
        this.pendingDeleteContent = { section, key };
        this.setMessage({ kind: "success", text: `Volvé a presionar para eliminar “${key}”.` });
        this.rerender();
        return;
      }
      this.pendingDeleteContent = null;
      if (section === "spell") this.selectedSpell = key;
      if (section === "equipment") this.selectedEquipment = key;
      if (section === "shop") this.selectedShop = key;
      void this.deleteContent(section);
    }));
  }

  private async toggleFavorite(section: GmContentSection, key: string): Promise<void> {
    try {
      if (section === "spell" && this.runtime.saveCustomSpell) {
        const current = this.content.spells.find((entry) => entry.name === key); if (!current) return;
        const updated = withFavoriteTag(current, !isCatalogFavorite(current));
        await this.runtime.saveCustomSpell(updated, key);
        this.content.spells = this.content.spells.map((entry) => entry.name === key ? updated : entry);
      } else if (section === "equipment" && this.runtime.saveCustomEquipment) {
        const current = this.content.equipment.find((entry) => entry.name === key); if (!current) return;
        const updated = withFavoriteTag(current, !isCatalogFavorite(current));
        await this.runtime.saveCustomEquipment(updated, key);
        this.content.equipment = this.content.equipment.map((entry) => entry.name === key ? updated : entry);
      } else if (section === "shop" && this.runtime.saveShop) {
        const current = this.content.shops.find((entry) => entry.name === key); if (!current) return;
        const visible = this.shopVisibleTags(current);
        const updated = { ...current, tags: this.isShopFavorite(current) ? visible : [...visible, FAVORITE_TAG] };
        await this.runtime.saveShop(updated, key);
        this.content.shops = this.content.shops.map((entry) => entry.name === key ? updated : entry);
      } else return;
      this.recordAction(`Favorito: ${key}`);
      this.success("Favoritos actualizados.");
    } catch (error) { this.failure(error); }
  }

  private bindNotes(workspace: GmWorkspace, checksum: string): void {
    this.root.querySelector<HTMLFormElement>('[data-gm-add="note-group"]')?.addEventListener("submit", (event) => { event.preventDefault(); void (async () => { const title = String(new FormData(event.currentTarget as HTMLFormElement).get("title") ?? "").trim(); if (title) await this.saveWorkspace({ ...workspace, noteGroups: [...workspace.noteGroups, { id: await createRandomId("gmg"), title, notes: [] }] }, checksum, "Grupo agregado."); })(); });
    this.root.querySelectorAll<HTMLFormElement>("[data-gm-add-note]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); void (async () => { const data = new FormData(form); const title = String(data.get("title") ?? "").trim(); const groupId = form.dataset.gmAddNote!; if (!title) return; const note = { id: await createRandomId("gmn"), title, content: String(data.get("content") ?? "") }; await this.saveWorkspace({ ...workspace, noteGroups: workspace.noteGroups.map((group) => group.id === groupId ? { ...group, notes: [...group.notes, note] } : group) }, checksum, "Nota agregada."); })(); }));
    this.root.querySelectorAll<HTMLFormElement>("[data-gm-note]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(form); const noteId = form.dataset.gmNote!; const updated = { ...workspace, noteGroups: workspace.noteGroups.map((group) => ({ ...group, notes: group.notes.map((note) => note.id === noteId ? { ...note, title: String(data.get("title") ?? "").trim(), content: String(data.get("content") ?? "") } : note) })) }; void this.saveWorkspace(updated, checksum, "Nota guardada."); }));
    this.root.querySelectorAll<HTMLFormElement>("[data-gm-group]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); const title = String(new FormData(form).get("title") ?? "").trim(); if (title) void this.saveWorkspace({ ...workspace, noteGroups: workspace.noteGroups.map((group) => group.id === form.dataset.gmGroup ? { ...group, title } : group) }, checksum, "Grupo renombrado."); }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-delete-note]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.gmDeleteNote!; void this.saveWorkspace({ ...workspace, noteGroups: workspace.noteGroups.map((group) => ({ ...group, notes: group.notes.filter((note) => note.id !== id) })) }, checksum, "Nota eliminada."); }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-delete-group]").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      const id = button.dataset.gmDeleteGroup!;
      if (globalThis.confirm && !globalThis.confirm("¿Eliminar el grupo y todas sus notas?")) return;
      button.disabled = true;
      void this.saveWorkspace(removeGmNoteGroup(workspace, id), checksum, "Grupo eliminado.");
    }));
  }

  private bindTools(workspace: GmWorkspace, checksum: string): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-tool]").forEach((button) => button.addEventListener("click", () => { this.activeTool = button.dataset.gmTool as GmToolSection; this.rerender(); }));
    this.root.querySelector<HTMLFormElement>('[data-gm-add="checklist"]')?.addEventListener("submit", (event) => { event.preventDefault(); void (async () => { const text = String(new FormData(event.currentTarget as HTMLFormElement).get("text") ?? "").trim(); if (!text || !this.runtime.saveChecklistItem) return; const item = { id: await createRandomId("chk"), text, checked: false }; await this.runtime.saveChecklistItem(item); this.content.checklist.push(item); this.recordAction(`Agregar tarea: ${text}`); this.success("Tarea agregada."); })(); });
    this.root.querySelectorAll<HTMLInputElement>("[data-gm-check]").forEach((input) => input.addEventListener("change", () => { const item = this.content.checklist.find((entry) => entry.id === input.dataset.gmCheck); if (item && this.runtime.saveChecklistItem) void this.runtime.saveChecklistItem({ ...item, checked: input.checked }).then(() => { item.checked = input.checked; this.recordAction(`${input.checked ? "Completar" : "Reabrir"} tarea: ${item.text}`); this.rerender(); }).catch((error) => this.failure(error)); }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-delete-check]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.gmDeleteCheck!; const item = this.content.checklist.find((entry) => entry.id === id); if (this.runtime.deleteChecklistItem) void this.runtime.deleteChecklistItem(id).then(() => { this.content.checklist = this.content.checklist.filter((entry) => entry.id !== id); this.recordAction(`Eliminar tarea: ${item?.text ?? id}`); this.success("Tarea eliminada."); }).catch((error) => this.failure(error)); }));
    this.root.querySelector<HTMLFormElement>('[data-gm-add="table"]')?.addEventListener("submit", (event) => { event.preventDefault(); void (async () => { const data = new FormData(event.currentTarget as HTMLFormElement); const name = String(data.get("name") ?? "").trim(); const entries = String(data.get("entries") ?? "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean); if (!name || !entries.length) return; await this.saveWorkspace({ ...workspace, randomTables: [...workspace.randomTables, { id: await createRandomId("gmt"), name, entries }] }, checksum, "Tabla creada."); })(); });
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-roll-table]").forEach((button) => button.addEventListener("click", () => { const table = workspace.randomTables.find((entry) => entry.id === button.dataset.gmRollTable); if (table?.entries.length) { const result = `${table.name}: ${table.entries[Math.floor(Math.random() * table.entries.length)]}`; this.recordAction(result, "roll"); this.success(result); } }));
    this.root.querySelectorAll<HTMLFormElement>("[data-gm-table]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(form); const name = String(data.get("name") ?? "").trim(); const entries = String(data.get("entries") ?? "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean); if (name && entries.length) void this.saveWorkspace({ ...workspace, randomTables: workspace.randomTables.map((table) => table.id === form.dataset.gmTable ? { ...table, name, entries } : table) }, checksum, "Tabla guardada."); }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-delete-table]").forEach((button) => button.addEventListener("click", () => void this.saveWorkspace({ ...workspace, randomTables: workspace.randomTables.filter((entry) => entry.id !== button.dataset.gmDeleteTable) }, checksum, "Tabla eliminada.")));
    this.root.querySelector<HTMLFormElement>('[data-gm-form="google-doc"]')?.addEventListener("submit", (event) => { event.preventDefault(); const url = String(new FormData(event.currentTarget as HTMLFormElement).get("url") ?? "").trim(); if (url && !this.validGoogleDocsUrl(url)) { this.failure(new Error("La URL debe pertenecer a docs.google.com.")); return; } void this.saveWorkspace({ ...workspace, googleDocsUrl: url }, checksum, "Documento guardado."); });
    this.root.querySelectorAll<HTMLFormElement>("[data-gm-calc]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(form); const output = form.querySelector<HTMLOutputElement>("output")!; if (form.dataset.gmCalc === "travel") { const distance = number(data.get("distance")); const speed = number(data.get("speed")); const hours = number(data.get("hours")); output.value = speed > 0 && hours > 0 ? `${(distance / speed).toFixed(1)} h · ${(distance / speed / hours).toFixed(1)} días` : "Valores inválidos"; } else if (form.dataset.gmCalc === "jump") { const strength = number(data.get("strength")); const heightCm = number(data.get("height")); const modifier = Math.floor((strength - 10) / 2); const high = Math.max(0, 3 + modifier); output.value = `Con carrera: largo ${strength} pies · alto ${high} pies · alcance ${Math.floor(high + heightCm / 30.48 * 1.5)} pies. Sin carrera: la mitad.`; } else { const pick = (values: string[]) => values[Math.floor(Math.random() * values.length)]!; const givenName = String(data.get("name") ?? "").trim(); const role = String(data.get("role")) === "random" ? pick(["Aliado", "Neutral", "Rival", "Villano"]) : String(data.get("role")); output.value = `${givenName || pick(["Aldren", "Brina", "Corvin", "Dalia", "Edrik", "Fara"])} · ${role} · ${pick(["mercader", "soldado", "erudito", "artesano", "noble", "viajero"])} · ${pick(["amable pero reservado", "directo y desconfiado", "curioso y parlanchín", "sereno y calculador"])} · busca ${pick(["seguridad", "riqueza", "respuestas", "venganza", "reconocimiento"])}.`; } }));
  }

  private async saveSpell(data: FormData): Promise<void> {
    if (!this.runtime.saveCustomSpell) return;
    const previous = String(data.get("previousKey") ?? "") || null;
    const existing = previous ? this.content.spells.find((entry) => entry.name === previous) ?? null : null;
    const definition: SpellDefinition = { name: String(data.get("name") ?? "").trim(), level: Math.max(0, Math.min(9, Math.trunc(number(data.get("level"))))), description: String(data.get("description") ?? ""), higherLevels: String(data.get("higherLevels") ?? ""), range: String(data.get("range") ?? ""), components: data.getAll("components").map(String).join(", "), material: String(data.get("material") ?? ""), ritual: data.get("ritual") === "on", duration: String(data.get("duration") ?? ""), concentration: data.get("concentration") === "on", castingTime: String(data.get("castingTime") ?? ""), school: String(data.get("school") ?? ""), classes: data.getAll("classes").map(String).join(", "), attackType: String(data.get("attackType")) as SpellDefinition["attackType"], saveAbility: String(data.get("saveAbility") ?? ""), damageExpression: String(data.get("damageExpression") ?? ""), upcastDamageExpression: String(data.get("upcastDamageExpression") ?? ""), addAbilityModifier: data.get("addAbilityModifier") === "on", damageType: String(data.get("damageType") ?? ""), year: String(data.get("year") ?? "2014"), catalog: catalogFormMetadata(existing, data) };
    try { await this.runtime.saveCustomSpell(definition, previous); this.content.spells = [...this.content.spells.filter((entry) => entry.name !== previous && entry.name !== definition.name), definition].sort((a, b) => a.name.localeCompare(b.name, "es")); this.selectedSpell = definition.name; this.contentSearch.spell = definition.name; this.contentShowAll.spell = false; this.contentTemplate = null; this.editingContent = null; this.recordAction(`Guardar conjuro: ${definition.name}`); this.success("Conjuro guardado."); } catch (error) { this.failure(error); }
  }

  private async saveEquipment(data: FormData): Promise<void> {
    if (!this.runtime.saveCustomEquipment) return;
    const previous = String(data.get("previousKey") ?? "") || null;
    const existing = previous ? this.content.equipment.find((entry) => entry.name === previous) ?? null : null;
    const base = normalizeEquipmentDefinition({ name: String(data.get("name") ?? "").trim(), rarity: String(data.get("rarity") ?? "none"), weight: number(data.get("weight")), cost: { quantity: number(data.get("costQuantity")), unit: String(data.get("costUnit") ?? "gp") }, equipment_category: { index: String(data.get("category") ?? "adventuring-gear") }, description: String(data.get("description") ?? "") });
    const kind = String(data.get("itemKind") ?? "gear");
    const nullableInteger = (key: string): number | null => String(data.get(key) ?? "").trim() === "" ? null : Math.max(0, Math.trunc(number(data.get(key))));
    const bonuses = String(data.get("bonuses") ?? "").split(/\r?\n/).flatMap((line) => {
      const [category = "", key = "", value = "0", advantage = "", disadvantage = ""] = line.split("|").map((entry) => entry.trim());
      return category && key ? [{ category, key, value: Number(value) || 0, advantage: advantage.toLocaleLowerCase().startsWith("vent"), disadvantage: disadvantage.toLocaleLowerCase().startsWith("desvent") }] : [];
    });
    const maximumCharges = Math.max(0, Math.trunc(number(data.get("chargesMaximum"))));
    const definition: EquipmentCatalogDraft = {
      ...base,
      rarity: String(data.get("rarity") ?? "none"), properties: data.getAll("properties").map(String),
      usable: data.get("usable") === "on", consumable: data.get("consumable") === "on", requiresAttunement: data.get("requiresAttunement") === "on",
      charges: data.get("hasCharges") === "on" ? { current: Math.min(maximumCharges, Math.max(0, Math.trunc(number(data.get("chargesCurrent"))))), maximum: maximumCharges, reset: String(data.get("chargesReset") ?? "none") } : null,
      weapon: kind === "weapon" ? { category: String(data.get("weaponCategory") ?? ""), range: String(data.get("weaponRange") ?? ""), normalRange: nullableInteger("normalRange"), longRange: nullableInteger("longRange"), damageExpression: String(data.get("damageExpression") ?? ""), versatileDamageExpression: String(data.get("versatileDamageExpression") ?? ""), damageType: String(data.get("damageType") ?? ""), attackBonus: Math.trunc(number(data.get("attackBonus"))), damageBonus: Math.trunc(number(data.get("damageBonus"))) } : null,
      armor: kind === "armor" ? { base: Math.trunc(number(data.get("armorBase"), 10)), dexterityBonus: data.get("dexterityBonus") === "on", maximumDexterityBonus: nullableInteger("maximumDexterityBonus"), armorCategory: String(data.get("armorCategory") ?? ""), stealthDisadvantage: data.get("stealthDisadvantage") === "on" } : null,
      bonuses, effect: { description: String(data.get("effectDescription") ?? ""), active: data.get("effectActive") === "on" },
      catalog: catalogFormMetadata(existing, data),
    };
    try { await this.runtime.saveCustomEquipment(definition, previous); this.content.equipment = [...this.content.equipment.filter((entry) => entry.name !== previous && entry.name !== definition.name), definition].sort((a, b) => a.name.localeCompare(b.name, "es")); this.selectedEquipment = definition.name; this.contentSearch.equipment = definition.name; this.contentShowAll.equipment = false; this.contentTemplate = null; this.editingContent = null; this.recordAction(`Guardar objeto: ${definition.name}`); this.success("Objeto guardado."); } catch (error) { this.failure(error); }
  }

  private async saveShop(data: FormData): Promise<void> {
    if (!this.runtime.saveShop) return;
    const previous = String(data.get("previousKey") ?? "") || null;
    const existing = previous ? this.content.shops.find((entry) => entry.name === previous) : undefined;
    const tags = String(data.get("catalogTags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
    if (existing && this.isShopFavorite(existing)) tags.push(FAVORITE_TAG);
    const npcId = String(data.get("npcId") ?? "").trim();
    const npcKey = normalizedSearch(npcId);
    const npc = this.content.monsters.find((monster) => normalizedSearch(monster.id) === npcKey || normalizedSearch(monster.name) === npcKey);
    if (!npc) { this.failure(new Error("Seleccioná un NPC válido para el comerciante.")); return; }
    const inventory = (this.shopInventoryDraft ?? npc.inventory).map((item, order) => ({ ...item, order }));
    const shop: GmShop = {
      name: String(data.get("name") ?? "").trim(),
      npcId,
      categories: {},
      tags,
      interactions: normalizeMerchantInteraction({
        interaction: data.get("interaction") === "on", negotiation: data.get("negotiation") === "on",
        intimidation: data.get("intimidation") === "on",
        barter: data.get("barter") === "on", loot: data.get("loot") === "on", steal: data.get("steal") === "on",
        assault: data.get("assault") === "on", plantEvidence: data.get("plantEvidence") === "on", reputation: Math.trunc(number(data.get("reputation"))),
        difficulty: Math.trunc(number(data.get("merchantDifficulty"))), commissionPercent: number(data.get("commissionPercent"), 20),
        negotiationStep: number(data.get("negotiationStep"), 5),
        intimidationReputationLoss: Math.max(0, Math.trunc(number(data.get("intimidationReputationLoss"), 1))),
        fundsCopper: Math.max(0, Math.trunc(number(data.get("fundsCopper"), 10_000))),
        theftsThisInteraction: existing?.interactions?.theftsThisInteraction ?? 0,
        assaultMaxItems: Math.max(1, Math.trunc(number(data.get("assaultMaxItems"), 3))),
        assaultMaxWeight: Math.max(0.1, number(data.get("assaultMaxWeight"), 20)), state: String(data.get("merchantState") ?? "active"),
      }),
    };
    try {
      if (!this.runtime.saveCustomMonster) throw new Error("El inventario del NPC no admite cambios desde este entorno.");
      const updatedNpc = { ...npc, inventory };
      await this.runtime.saveCustomMonster(updatedNpc, npc.name);
      await this.runtime.saveShop(shop, previous);
      this.content.monsters = this.content.monsters.map((entry) => entry.name === npc.name ? updatedNpc : entry);
      this.content.shops = [...this.content.shops.filter((entry) => entry.name !== previous && entry.name !== shop.name), shop].sort((a, b) => a.name.localeCompare(b.name, "es"));
      this.selectedShop = shop.name; this.contentSearch.shop = shop.name; this.contentShowAll.shop = false; this.contentTemplate = null; this.editingContent = null;
      this.shopInventoryDraft = null; this.shopInventoryNpcId = "";
      this.recordAction(`Guardar comerciante: ${shop.name}`); this.success("Comerciante e inventario guardados.");
    } catch (error) { this.failure(error); }
  }

  private async deleteContent(kind: string): Promise<void> {
    try {
      if (kind === "spell" && this.selectedSpell && this.runtime.deleteCustomSpell) { await this.runtime.deleteCustomSpell(this.selectedSpell); this.content.spells = this.content.spells.filter((entry) => entry.name !== this.selectedSpell); this.selectedSpell = this.content.spells[0]?.name ?? ""; }
      if (kind === "equipment" && this.selectedEquipment && this.runtime.deleteCustomEquipment) { await this.runtime.deleteCustomEquipment(this.selectedEquipment); this.content.equipment = this.content.equipment.filter((entry) => entry.name !== this.selectedEquipment); this.selectedEquipment = this.content.equipment[0]?.name ?? ""; }
      if (kind === "shop" && this.selectedShop && this.runtime.deleteShop) { await this.runtime.deleteShop(this.selectedShop); this.content.shops = this.content.shops.filter((entry) => entry.name !== this.selectedShop); this.selectedShop = this.content.shops[0]?.name ?? ""; }
      this.recordAction(`Eliminar contenido: ${kind}`);
      this.success("Contenido eliminado.");
    } catch (error) { this.failure(error); }
  }

  private async saveWorkspace(workspace: GmWorkspace, checksum: string, message: string): Promise<void> { if (!this.runtime.saveGmWorkspace) return; try { this.updateSnapshot(await this.runtime.saveGmWorkspace(workspace, checksum), message.replace(/\.$/, "")); this.success(message); } catch (error) { this.failure(error); } }
  private validGoogleDocsUrl(value: string): boolean { try { return new URL(value).hostname === "docs.google.com"; } catch { return false; } }
  private success(text: string): void { this.setMessage({ kind: "success", text }); this.rerender(); }
  private failure(error: unknown): void { this.setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) }); this.rerender(); }
}
