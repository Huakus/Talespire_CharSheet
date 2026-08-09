import type { CharacterInventoryItemV2 } from "../domain/character/character-inventory-model";
import type { EquipmentCatalogDraft } from "../domain/equipment/equipment-catalog";

export type InventoryViewItem = CharacterInventoryItemV2 | EquipmentCatalogDraft;

export interface InventoryViewFilterState {
  search: string;
  filters: ReadonlySet<string>;
  tagFilters: ReadonlySet<string>;
  rarityFilters: ReadonlySet<string>;
}

export function inventoryViewNormalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

export function inventoryViewMatchesBasicFilter(item: InventoryViewItem, filter: string): boolean {
  const category = inventoryViewNormalized(item.category);
  if (filter === "equipped") return item.equipped;
  if (filter === "weapon") return item.weapon !== null || category.includes("weapon") || category.includes("arma");
  if (filter === "armor") return item.armor !== null || category.includes("armor") || category.includes("armadura") || category.includes("shield") || category.includes("escudo");
  if (filter === "consumable") return item.consumable;
  if (filter === "usable") return item.usable;
  if (filter === "attunement") return item.requiresAttunement;
  return false;
}

export function inventoryViewIsVisible(
  item: InventoryViewItem,
  state: InventoryViewFilterState,
  rarity: string,
  tags: readonly string[],
): boolean {
  const haystack = inventoryViewNormalized([
    item.name, item.category, rarity, item.description,
    item.weapon?.category ?? "", item.weapon?.damageType ?? "", item.armor?.armorCategory ?? "",
    ...item.properties, ...tags,
  ].join(" "));
  const query = inventoryViewNormalized(state.search);
  return (!query || haystack.includes(query)) &&
    [...state.filters].every((filter) => inventoryViewMatchesBasicFilter(item, filter)) &&
    (state.tagFilters.size === 0 || tags.some((tag) => [...state.tagFilters].some((selected) => inventoryViewNormalized(selected) === inventoryViewNormalized(tag)))) &&
    (state.rarityFilters.size === 0 || state.rarityFilters.has(rarity));
}

export function renderSharedInventoryCard(input: {
  item: InventoryViewItem;
  rarity: string;
  rarityLabel: string;
  categoryTone: string;
  categoryLabel: string;
  quantity: number;
  catalog?: boolean;
  disabled?: boolean;
  commerce?: boolean;
  articleAttributes?: string;
  headerControlHtml: string;
  statsHtml: string;
  descriptionHtml: string;
  tags: readonly string[];
  propertiesHtml?: string;
  actionsHtml: string;
}): string {
  const item = input.item;
  const id = "id" in item ? item.id : "";
  const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  return `<article class="inventory-row ${item.equipped ? "equipped" : ""} ${input.catalog ? "catalog-item inventory-disabled" : ""}${input.commerce ? " merchant-inventory-item" : ""}${input.disabled ? " inventory-disabled" : ""}" ${id ? `data-inventory-id="${escape(id)}"` : ""} ${input.articleAttributes ?? ""}>
    <header class="inventory-row-header"><div class="inventory-row-main"><strong>${escape(item.name)}</strong><span><em class="inventory-category" data-inventory-tone="${escape(input.categoryTone)}">${escape(input.categoryLabel)}</em> · <em class="rarity-badge" data-rarity="${escape(input.rarity)}">${escape(input.rarityLabel)}</em> · ${(item.unitWeight * (input.quantity || 1)).toFixed(1)} lb</span></div>${input.headerControlHtml}</header>
    <div class="inventory-row-stats">${input.statsHtml}</div>
    ${input.descriptionHtml}
    ${input.tags.length ? `<div class="catalog-tags player-catalog-tags">${input.tags.map((tag) => `<span>${escape(tag)}</span>`).join("")}</div>` : ""}
    ${input.propertiesHtml ?? (item.properties.length ? `<div class="tag-list inventory-properties">${item.properties.map((property) => `<span>${escape(property)}</span>`).join("")}</div>` : "")}
    ${input.actionsHtml}
  </article>`;
}
