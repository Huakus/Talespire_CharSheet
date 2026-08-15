import type { SpellDefinition } from "../../domain/character/character-spell-model";
import { normalizeEquipmentDefinition, type EquipmentCatalogDraft } from "../../domain/equipment/equipment-catalog";
import { normalizeChecklistItem, normalizeShop, type GmChecklistItem, type GmShop } from "../../domain/gm/gm-global-content";
import { normalizeMonsterDefinition, type MonsterDefinition } from "../../domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../domain/spells/spell-catalog";
import type { CampaignContent } from "../../domain/content/campaign-content";
import type { CatalogMetadata } from "../../domain/content/catalog-metadata";
import type { CampaignContentKind, CampaignContentOrigin, RemoteCampaignContentEntry, SupabaseCampaignDocumentClient } from "./supabase-campaign-document-client";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadata(value: { catalog?: CatalogMetadata | null }): CatalogMetadata | null {
  return value.catalog ?? null;
}

function decorate<T>(value: T, entry: RemoteCampaignContentEntry): T & { catalog: CatalogMetadata } {
  return { ...value, catalog: { contentKey: entry.contentKey, origin: entry.origin, tags: entry.tags, revision: entry.revision } };
}

function normalizedName(value: string): string { return value.trim().toLocaleLowerCase(); }

export class SupabaseCampaignContentStore {
  private entries: RemoteCampaignContentEntry[] | null = null;
  private loadingEntries: Promise<RemoteCampaignContentEntry[]> | null = null;
  private reloadingContent: Promise<CampaignContent> | null = null;

  constructor(private readonly client: SupabaseCampaignDocumentClient, private readonly campaignId: string) {}

  async load(): Promise<CampaignContent> {
    if (this.entries === null) {
      this.loadingEntries ??= this.client.listCampaignContent(this.campaignId);
      try { this.entries = await this.loadingEntries; }
      finally { this.loadingEntries = null; }
    }
    return this.project(this.entries);
  }

  async reload(): Promise<CampaignContent> {
    if (this.reloadingContent) return this.reloadingContent;
    const reload = (async () => {
      if (this.loadingEntries) await this.loadingEntries.catch(() => undefined);
      this.entries = null;
      return this.load();
    })();
    this.reloadingContent = reload;
    try { return await reload; }
    finally {
      if (this.reloadingContent === reload) this.reloadingContent = null;
    }
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
    await this.savePlain("shop", shop.name, shop as unknown as Record<string, unknown>, previousKey, undefined, shop.tags);
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
      const inventory = value.inventory.map((item, order) => {
        const definition = equipment.find((entry) => normalizedName(entry.name) === normalizedName(item.name));
        if (!definition || item.cost.quantity > 0 || item.description || item.weapon || item.armor) return { ...item, order };
        const { rarity: _rarity, ...draft } = definition;
        return { ...draft, id: item.id, order, group: item.group, quantity: item.quantity, equipped: item.equipped, attuned: item.attuned };
      });
      return [{ ...value, inventory }];
    } catch { return []; } });
    return {
      spells: entries.filter((entry) => entry.kind === "spell").flatMap((entry) => { try { return [decorate(normalizeSpellDefinition(entry.payload), entry)]; } catch { return []; } }),
      equipment,
      monsters,
      shops: baseShops,
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
