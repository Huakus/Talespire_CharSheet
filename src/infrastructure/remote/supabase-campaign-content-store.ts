import type { SpellDefinition } from "../../domain/character/character-spell-model";
import { normalizeEquipmentDefinition, type EquipmentCatalogDraft } from "../../domain/equipment/equipment-catalog";
import { normalizeChecklistItem, normalizeShop, type GmChecklistItem, type GmShop } from "../../domain/gm/gm-global-content";
import { normalizeMonsterDefinition, type MonsterDefinition } from "../../domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../domain/spells/spell-catalog";
import { spellSourceTag } from "../../domain/spells/spell-source";
import type { CampaignContent } from "../../domain/content/campaign-content";
import type { CatalogMetadata } from "../../domain/content/catalog-metadata";
import type { CampaignMerchantTradeCommand } from "../../domain/commerce/merchant-trade";
import { EquipmentPreparationPayloadSchema, preparationFromOriginals, isEquipmentPreparationPayload, type EquipmentPreparation, type EquipmentPreparationIssue } from "../../domain/equipment/equipment-preparation";
import { captureEquipmentSource, verifyEquipmentSource } from "../../domain/equipment/equipment-recovery";
import { relatedEquipmentKeys } from "../../domain/equipment/equipment-candidates";
import {
  serializeChecklistContentPayload,
  serializeEquipmentContentPayload,
  serializeMonsterContentPayload,
  parseCampaignContentPayload,
  serializeShopContentPayload,
  serializeSpellContentPayload,
} from "../../domain/content/content-payload";
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

const SPANISH_LANGUAGE_MARKERS = new Set(["es", "esp", "spa", "espanol", "spanish"]);
const ENGLISH_LANGUAGE_MARKERS = new Set(["en", "eng", "ingles", "english"]);

function normalizedMarker(value: unknown): string {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/_/g, "-");
}

function languageMarkers(entry: RemoteCampaignContentEntry): Set<string> {
  const payload = object(entry.payload);
  return new Set([
    ...entry.tags.map(normalizedMarker),
    ...entry.contentKey.split(":").map(normalizedMarker),
    ...[payload.language, payload.locale, payload.lang].map(normalizedMarker),
  ].filter(Boolean));
}

/**
 * Official catalog rows must identify themselves as Spanish. Existing GM rows
 * predate language tags, so they remain available unless explicitly English.
 */
export function isSpanishCampaignContent(entry: RemoteCampaignContentEntry): boolean {
  const markers = languageMarkers(entry);
  const hasMarker = (expected: Set<string>): boolean => [...markers].some((marker) =>
    [...expected].some((language) => marker === language || marker.startsWith(`${language}-`)));
  const isSpanish = hasMarker(SPANISH_LANGUAGE_MARKERS);
  const isEnglish = hasMarker(ENGLISH_LANGUAGE_MARKERS);
  // An old snapshot is deliberately retained verbatim, even if it was English/2024.
  if (entry.kind === "spell" && entry.tags.includes("old")) return true;
  if (isEnglish) return false;
  return isSpanish || entry.origin === "gm";
}

function spanishTags(tags: readonly string[]): string[] {
  const retained = tags.filter((tag) => {
    const marker = normalizedMarker(tag);
    return !SPANISH_LANGUAGE_MARKERS.has(marker) && !ENGLISH_LANGUAGE_MARKERS.has(marker);
  });
  return [...new Set([...retained, "es"])];
}

function spellTags(value: SpellDefinition, existing: RemoteCampaignContentEntry | undefined): string[] {
  const source = spellSourceTag(value);
  if (source) return [source,...(value.catalog?.tags.includes("favorite") ? ["favorite"] : [])];
  // Other campaigns still use their original catalog; leave that vocabulary intact.
  if (existing) return spanishTags(value.catalog?.tags ?? existing.tags);
  return ["custom"];
}

export class SupabaseCampaignContentStore {
  private entries: RemoteCampaignContentEntry[] | null = null;
  private lastLoadedEntries: RemoteCampaignContentEntry[] | null = null;
  private loadingEntries: Promise<RemoteCampaignContentEntry[]> | null = null;
  private reloadingContent: Promise<CampaignContent> | null = null;
  private preparationEntries: RemoteCampaignContentEntry[] | null = null;
  private loadingPreparations: Promise<RemoteCampaignContentEntry[]> | null = null;

  constructor(private readonly client: SupabaseCampaignDocumentClient, private readonly campaignId: string) {}

  captureLoadedEntries(): RemoteCampaignContentEntry[] | null {
    // Do not refresh here: diagnostics must preserve what this client actually loaded.
    return this.lastLoadedEntries === null ? null : structuredClone(this.lastLoadedEntries);
  }

  async load(): Promise<CampaignContent> {
    if (this.entries === null) {
      this.loadingEntries ??= this.client.listCampaignContent(this.campaignId, "active");
      try { this.entries = await this.loadingEntries; }
      finally { this.loadingEntries = null; }
    }
    const active = this.entries.filter((entry) => !isEquipmentPreparationPayload(entry.payload));
    const projected = this.project(active);
    this.lastLoadedEntries = structuredClone(active);
    return projected;
  }

  /** Large recovery originals are fetched only by the GM preparation screen. */
  async loadEquipmentPreparations(refresh = false): Promise<Pick<CampaignContent, "equipmentPreparations" | "equipmentPreparationIssues">> {
    if (refresh) {
      if (this.loadingPreparations) await this.loadingPreparations.catch(() => undefined);
      this.preparationEntries = null;
    }
    const projected = this.project(await this.currentPreparationEntries());
    return { equipmentPreparations: projected.equipmentPreparations ?? [], equipmentPreparationIssues: projected.equipmentPreparationIssues ?? [] };
  }

  private async currentPreparationEntries(): Promise<RemoteCampaignContentEntry[]> {
    if (this.preparationEntries === null) {
      this.loadingPreparations ??= this.client.listCampaignContent(this.campaignId, "preparation");
      try { this.preparationEntries = (await this.loadingPreparations).filter((entry) => entry.kind === "equipment" && isEquipmentPreparationPayload(entry.payload)); }
      finally { this.loadingPreparations = null; }
    }
    return this.preparationEntries;
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
  async saveEquipmentPreparation(input: EquipmentPreparation): Promise<EquipmentPreparation> {
    const payload = EquipmentPreparationPayloadSchema.parse(input.payload);
    for (const original of payload.originals) if (!await verifyEquipmentSource(original)) throw new Error("Un original del borrador cambió o está dañado. No se guardó.");
    const entries = await this.currentEntries();
    const key = input.catalog?.contentKey ?? `gm:equipment:preparation:${payload.definition.id}`;
    const activeTarget = entries.find((entry) => entry.kind === "equipment" && entry.contentKey === key && !isEquipmentPreparationPayload(entry.payload));
    if (activeTarget) throw new Error("El destino pertenece al catálogo activo, no a preparación.");
    const preparations = await this.currentPreparationEntries();
    const existing = preparations.find((entry) => entry.contentKey === key);
    if (existing && EquipmentPreparationPayloadSchema.parse(existing.payload).definition.id !== payload.definition.id) throw new Error("La identidad del borrador no puede cambiar al guardarlo.");
    if ((existing?.revision ?? null) !== (input.catalog?.revision ?? null)) throw new Error("El borrador cambió. Volvé a cargarlo antes de guardar.");
    const saved = await this.client.saveCampaignContentEntry({ campaignId: this.campaignId, kind: "equipment", contentKey: key, name: payload.definition.name, payload,
      expectedRevision: existing?.revision ?? null, origin: existing?.origin ?? "gm",
      tags: [...new Set([...(existing?.tags ?? []).filter((tag) => tag !== "definitiva"), "es", "en_preparacion"])],
    });
    this.preparationEntries = [...preparations.filter((entry) => entry.contentKey !== key), saved];
    return { payload: EquipmentPreparationPayloadSchema.parse(saved.payload), catalog: { contentKey: saved.contentKey, origin: saved.origin, tags: saved.tags, revision: saved.revision } };
  }

  async prepareExistingEquipment(contentKey: string): Promise<EquipmentPreparation> {
    const entries = await this.currentEntries();
    const source = entries.find((entry) => entry.kind === "equipment" && entry.contentKey === contentKey && !isEquipmentPreparationPayload(entry.payload));
    if (!source) throw new Error("No se encontró la versión original del objeto.");
    const id = `recovery:${contentKey}`, key = `gm:equipment:preparation:${id}`;
    const previous = (await this.currentPreparationEntries()).find((entry) => entry.contentKey === key);
    if (previous) return { payload: EquipmentPreparationPayloadSchema.parse(previous.payload), catalog: { contentKey: previous.contentKey, origin: previous.origin, tags: previous.tags, revision: previous.revision } };
    const candidates = entries.filter((entry) => entry.kind === "equipment" && !isEquipmentPreparationPayload(entry.payload));
    const keys = new Set(relatedEquipmentKeys({ key: source.contentKey, name: source.name, index: source.payload.index }, candidates.map((entry) => ({ key: entry.contentKey, name: entry.name, index: entry.payload.index }))));
    const related = candidates.filter((entry) => keys.has(entry.contentKey));
    const originals = await Promise.all([source, ...related].map((entry) => captureEquipmentSource(`campaign:${this.campaignId}`, entry.contentKey, new Date().toISOString(), entry)));
    return preparationFromOriginals(id, originals[0]!, originals, this.campaignId);
  }
  saveMonster(value: MonsterDefinition, previousKey: string | null = null): Promise<void> { return this.saveDefinition("monster", value, previousKey); }
  deleteSpell(key: string): Promise<void> { return this.deleteByName("spell", key); }
  deleteEquipment(key: string): Promise<void> { return this.deleteByName("equipment", key); }
  deleteMonster(key: string): Promise<void> { return this.deleteByName("monster", key); }

  async saveShop(shop: GmShop, previousKey: string | null = null): Promise<void> {
    await this.savePlain("shop", shop.name, serializeShopContentPayload(shop), previousKey, undefined, shop.tags);
  }
  deleteShop(key: string): Promise<void> { return this.deleteByName("shop", key); }

  async saveChecklistItem(item: GmChecklistItem): Promise<void> {
    await this.savePlain("checklist", item.text, serializeChecklistContentPayload(item), item.id, `gm:checklist:${item.id}`);
  }
  deleteChecklistItem(key: string): Promise<void> { return this.deleteByKeyOrName("checklist", `gm:checklist:${key}`, key); }

  async executeMerchantTrade(command: CampaignMerchantTradeCommand): Promise<void> {
    const entries = (await this.currentEntries()).filter(isSpanishCampaignContent);
    const shopEntry = entries.find((entry) =>
      entry.kind === "shop" && normalizedName(entry.name) === normalizedName(command.shopName));
    const monsterEntry = entries.find((entry) =>
      entry.kind === "monster" && String(object(entry.payload).id ?? "") === command.merchantNpcId);
    if (!shopEntry || !monsterEntry) {
      throw new Error("El comerciante cambió o ya no está disponible. Actualizá la tienda e intentá nuevamente.");
    }
    await this.client.executeCampaignMerchantTrade({
      campaignId: this.campaignId,
      characterId: command.characterId,
      shopContentKey: shopEntry.contentKey,
      monsterContentKey: monsterEntry.contentKey,
      expectedCampaignRevision: command.expectedCampaignRevision,
      expectedCharacterRevision: command.expectedCharacterRevision,
      expectedShopRevision: shopEntry.revision,
      expectedMonsterRevision: monsterEntry.revision,
      buys: command.buys,
      sells: command.sells,
    });
    this.entries = null;
  }

  private project(entries: RemoteCampaignContentEntry[]): CampaignContent {
    const spanishEntries = entries.filter(isSpanishCampaignContent);
    const equipmentPreparations: EquipmentPreparation[] = [], equipmentPreparationIssues: EquipmentPreparationIssue[] = [];
    for (const entry of entries.filter((entry) => entry.kind === "equipment" && isEquipmentPreparationPayload(entry.payload))) {
      const parsed = EquipmentPreparationPayloadSchema.safeParse(entry.payload);
      if (parsed.success) equipmentPreparations.push({ payload: parsed.data, catalog: { contentKey: entry.contentKey, origin: entry.origin, tags: entry.tags, revision: entry.revision } });
      else equipmentPreparationIssues.push({ contentKey: entry.contentKey, name: entry.name, message: "El borrador no cumple el formato admitido. El original sigue guardado; revisalo antes de editar." });
    }
    const equipment = spanishEntries.filter((entry) => entry.kind === "equipment" && !isEquipmentPreparationPayload(entry.payload)).flatMap((entry) => { try { return [decorate(normalizeEquipmentDefinition(parseCampaignContentPayload(entry.kind, entry.payload)), entry)]; } catch { return []; } });
    const baseShops = spanishEntries.filter((entry) => entry.kind === "shop").flatMap((entry) => {
      try {
        const value = parseCampaignContentPayload(entry.kind, entry.payload);
        return [{ ...normalizeShop(String(value.name ?? entry.name), value), tags: entry.tags }];
      } catch { return []; }
    });
    const monsters = spanishEntries.filter((entry) => entry.kind === "monster").flatMap((entry) => { try {
      const value = decorate(normalizeMonsterDefinition(parseCampaignContentPayload(entry.kind, entry.payload)), entry);
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
      spells: spanishEntries.filter((entry) => entry.kind === "spell").flatMap((entry) => { try { return [decorate(normalizeSpellDefinition(parseCampaignContentPayload(entry.kind, entry.payload)), entry)]; } catch { return []; } }),
      equipment,
      ...(equipmentPreparations.length ? { equipmentPreparations } : {}),
      ...(equipmentPreparationIssues.length ? { equipmentPreparationIssues } : {}),
      monsters,
      shops: baseShops,
      checklist: spanishEntries.filter((entry) => entry.kind === "checklist").flatMap((entry) => { try { const value = parseCampaignContentPayload(entry.kind, entry.payload); return [normalizeChecklistItem(String(value.id ?? entry.contentKey.replace(/^.*:/, "")), value)]; } catch { return []; } }),
    };
  }

  private async currentEntries(): Promise<RemoteCampaignContentEntry[]> {
    if (this.entries === null) this.entries = await this.client.listCampaignContent(this.campaignId, "active");
    return this.entries;
  }

  private async saveDefinition(kind: Extract<CampaignContentKind, "spell" | "equipment" | "monster">, value: SpellDefinition | EquipmentCatalogDraft | MonsterDefinition, previousKey: string | null): Promise<void> {
    const entries = (await this.currentEntries()).filter((entry) => isSpanishCampaignContent(entry) && !isEquipmentPreparationPayload(entry.payload));
    const embedded = metadata(value);
    const embeddedEntry = embedded ? entries.find((entry) => entry.kind === kind && entry.contentKey === embedded.contentKey) : undefined;
    const existing = embeddedEntry?.name === previousKey ? embeddedEntry : entries.find((entry) => entry.kind === kind && normalizedName(entry.name) === normalizedName(previousKey ?? value.name));
    await this.persist({
      kind,
      name: value.name,
      payload: kind === "spell"
        ? serializeSpellContentPayload(value as SpellDefinition)
        : kind === "equipment"
          ? serializeEquipmentContentPayload({ ...(value as EquipmentCatalogDraft), ...(!(value as EquipmentCatalogDraft).rules && existing?.payload.rules ? { rules: existing.payload.rules } : {}) } as EquipmentCatalogDraft)
          : serializeMonsterContentPayload(value as MonsterDefinition),
      ...(existing ? { existing } : {}),
      origin: existing?.origin ?? "gm",
      tags: kind === "spell" ? spellTags(value as SpellDefinition,existing) : spanishTags(embedded?.tags ?? existing?.tags ?? ["gm"]),
    });
  }

  private async savePlain(kind: Extract<CampaignContentKind, "shop" | "checklist">, name: string, payload: Record<string, unknown>, previousKey: string | null, forcedKey?: string, requestedTags?: string[]): Promise<void> {
    const entries = (await this.currentEntries()).filter(isSpanishCampaignContent);
    const existing = entries.find((entry) => entry.kind === kind && (entry.contentKey === forcedKey || normalizedName(entry.name) === normalizedName(previousKey ?? name)));
    await this.persist({
      kind,
      name,
      payload,
      ...(existing ? { existing } : {}),
      origin: existing?.origin ?? "gm",
      tags: spanishTags(requestedTags ?? existing?.tags ?? ["gm"]),
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
    const existing = entries.find((entry) => isSpanishCampaignContent(entry) && !isEquipmentPreparationPayload(entry.payload) && entry.kind === kind && !(kind === "spell" && entry.tags.includes("old") && entry.contentKey !== contentKey) && (entry.contentKey === contentKey || normalizedName(entry.name) === normalizedName(name)));
    if (!existing) return;
    await this.client.deleteCampaignContentEntry(this.campaignId, kind, existing.contentKey, existing.revision);
    this.entries = entries.filter((entry) => !(entry.kind === kind && entry.contentKey === existing.contentKey));
  }
}
