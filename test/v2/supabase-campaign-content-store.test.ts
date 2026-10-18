import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { merchantAfterPersuasion, normalizeMerchantInteraction } from "../../src/domain/commerce/merchant-interaction";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../src/domain/spells/spell-catalog";
import { equipmentDraftExample } from "../fixtures/equipment-definition-drafts";
import { EquipmentPreparationPayloadSchema, isEquipmentPreparationPayload } from "../../src/domain/equipment/equipment-preparation";
import { captureEquipmentSource } from "../../src/domain/equipment/equipment-recovery";
import { SupabaseCampaignContentStore } from "../../src/infrastructure/remote/supabase-campaign-content-store";
import {
  RemoteCampaignContentEntry,
  SupabaseCampaignDocumentClient,
} from "../../src/infrastructure/remote/supabase-campaign-document-client";

const campaignId = "00000000-0000-4000-8000-000000000001";

function entry(input: Partial<RemoteCampaignContentEntry> & Pick<RemoteCampaignContentEntry, "kind" | "contentKey" | "name" | "payload">): RemoteCampaignContentEntry {
  return {
    campaignId,
    origin: "official",
    tags: ["official", "es"],
    revision: 0,
    updatedAt: "2026-08-08T00:00:00.000Z",
    ...input,
  };
}

function fakeClient(initial: RemoteCampaignContentEntry[]) {
  let entries = structuredClone(initial);
  let loads = 0;
  const saves: Array<Record<string, unknown>> = [];
  const deletes: Array<Record<string, unknown>> = [];
  const trades: Array<Record<string, unknown>> = [];
  const client = {
    listCampaignContent: async (_campaignId: string, scope = "all") => { loads += 1; return structuredClone(entries.filter((entry) => scope === "all" || (scope === "preparation" ? isEquipmentPreparationPayload(entry.payload) : !isEquipmentPreparationPayload(entry.payload)))); },
    saveCampaignContentEntry: async (input: Record<string, unknown>) => {
      saves.push(structuredClone(input));
      const previous = entries.find((item) => item.kind === input.kind && item.contentKey === input.contentKey);
      const saved = entry({
        kind: input.kind as RemoteCampaignContentEntry["kind"],
        contentKey: String(input.contentKey),
        name: String(input.name),
        origin: input.origin as RemoteCampaignContentEntry["origin"],
        tags: input.tags as string[],
        payload: input.payload as Record<string, unknown>,
        revision: (previous?.revision ?? -1) + 1,
      });
      entries = [...entries.filter((item) => !(item.kind === saved.kind && item.contentKey === saved.contentKey)), saved];
      return structuredClone(saved);
    },
    deleteCampaignContentEntry: async (_campaignId: string, kind: string, contentKey: string, expectedRevision: number) => {
      deletes.push({ kind, contentKey, expectedRevision });
      entries = entries.filter((item) => !(item.kind === kind && item.contentKey === contentKey));
    },
    executeCampaignMerchantTrade: async (input: Record<string, unknown>) => {
      trades.push(structuredClone(input));
      return {
        campaignRevision: 5,
        characterRevision: 3,
        shopRevision: 8,
        monsterRevision: 10,
        buySubtotalCopper: 200,
        sellSubtotalCopper: 25,
        commissionCopper: 35,
        characterCurrencyDeltaCopper: -210,
        merchantCurrencyDeltaCopper: 210,
        updatedAt: "2026-08-30T00:00:00.000Z",
      };
    },
  } as unknown as SupabaseCampaignDocumentClient;
  return { client, saves, deletes, trades, current: () => entries, loads: () => loads };
}

describe("Supabase campaign content store", () => {
  it("loads recovery originals separately and never requests them when loading the active catalog", async () => {
    const definition = equipmentDraftExample();
    const draft = entry({ kind: "equipment", contentKey: "prep:one", name: definition.name, payload: EquipmentPreparationPayloadSchema.parse({ schemaVersion: 2, kind: "equipment", language: "es", format: "equipment-preparation", definition, originals: [], decisions: [] }) });
    const calls: string[] = [];
    const client = { listCampaignContent: async (_id: string, scope: string) => { calls.push(scope); return [draft]; } } as unknown as SupabaseCampaignDocumentClient;
    const store = new SupabaseCampaignContentStore(client, campaignId);
    expect((await store.load()).equipmentPreparations).toBeUndefined();
    expect(store.captureLoadedEntries()).toEqual([]);
    expect(calls).toEqual(["active"]);
    expect((await store.loadEquipmentPreparations()).equipmentPreparations).toHaveLength(1);
    await store.loadEquipmentPreparations();
    expect(calls).toEqual(["active", "preparation"]);
    await store.loadEquipmentPreparations(true);
    expect(calls).toEqual(["active", "preparation", "preparation"]);
  });

  it("sends separate null-safe active and preparation filters through the installed Supabase SDK", async () => {
    const urls: URL[] = [];
    const sdk = createClient("https://example.supabase.co", "test-publishable-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (input) => { urls.push(new URL(String(input))); return new Response("[]", { headers: { "Content-Type": "application/json" } }); } },
    });
    const client = new SupabaseCampaignDocumentClient(sdk);
    await client.listCampaignContent(campaignId, "active");
    await client.listCampaignContent(campaignId, "preparation");
    expect(urls[0]!.searchParams.get("or")).toBe("(payload->>format.is.null,payload->>format.neq.equipment-preparation)");
    expect(urls[1]!.searchParams.get("payload->>format")).toBe("eq.equipment-preparation");
    expect(urls[1]!.searchParams.get("kind")).toBe("eq.equipment");
    for (const url of urls) { expect(url.searchParams.get("campaign_id")).toBe(`eq.${campaignId}`); expect(url.searchParams.get("deleted_at")).toBe("is.null"); }
  });

  it("round-trips preparation separately from an active item with the same name", async () => {
    const definition = equipmentDraftExample();
    const active = entry({ kind: "equipment", contentKey: "active:one", name: definition.name, payload: { name: definition.name, description: "Original activo" } });
    const remote = fakeClient([active]), store = new SupabaseCampaignContentStore(remote.client, campaignId);
    const original = await captureEquipmentSource("ECE", active.contentKey, "2026-10-17T00:00:00.000Z", { ...active, payload: { ...active.payload, unknownUsefulField: { english: "Keep all information", limit: 0 } } });
    const payload = EquipmentPreparationPayloadSchema.parse({ schemaVersion: 2, kind: "equipment", language: "es", format: "equipment-preparation", definition, originals: [original], decisions: [] });
    await store.saveEquipmentPreparation({ payload, catalog: null });
    const loaded = await store.load();
    expect(loaded.equipment).toHaveLength(1);
    expect(loaded.equipmentPreparations).toBeUndefined();
    const preparationContent = await store.loadEquipmentPreparations();
    expect(preparationContent.equipmentPreparations).toHaveLength(1);
    expect(preparationContent.equipmentPreparations?.[0]?.payload).toEqual(payload);
    expect(remote.current().find((row) => row.contentKey === "active:one")).toEqual(active);
    expect(remote.saves[0]?.tags).not.toContain("definitiva");
    expect(remote.deletes).toHaveLength(0);
    await store.saveEquipment({ ...normalizeEquipmentDefinition({ name: definition.name }), catalog: loaded.equipment[0]!.catalog }, definition.name);
    expect(remote.saves.at(-1)?.contentKey).toBe("active:one");
    await store.deleteEquipment(definition.name);
    expect((await store.loadEquipmentPreparations()).equipmentPreparations).toHaveLength(1);
  });

  it("prepares the exact original without changing the active entry or inventing reviewed rules", async () => {
    const original = entry({ kind: "equipment", contentKey: "active:recover", name: "Objeto a recuperar", payload: { name: "Objeto a recuperar", desc: [" Texto original. ", "Second English line"], source: "Legacy book", page: 10, special: { extra: [false, null, 0] } } });
    const remote = fakeClient([original]), store = new SupabaseCampaignContentStore(remote.client, campaignId);
    const preparation = await store.prepareExistingEquipment(original.contentKey);
    expect(preparation.payload.originals[0]?.raw).toEqual(original);
    expect(preparation.payload.definition.description[0]).toMatchObject({ text: " Texto original. ", provenance: "unreviewed" });
    expect(preparation.payload.definition.requirements.attunement).toBeNull();
    expect(remote.saves).toHaveLength(0);
    await store.saveEquipmentPreparation(preparation);
    const existing = await store.prepareExistingEquipment(original.contentKey);
    expect(existing.catalog?.revision).toBe(0);
    expect(existing.payload).toEqual(preparation.payload);
    expect(remote.current().find((row) => row.contentKey === original.contentKey)).toEqual(original);
  });

  it("detects stale preparation revisions and damaged archives before saving", async () => {
    const remote = fakeClient([entry({ kind: "equipment", contentKey: "active:source", name: "Objeto", payload: { name: "Objeto" } })]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    const initial = await store.prepareExistingEquipment("active:source");
    await store.saveEquipmentPreparation(initial);
    const loaded = (await store.loadEquipmentPreparations()).equipmentPreparations![0]!;
    await store.saveEquipmentPreparation(loaded);
    await expect(store.saveEquipmentPreparation(loaded)).rejects.toThrow("cambió");
    const damaged = structuredClone((await store.loadEquipmentPreparations()).equipmentPreparations![0]!);
    damaged.payload.originals[0]!.raw.description = "Cambio no verificado";
    await expect(store.saveEquipmentPreparation(damaged)).rejects.toThrow("original");
    const activeTarget = structuredClone(initial); activeTarget.catalog = { contentKey: "active:source", origin: "official", tags: ["es"], revision: 0 };
    await expect(store.saveEquipmentPreparation(activeTarget)).rejects.toThrow("catálogo activo");
    expect(remote.saves).toHaveLength(2);
  });

  it("reports invalid preparation payloads without exposing them as usable items", async () => {
    const remote = fakeClient([entry({ kind: "equipment", contentKey: "broken:preparation", name: "Borrador incompleto", payload: { format: "equipment-preparation", schemaVersion: 9, definition: { name: "Borrador incompleto" } } })]);
    const loaded = await new SupabaseCampaignContentStore(remote.client, campaignId).loadEquipmentPreparations();
    expect(loaded.equipmentPreparationIssues?.[0]?.contentKey).toBe("broken:preparation");
    expect(remote.current()[0]?.payload.schemaVersion).toBe(9);
  });
  it("keeps one source tag when saving a curated spell without reintroducing language tags",async()=>{
    const remote=fakeClient([]),store=new SupabaseCampaignContentStore(remote.client,campaignId);
    await store.saveSpell({ ...normalizeSpellDefinition({ name: "Conjuro de prueba",level: 1 }),catalog: { contentKey: "official:spell:es:2014:test",origin: "official",tags: ["manual_jugador"],revision: 0 } });
    expect(remote.saves[0]?.tags).toEqual(["manual_jugador"]);
    expect(remote.saves[0]?.payload).toMatchObject({ language: "es",year: "2014" });
  });
  it("loads old snapshots verbatim even when their legacy key and text are English",async()=>{
    const remote=fakeClient([entry({ kind: "spell",contentKey: "old:spell:eng:historical",name: "Phantasmal Force",origin: "imported",tags: ["old"],payload: { name: "Phantasmal Force",level: 2,year: "2024",desc: "Original",language: "en" } })]);
    expect((await new SupabaseCampaignContentStore(remote.client,campaignId).load()).spells[0]).toMatchObject({ name: "Phantasmal Force",year: "2024",description: "Original",catalog: { tags: ["old"] } });
  });
  it("does not delete a retained version when the active definition has the same name",async()=>{
    const remote=fakeClient([
      entry({ kind: "spell",contentKey: "old:spell:first",name: "Luz",origin: "imported",tags: ["old"],payload: { name: "Luz",level: 0 } }),
      entry({ kind: "spell",contentKey: "official:spell:es:2014:light",name: "Luz",tags: ["manual_jugador"],payload: { name: "Luz",level: 0,language: "es" } }),
    ]);
    await new SupabaseCampaignContentStore(remote.client,campaignId).deleteSpell("Luz");
    expect(remote.deletes[0]?.contentKey).toBe("official:spell:es:2014:light");
    expect(remote.current().some((r)=>r.tags.includes("old"))).toBe(true);
  });
  it("captures the catalog the client loaded without refreshing or replacing it after cache invalidation", async () => {
    const savedEntry = entry({ kind: 'spell', contentKey: 'spell:test', name: 'Test', payload: { name: 'Test', level: 0 } });
    const fake = fakeClient([savedEntry]);
    const store = new SupabaseCampaignContentStore(fake.client, campaignId);
    expect(store.captureLoadedEntries()).toBeNull();
    await store.load();
    const captured = store.captureLoadedEntries()!;
    captured[0]!.name = 'changed diagnostic copy';
    expect(store.captureLoadedEntries()![0]!.name).toBe('Test');
    await store.deleteSpell('Test');
    expect(store.captureLoadedEntries()![0]!.name).toBe('Test');
    expect(fake.loads()).toBe(1);
    await store.reload();
    expect(store.captureLoadedEntries()).toEqual([]);
  });
  it("subscribes to inserts and updates for this campaign and to unfiltered deletes", async () => {
    const registrations: Array<Record<string, unknown>> = [];
    let removed = false;
    const channel = {
      on: (_kind: string, config: Record<string, unknown>, _listener: () => void) => {
        registrations.push(config);
        return channel;
      },
      subscribe: (listener: (status: string) => void) => {
        listener("SUBSCRIBED");
        return channel;
      },
    };
    const client = new SupabaseCampaignDocumentClient({
      channel: () => channel,
      removeChannel: async () => { removed = true; },
    } as never);

    const subscription = client.subscribeCampaignContent(campaignId, () => undefined);
    await subscription.ready;
    expect(registrations).toEqual([
      expect.objectContaining({ event: "INSERT", table: "campaign_content_entries", filter: `campaign_id=eq.${campaignId}` }),
      expect.objectContaining({ event: "UPDATE", table: "campaign_content_entries", filter: `campaign_id=eq.${campaignId}` }),
      expect.objectContaining({ event: "DELETE", table: "campaign_content_entries" }),
    ]);
    expect(registrations[2]).not.toHaveProperty("filter");
    await subscription.unsubscribe();
    expect(removed).toBe(true);
  });

  it("loads every content page instead of stopping at Supabase's first 1000 rows", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      campaign_id: campaignId,
      kind: "equipment",
      content_key: `official:equipment:${String(index).padStart(4, "0")}`,
      name: `Objeto ${index}`,
      origin: "official",
      tags: ["official"],
      payload: { name: `Objeto ${index}` },
      revision: 0,
      updated_at: "2026-08-08T00:00:00.000Z",
      deleted_at: null,
    }));
    const ranges: Array<[number, number]> = [];
    const builder = {
      select() { return this; },
      eq() { return this; },
      is() { return this; },
      order() { return this; },
      range(from: number, to: number) {
        ranges.push([from, to]);
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
      },
    };
    const client = new SupabaseCampaignDocumentClient({ from: () => builder } as never);
    const loaded = await client.listCampaignContent(campaignId);
    expect(loaded).toHaveLength(1001);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  });

  it("preserves the imported origin returned by the current database schema", async () => {
    const rows = [{
      campaign_id: campaignId,
      kind: "spell",
      content_key: "imported:spell:es:normalizado",
      name: "Conjuro importado",
      origin: "imported",
      tags: ["imported", "es"],
      payload: { name: "Conjuro importado", level: "1st-level", classes: ["wizard"] },
      revision: 0,
      updated_at: "2026-08-08T00:00:00.000Z",
      deleted_at: null,
    }];
    const builder = {
      select() { return this; }, eq() { return this; }, is() { return this; }, order() { return this; },
      range() { return Promise.resolve({ data: rows, error: null }); },
    };

    const loaded = await new SupabaseCampaignDocumentClient({ from: () => builder } as never).listCampaignContent(campaignId);

    expect(loaded[0]?.origin).toBe("imported");
  });

  it("calls the atomic merchant trade RPC with the current content revisions", async () => {
    const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = new SupabaseCampaignDocumentClient({
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args });
        return { data: {
          campaignRevision: 5,
          characterRevision: 3,
          shopRevision: 8,
          monsterRevision: 10,
          buySubtotalCopper: 200,
          sellSubtotalCopper: 25,
          commissionCopper: 35,
          characterCurrencyDeltaCopper: -210,
          merchantCurrencyDeltaCopper: 210,
          updatedAt: "2026-08-30T00:00:00.000Z",
        }, error: null };
      },
    } as never);

    const result = await client.executeCampaignMerchantTrade({
      campaignId,
      characterId: "char_player",
      shopContentKey: "gm:shop:mirna",
      monsterContentKey: "gm:monster:mirna",
      expectedCampaignRevision: 4,
      expectedCharacterRevision: 2,
      expectedShopRevision: 7,
      expectedMonsterRevision: 9,
      buys: [{ itemId: "merchant_item", quantity: 2 }],
      sells: [{ itemId: "character_item", quantity: 1 }],
    });

    expect(rpcCalls).toEqual([{ name: "execute_campaign_merchant_trade", args: {
      p_campaign_id: campaignId,
      p_character_id: "char_player",
      p_shop_content_key: "gm:shop:mirna",
      p_monster_content_key: "gm:monster:mirna",
      p_expected_campaign_revision: 4,
      p_expected_character_revision: 2,
      p_expected_shop_revision: 7,
      p_expected_monster_revision: 9,
      p_buys: [{ itemId: "merchant_item", quantity: 2 }],
      p_sells: [{ itemId: "character_item", quantity: 1 }],
    } }]);
    expect(result).toMatchObject({ campaignRevision: 5, characterCurrencyDeltaCopper: -210 });
  });

  it("resolves shop and NPC metadata before executing a player trade", async () => {
    const remote = fakeClient([
      entry({ kind: "shop", contentKey: "gm:shop:mirna", name: "Curiosidades de Mirna", origin: "gm", revision: 7, payload: { name: "Curiosidades de Mirna", npcId: "npc_mirna" } }),
      entry({ kind: "monster", contentKey: "gm:monster:mirna", name: "Mirna", origin: "gm", revision: 9, payload: { id: "npc_mirna", name: "Mirna" } }),
    ]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    await store.load();

    await store.executeMerchantTrade({
      expectedCampaignRevision: 4,
      characterId: "char_player",
      expectedCharacterRevision: 2,
      shopName: "Curiosidades de Mirna",
      merchantNpcId: "npc_mirna",
      buys: [{ itemId: "merchant_item", quantity: 2 }],
      sells: [{ itemId: "character_item", quantity: 1 }],
    });

    expect(remote.trades).toEqual([expect.objectContaining({
      campaignId,
      shopContentKey: "gm:shop:mirna",
      monsterContentKey: "gm:monster:mirna",
      expectedShopRevision: 7,
      expectedMonsterRevision: 9,
    })]);
    await store.load();
    expect(remote.loads()).toBe(2);
  });

  it("projects official rows and preserves their provenance while the GM edits tags", async () => {
    const remote = fakeClient([entry({
      kind: "spell",
      contentKey: "official:spell:es:escudo",
      name: "Escudo",
      payload: { name: "Escudo", level: "1st-level", desc: "Protección", school: "Abjuración" },
    })]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    const loaded = await store.load();
    expect(loaded.spells[0]).toMatchObject({ name: "Escudo", level: 1, catalog: { origin: "official", tags: ["official", "es"] } });

    const spell = loaded.spells[0]!;
    await store.saveSpell({
      ...spell,
      description: "Protección editada",
      catalog: { contentKey: "official:spell:es:escudo", origin: "official", tags: ["oficial", "defensa"], revision: 0 },
    }, "Escudo");

    expect(remote.saves[0]).toMatchObject({ contentKey: "official:spell:es:escudo", origin: "official", tags: ["oficial", "defensa", "es"], expectedRevision: 0 });
  });

  it("projects only Spanish catalog content and keeps legacy untagged GM entries", async () => {
    const remote = fakeClient([
      entry({ kind: "spell", contentKey: "official:spell:es:escudo", name: "Escudo", payload: { name: "Escudo", level: 1 } }),
      entry({ kind: "spell", contentKey: "official:spell:en:shield", name: "Shield", tags: ["official", "en"], payload: { name: "Shield", level: 1 } }),
      entry({ kind: "equipment", contentKey: "official:equipment:untagged", name: "Rope", tags: ["official"], payload: { name: "Rope" } }),
      entry({ kind: "equipment", contentKey: "official:equipment:eng:chain", name: "Chain", tags: ["official", "eng"], payload: { name: "Chain" } }),
      entry({ kind: "monster", contentKey: "official:monster:oso", name: "Oso", tags: ["official", "español"], payload: { Name: "Oso", Type: "Bestia" } }),
      entry({ kind: "spell", contentKey: "imported:spell:es:normalizado", name: "Importado", origin: "imported", tags: ["imported", "es"], payload: { name: "Importado", level: 1, classes: ["wizard"] } }),
      entry({ kind: "shop", contentKey: "gm:shop:legacy", name: "La Posta", origin: "gm", tags: ["gm"], payload: { name: "La Posta" } }),
      entry({ kind: "checklist", contentKey: "gm:checklist:english", name: "Buy rope", origin: "gm", tags: ["gm", "english"], payload: { id: "english", text: "Buy rope" } }),
    ]);

    const loaded = await new SupabaseCampaignContentStore(remote.client, campaignId).load();

    expect(loaded.spells.map((spell) => spell.name)).toEqual(["Escudo", "Importado"]);
    expect(loaded.spells[1]?.catalog?.origin).toBe("imported");
    expect(loaded.equipment).toEqual([]);
    expect(loaded.monsters.map((monster) => monster.name)).toEqual(["Oso"]);
    expect(loaded.shops.map((shop) => shop.name)).toEqual(["La Posta"]);
    expect(loaded.checklist).toEqual([]);
  });

  it("marks new GM content as Spanish", async () => {
    const remote = fakeClient([]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);

    await store.saveShop({ name: "La Posta", categories: {} });

    expect(remote.saves[0]).toMatchObject({ origin: "gm", tags: ["gm", "es"] });
  });

  it("renames equipment and shops without creating duplicate content entries", async () => {
    const remote = fakeClient([
      entry({ kind: "equipment", contentKey: "gm:equipment:rope", name: "Cuerda", origin: "gm", tags: ["gm", "es"], revision: 3, payload: { name: "Cuerda" } }),
      entry({ kind: "shop", contentKey: "gm:shop:market", name: "Mercado", origin: "gm", tags: ["gm", "es"], revision: 5, payload: { name: "Mercado", categories: {} } }),
    ]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);

    await store.saveEquipment(normalizeEquipmentDefinition({ name: "Cuerda de seda" }), "Cuerda");
    await store.saveShop({ name: "Mercado de la plaza", categories: {} }, "Mercado");

    expect(remote.saves[0]).toMatchObject({ contentKey: "gm:equipment:rope", name: "Cuerda de seda", expectedRevision: 3 });
    expect(remote.saves[1]).toMatchObject({ contentKey: "gm:shop:market", name: "Mercado de la plaza", expectedRevision: 5 });
    expect(remote.current().filter((item) => item.kind === "equipment")).toHaveLength(1);
    expect(remote.current().filter((item) => item.kind === "shop")).toHaveLength(1);
  });

  it("writes a versioned canonical spell payload without legacy duplicates", async () => {
    const remote = fakeClient([]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    const spell = normalizeSpellDefinition({ name: "Luz compartida", level: 1, classes: ["wizard", "cleric"] });

    await store.saveSpell(spell);

    expect(remote.saves[0]?.payload).toEqual(expect.objectContaining({
      schemaVersion: 1,
      kind: "spell",
      language: "es",
      classes: ["wizard", "cleric"],
      components: [],
      ritual: false,
      concentration: false,
    }));
    expect(remote.saves[0]?.payload).not.toHaveProperty("class");
    expect(remote.saves[0]?.payload).not.toHaveProperty("catalog");
  });

  it("reuses one campaign catalog download across the GM panels", async () => {
    const remote = fakeClient([entry({ kind: "spell", contentKey: "official:spell:test", name: "Prueba", payload: { name: "Prueba", level: 1 } })]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    const [first, second, third] = await Promise.all([store.load(), store.load(), store.load()]);
    expect(first.spells[0]?.name).toBe("Prueba");
    expect(second.spells[0]?.name).toBe("Prueba");
    expect(third.spells[0]?.name).toBe("Prueba");
    expect(remote.loads()).toBe(1);
  });

  it("reloads changed merchant content once when realtime emits concurrent signals", async () => {
    const remote = fakeClient([entry({ kind: "shop", contentKey: "gm:shop:mirna", name: "Mirna", payload: { name: "Mirna", interactions: { fundsCopper: 100 } } })]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    expect((await store.load()).shops[0]?.interactions?.fundsCopper).toBe(100);
    remote.current()[0]!.payload = { name: "Mirna", interactions: { fundsCopper: 75 } };

    const [first, second] = await Promise.all([store.reload(), store.reload()]);

    expect(first.shops[0]?.interactions?.fundsCopper).toBe(75);
    expect(second.shops[0]?.interactions?.fundsCopper).toBe(75);
    expect(remote.loads()).toBe(2);
  });

  it("round-trips normalized equipment and monster values without losing combat fields", async () => {
    const equipment = normalizeEquipmentDefinition({ name: "Arco de prueba", weight: 2, equipment_category: { index: "weapon" }, damage: { damage_dice: "1d8", damage_type: { index: "piercing" } } });
    const monster = normalizeMonsterDefinition({ Name: "Bestia de prueba", Type: "Bestia", CR: "2", HP: { Value: 37, Notes: "5d8+15" }, AC: { Value: 14 }, Speed: ["30 pies"] });
    const remote = fakeClient([
      entry({ kind: "equipment", contentKey: "gm:equipment:test", name: equipment.name, origin: "gm", tags: ["gm"], payload: equipment as unknown as Record<string, unknown> }),
      entry({ kind: "monster", contentKey: "gm:monster:test", name: monster.name, origin: "gm", tags: ["gm"], payload: monster as unknown as Record<string, unknown> }),
    ]);

    const loaded = await new SupabaseCampaignContentStore(remote.client, campaignId).load();
    expect(loaded.equipment[0]).toMatchObject({ name: "Arco de prueba", unitWeight: 2, weapon: { damageExpression: "1d8", damageType: "piercing" } });
    expect(loaded.monsters[0]).toMatchObject({ name: "Bestia de prueba", armorClass: 14, hitPoints: 37, hitPointFormula: "5d8+15" });
  });

  it("keeps merchant stock solely in the linked NPC inventory", async () => {
    const monster = normalizeMonsterDefinition({ Id: "npc_mirna", Name: "Mirna", Type: "Humanoide", Inventory: ["Vieja moneda"] });
    const dagger = { ...normalizeEquipmentDefinition({ name: "Daga", cost: { quantity: 2, unit: "gp" }, equipment_category: { index: "weapon" } }), catalog: { contentKey: "gm:equipment:dagger", origin: "gm" as const, tags: ["es", "custom"], revision: 4 } };
    const remote = fakeClient([
      entry({ kind: "monster", contentKey: "gm:monster:mirna", name: monster.name, origin: "gm", tags: ["gm"], payload: monster as unknown as Record<string, unknown> }),
      entry({ kind: "equipment", contentKey: "gm:equipment:dagger", name: dagger.name, origin: "gm", tags: ["gm"], payload: dagger as unknown as Record<string, unknown> }),
    ]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    await store.saveMonster(normalizeMonsterDefinition({
      ...monster,
      Inventory: [
        { ...dagger, id: "inv_33333333333333333333333333333333", order: 0, group: "backpack", quantity: 1 },
        { ...normalizeEquipmentDefinition({ name: "Cuerda" }), id: "inv_44444444444444444444444444444444", order: 1, group: "backpack", quantity: 2 },
      ],
    }));
    await store.saveShop({
      name: "Curiosidades de Mirna",
      npcId: "npc_mirna",
      categories: {},
      interactions: merchantAfterPersuasion(normalizeMerchantInteraction({ commissionPercent: 20, fundsCopper: 5_000 }), true),
    });

    const savedMonster = remote.saves.find((save) => save.kind === "monster");
    expect(savedMonster?.payload).toMatchObject({ inventory: [
      expect.objectContaining({ name: "Daga", quantity: 1, catalog: dagger.catalog }),
      expect.objectContaining({ name: "Cuerda", quantity: 2 }),
    ] });
    const savedShop = remote.saves.find((save) => save.kind === "shop");
    expect(savedShop?.payload).toMatchObject({ npcId: "npc_mirna", categories: {} });
    expect(savedShop?.payload).not.toHaveProperty("inventory");
    const loaded = await store.load();
    expect(loaded.monsters.find((value) => value.id === "npc_mirna")?.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringMatching(/^inv_[a-f0-9]{32}$/), name: "Daga", quantity: 1, cost: { quantity: 2, unit: "gp" }, catalog: dagger.catalog }),
      expect.objectContaining({ name: "Cuerda", quantity: 2 }),
    ]));
    expect(loaded.shops[0]?.inventory).toBeUndefined();
    expect(loaded.shops[0]?.interactions).toMatchObject({ commissionPercent: 15, fundsCopper: 5_000 });
  });

});
