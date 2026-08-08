import type { SpellDefinition } from "../../domain/character/character-spell-model";
import { normalizeEquipmentDefinition, type EquipmentCatalogDraft } from "../../domain/equipment/equipment-catalog";
import { normalizeChecklistItem, normalizeShop, type GmChecklistItem, type GmShop } from "../../domain/gm/gm-global-content";
import { normalizeMonsterDefinition, type MonsterDefinition } from "../../domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../domain/spells/spell-catalog";
import type { JsonObject } from "../../shared/json";
import type { GlobalCustomContent } from "../talespire/talespire-global-content";
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

export class SupabaseCampaignContentStore {
  private entries: RemoteCampaignContentEntry[] | null = null;

  constructor(private readonly client: SupabaseCampaignDocumentClient, private readonly campaignId: string) {}

  async load(): Promise<GlobalCustomContent> {
    this.entries = await this.client.listCampaignContent(this.campaignId);
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
    await this.savePlain("shop", shop.name, shop as unknown as Record<string, unknown>, previousKey);
  }
  deleteShop(key: string): Promise<void> { return this.deleteByName("shop", key); }

  async saveChecklistItem(item: GmChecklistItem): Promise<void> {
    await this.savePlain("checklist", item.text, item as unknown as Record<string, unknown>, item.id, `gm:checklist:${item.id}`);
  }
  deleteChecklistItem(key: string): Promise<void> { return this.deleteByKeyOrName("checklist", `gm:checklist:${key}`, key); }

  async importLegacy(content: GlobalCustomContent): Promise<{ imported: number }> {
    let imported = 0;
    for (const spell of content.spells) { await this.saveImported("spell", spell.name, spell as unknown as Record<string, unknown>); imported += 1; }
    for (const item of content.equipment) { await this.saveImported("equipment", item.name, item as unknown as Record<string, unknown>); imported += 1; }
    for (const monster of content.monsters) { await this.saveImported("monster", monster.name, monster as unknown as Record<string, unknown>); imported += 1; }
    for (const shop of content.shops) { await this.saveImported("shop", shop.name, shop as unknown as Record<string, unknown>); imported += 1; }
    for (const item of content.checklist) { await this.saveImported("checklist", item.text, item as unknown as Record<string, unknown>, `imported:checklist:${item.id}`); imported += 1; }
    return { imported };
  }

  private project(entries: RemoteCampaignContentEntry[]): GlobalCustomContent {
    return {
      spells: entries.filter((entry) => entry.kind === "spell").flatMap((entry) => { try { return [decorate(normalizeSpellDefinition(entry.payload), entry)]; } catch { return []; } }),
      equipment: entries.filter((entry) => entry.kind === "equipment").flatMap((entry) => { try { return [decorate(normalizeEquipmentDefinition(entry.payload), entry)]; } catch { return []; } }),
      monsters: entries.filter((entry) => entry.kind === "monster").flatMap((entry) => { try { const value = normalizeMonsterDefinition(entry.payload); return value.name ? [decorate(value, entry)] : []; } catch { return []; } }),
      shops: entries.filter((entry) => entry.kind === "shop").flatMap((entry) => { try { const value = object(entry.payload); return [normalizeShop(String(value.name ?? entry.name), object(value.categories))]; } catch { return []; } }),
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

  private async savePlain(kind: Extract<CampaignContentKind, "shop" | "checklist">, name: string, payload: Record<string, unknown>, previousKey: string | null, forcedKey?: string): Promise<void> {
    const entries = await this.currentEntries();
    const existing = entries.find((entry) => entry.kind === kind && (entry.contentKey === forcedKey || normalizedName(entry.name) === normalizedName(previousKey ?? name)));
    await this.persist({
      kind,
      name,
      payload,
      ...(existing ? { existing } : {}),
      origin: existing?.origin ?? "gm",
      tags: existing?.tags ?? ["gm"],
      ...(forcedKey ? { forcedKey } : {}),
    });
  }

  private async saveImported(kind: CampaignContentKind, requestedName: string, payload: Record<string, unknown>, forcedKey?: string): Promise<void> {
    const entries = await this.currentEntries();
    let name = requestedName;
    if (entries.some((entry) => entry.kind === kind && normalizedName(entry.name) === normalizedName(name))) name = `${name} (importado)`;
    let suffix = 2;
    while (entries.some((entry) => entry.kind === kind && normalizedName(entry.name) === normalizedName(name))) name = `${requestedName} (importado ${suffix++})`;
    await this.persist({
      kind,
      name,
      payload: { ...payload, name },
      origin: "imported",
      tags: ["imported", "gm"],
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
