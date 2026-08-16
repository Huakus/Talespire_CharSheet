import { describe, expect, it } from "vitest";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { merchantAfterPersuasion, normalizeMerchantInteraction } from "../../src/domain/commerce/merchant-interaction";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../src/domain/spells/spell-catalog";
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
  const client = {
    listCampaignContent: async () => { loads += 1; return structuredClone(entries); },
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
  } as unknown as SupabaseCampaignDocumentClient;
  return { client, saves, deletes, current: () => entries, loads: () => loads };
}

describe("Supabase campaign content store", () => {
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
    const dagger = normalizeEquipmentDefinition({ name: "Daga", cost: { quantity: 2, unit: "gp" }, equipment_category: { index: "weapon" } });
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
      expect.objectContaining({ name: "Daga", quantity: 1 }),
      expect.objectContaining({ name: "Cuerda", quantity: 2 }),
    ] });
    const savedShop = remote.saves.find((save) => save.kind === "shop");
    expect(savedShop?.payload).toMatchObject({ npcId: "npc_mirna", categories: {} });
    expect(savedShop?.payload).not.toHaveProperty("inventory");
    const loaded = await store.load();
    expect(loaded.monsters.find((value) => value.id === "npc_mirna")?.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringMatching(/^inv_[a-f0-9]{32}$/), name: "Daga", quantity: 1, cost: { quantity: 2, unit: "gp" } }),
      expect.objectContaining({ name: "Cuerda", quantity: 2 }),
    ]));
    expect(loaded.shops[0]?.inventory).toBeUndefined();
    expect(loaded.shops[0]?.interactions).toMatchObject({ commissionPercent: 15, fundsCopper: 5_000 });
  });

});
