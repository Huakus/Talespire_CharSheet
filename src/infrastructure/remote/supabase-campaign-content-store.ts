import type { SpellDefinition } from "../../domain/character/character-spell-model";
import type { CharacterInventoryItemV2 } from "../../domain/character/character-inventory-model";
import { normalizeEquipmentDefinition, type EquipmentCatalogDraft } from "../../domain/equipment/equipment-catalog";
import { normalizeChecklistItem, normalizeShop, type GmChecklistItem, type GmShop } from "../../domain/gm/gm-global-content";
import { normalizeMonsterDefinition, type MonsterDefinition } from "../../domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../domain/spells/spell-catalog";
import type { JsonObject } from "../../shared/json";
import type { CampaignContent } from "../../domain/content/campaign-content";
import type { CampaignContentKind, CampaignContentOrigin, RemoteCampaignContentEntry, SupabaseCampaignDocumentClient } from "./supabase-campaign-document-client";

interface CatalogMetadata { contentKey: string; origin: CampaignContentOrigin; tags: string[]; revision: number }

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadata(value: { legacyData?: JsonObject }): CatalogMetadata | null {
  const source = object(value.legacyData?.__catalog);
  const origin = source.origin;
  return typeof source.contentKey === "string" && (origin === "official" || origin === "gm" || origin === "imported")
    ? { contentKey: source.contentKey, origin, tags: Array.isArray(source.tags) ? source.tags.map(String) : [], revision: Number(source.revision) || 0 }
    : null;
}

function decorate<T extends { legacyData: JsonObject }>(value: T, entry: RemoteCampaignContentEntry): T {
  return { ...value, legacyData: { ...value.legacyData, __catalog: { contentKey: entry.contentKey, origin: entry.origin, tags: entry.tags, revision: entry.revision } } };
}

function normalizedName(value: string): string { return value.trim().toLocaleLowerCase(); }

function stableInventoryId(value: string): string {
  const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (const character of value) {
    const code = character.charCodeAt(0);
    for (let index = 0; index < hashes.length; index += 1) hashes[index] = Math.imul(hashes[index]! ^ (code + index * 31), 0x01000193) >>> 0;
  }
  return `inv_${hashes.map((hash) => hash.toString(16).padStart(8, "0")).join("")}`;
}

function hydrateShopInventory(shop: GmShop, equipment: readonly EquipmentCatalogDraft[], names: readonly string[]): CharacterInventoryItemV2[] {
  if (shop.inventory?.length) return shop.inventory;
  const grouped = new Map<string, { name: string; quantity: number; group: string }>();
  for (const name of names) {
    const key = normalizedName(name);
    const group = Object.entries(shop.categories).find(([, entries]) => entries.some((entry) => normalizedName(entry) === key))?.[0] ?? "Inventario";
    const current = grouped.get(key);
    if (current) current.quantity += 1;
    else grouped.set(key, { name, quantity: 1, group });
  }
  return [...grouped.values()].map((entry, order) => {
    const definition = equipment.find((item) => normalizedName(item.name) === normalizedName(entry.name)) ?? normalizeEquipmentDefinition({ name: entry.name, category: "adventuring-gear" });
    const { rarity: _rarity, ...draft } = definition;
    return { ...draft, id: stableInventoryId(`${shop.name}:${entry.name}:${order}`), order, group: entry.group, quantity: entry.quantity };
  });
}

export class SupabaseCampaignContentStore {
  private entries: RemoteCampaignContentEntry[] | null = null;
  private loadingEntries: Promise<RemoteCampaignContentEntry[]> | null = null;

  constructor(private readonly client: SupabaseCampaignDocumentClient, private readonly campaignId: string) {}

  async load(): Promise<CampaignContent> {
    if (this.entries === null) {
      this.loadingEntries ??= this.client.listCampaignContent(this.campaignId);
      try { this.entries = await this.loadingEntries; }
      finally { this.loadingEntries = null; }
    }
    return this.project(this.entries);
  }

  async seedOfficialContent(): Promise<number> {
    const inserted = await this.client.seedCampaignContent(this.campaignId);
    this.entries = null;
    return inserted;
  }

  saveSpell(value: SpellDefinition, previousKey: string | null = null): Promise<void> { return this.saveDefinition("spell", value, previousKey); }
  saveEquipment(value: EquipmentCatalogDraft, previousKey: string | null = null): Promise<void> { return this.saveDefinition("equipment", value, previousKey); }
  saveMonster(value: MonsterDefinition, previousKey: string | null = null): Promise<void> { return this.saveDefinition("monster", value, previousKey); }
  deleteSpell(key: string): Promise<void> { return this.deleteByName("spell", key); }
  deleteEquipment(key: string): Promise<void> { return this.deleteByName("equipment", key); }
  deleteMonster(key: string): Promise<void> { return this.deleteByName("monster", key); }

  async saveShop(shop: GmShop, previousKey: string | null = null): Promise<void> {
    const { inventory: _legacyInventory, ...profile } = shop;
    await this.savePlain("shop", shop.name, { ...profile, categories: {} } as unknown as Record<string, unknown>, previousKey, undefined, shop.tags);
  }
  deleteShop(key: string): Promise<void> { return this.deleteByName("shop", key); }

  async saveChecklistItem(item: GmChecklistItem): Promise<void> {
    await this.savePlain("checklist", item.text, item as unknown as Record<string, unknown>, item.id, `gm:checklist:${item.id}`);
  }
  deleteChecklistItem(key: string): Promise<void> { return this.deleteByKeyOrName("checklist", `gm:checklist:${key}`, key); }

  private project(entries: RemoteCampaignContentEntry[]): CampaignContent {
    const equipment = entries.filter((entry) => entry.kind === "equipment").flatMap((entry) => { try { return [decorate(normalizeEquipmentDefinition(entry.payload), entry)]; } catch { return []; } });
    const baseShops = entries.filter((entry) => entry.kind === "shop").flatMap((entry) => {
      try {
        const value = object(entry.payload);
        return [{ ...normalizeShop(String(value.name ?? entry.name), value), tags: entry.tags }];
      } catch { return []; }
    });
    const monsters = entries.filter((entry) => entry.kind === "monster").flatMap((entry) => { try {
      const value = decorate(normalizeMonsterDefinition(entry.payload), entry);
      if (!value.name) return [];
      const linkedShop = baseShops.find((shop) => shop.npcId && (normalizedName(shop.npcId) === normalizedName(value.id) || normalizedName(shop.npcId) === normalizedName(value.name)));
      const legacyInventory = linkedShop ? hydrateShopInventory(linkedShop, equipment, Object.values(linkedShop.categories).flat()) : [];
      const source = legacyInventory.length ? legacyInventory : value.inventory;
      const inventory = source.map((item, order) => {
        const definition = equipment.find((entry) => normalizedName(entry.name) === normalizedName(item.name));
        if (!definition || item.cost.quantity > 0 || item.description || item.weapon || item.armor) return { ...item, order };
        const { rarity: _rarity, ...draft } = definition;
        return { ...draft, id: item.id, order, group: item.group, quantity: item.quantity, equipped: item.equipped, attuned: item.attuned };
      });
      return [{ ...value, inventory }];
    } catch { return []; } });
    const shops = baseShops.map((shop) => { const { inventory: _legacyInventory, ...profile } = shop; return { ...profile, categories: {} }; });
    return {
      spells: entries.filter((entry) => entry.kind === "spell").flatMap((entry) => { try { return [decorate(normalizeSpellDefinition(entry.payload), entry)]; } catch { return []; } }),
      equipment,
      monsters,
      shops,
      checklist: entries.filter((entry) => entry.kind === "checklist").flatMap((entry) => { try { const value = object(entry.payload); return [normalizeChecklistItem(String(value.id ?? entry.contentKey.replace(/^.*:/, "")), value)]; } catch { return []; } }),
    };
  }

  private async currentEntries(): Promise<RemoteCampaignContentEntry[]> {
    if (this.entries === null) this.entries = await this.client.listCampaignContent(this.campaignId);
    return this.entries;
  }

  private async saveDefinition(kind: Extract<CampaignContentKind, "spell" | "equipment" | "monster">, value: SpellDefinition | EquipmentCatalogDraft | MonsterDefinition, previousKey: string | null): Promise<void> {
    const entries = await this.currentEntries();
    const embedded = metadata(value);
    const embeddedEntry = embedded ? entries.find((entry) => entry.kind === kind && entry.contentKey === embedded.contentKey) : undefined;
    const existing = embeddedEntry?.name === previousKey ? embeddedEntry : entries.find((entry) => entry.kind === kind && normalizedName(entry.name) === normalizedName(previousKey ?? value.name));
    await this.persist({
      kind,
      name: value.name,
      payload: value as unknown as Record<string, unknown>,
      ...(existing ? { existing } : {}),
      origin: existing?.origin ?? "gm",
      tags: embedded?.tags ?? existing?.tags ?? ["gm"],
    });
  }

  private async savePlain(kind: Extract<CampaignContentKind, "shop" | "checklist">, name: string, payload: Record<string, unknown>, previousKey: string | null, forcedKey?: string, requestedTags?: string[]): Promise<void> {
    const entries = await this.currentEntries();
    const existing = entries.find((entry) => entry.kind === kind && (entry.contentKey === forcedKey || normalizedName(entry.name) === normalizedName(previousKey ?? name)));
    await this.persist({
      kind,
      name,
      payload,
      ...(existing ? { existing } : {}),
      origin: existing?.origin ?? "gm",
      tags: requestedTags ?? existing?.tags ?? ["gm"],
      ...(forcedKey ? { forcedKey } : {}),
    });
  }

  private async persist(input: { kind: CampaignContentKind; name: string; payload: Record<string, unknown>; existing?: RemoteCampaignContentEntry; origin: CampaignContentOrigin; tags: string[]; forcedKey?: string }): Promise<void> {
    const contentKey = input.existing?.contentKey ?? input.forcedKey ?? `gm:${input.kind}:${crypto.randomUUID()}`;
    const saved = await this.client.saveCampaignContentEntry({ campaignId: this.campaignId, kind: input.kind, contentKey, name: input.name, origin: input.origin, tags: [...new Set(input.tags)], payload: input.payload, expectedRevision: input.existing?.revision ?? null });
    const entries = await this.currentEntries();
    this.entries = [...entries.filter((entry) => !(entry.kind === saved.kind && entry.contentKey === saved.contentKey)), saved];
  }

  private async deleteByName(kind: CampaignContentKind, name: string): Promise<void> { return this.deleteByKeyOrName(kind, "", name); }
  private async deleteByKeyOrName(kind: CampaignContentKind, contentKey: string, name: string): Promise<void> {
    const entries = await this.currentEntries();
    const existing = entries.find((entry) => entry.kind === kind && (entry.contentKey === contentKey || normalizedName(entry.name) === normalizedName(name)));
    if (!existing) return;
    await this.client.deleteCampaignContentEntry(this.campaignId, kind, existing.contentKey, existing.revision);
    this.entries = entries.filter((entry) => !(entry.kind === kind && entry.contentKey === existing.contentKey));
  }
}
