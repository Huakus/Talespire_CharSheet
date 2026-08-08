import { describe, expect, it } from "vitest";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { SupabaseCampaignContentStore } from "../../src/infrastructure/remote/supabase-campaign-content-store";
import type {
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
  const saves: Array<Record<string, unknown>> = [];
  const deletes: Array<Record<string, unknown>> = [];
  const client = {
    listCampaignContent: async () => structuredClone(entries),
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
  return { client, saves, deletes, current: () => entries };
}

describe("Supabase campaign content store", () => {
  it("projects official rows and preserves their provenance while the GM edits tags", async () => {
    const remote = fakeClient([entry({
      kind: "spell",
      contentKey: "official:spell:es:escudo",
      name: "Escudo",
      payload: { name: "Escudo", level: "1st-level", desc: "Protección", school: "Abjuración" },
    })]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    const loaded = await store.load();
    expect(loaded.spells[0]).toMatchObject({ name: "Escudo", level: 1, legacyData: { __catalog: { origin: "official", tags: ["official", "es"] } } });

    const spell = loaded.spells[0]!;
    await store.saveSpell({
      ...spell,
      description: "Protección editada",
      legacyData: { ...spell.legacyData, __catalog: { contentKey: "official:spell:es:escudo", origin: "official", tags: ["oficial", "defensa"], revision: 0 } },
    }, "Escudo");

    expect(remote.saves[0]).toMatchObject({ contentKey: "official:spell:es:escudo", origin: "official", tags: ["oficial", "defensa"], expectedRevision: 0 });
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

  it("imports duplicate legacy names as campaign copies and deletes by persistent key", async () => {
    const remote = fakeClient([entry({ kind: "spell", contentKey: "official:spell:es:luz", name: "Luz", payload: { name: "Luz", level: "Cantrip" } })]);
    const store = new SupabaseCampaignContentStore(remote.client, campaignId);
    await store.load();
    const legacySpell = {
      name: "Luz", level: 0, description: "", higherLevels: "", range: "", components: "V", material: "", ritual: false,
      duration: "", concentration: false, castingTime: "1 acción", school: "Evocación", classes: "Mago", attackType: "none" as const,
      saveAbility: "", damageExpression: "", upcastDamageExpression: "", addAbilityModifier: false, damageType: "", year: "2014", legacyData: {},
    };
    const result = await store.importLegacy({ spells: [legacySpell], equipment: [], monsters: [], shops: [], checklist: [] });
    expect(result.imported).toBe(1);
    expect(remote.saves[0]).toMatchObject({ name: "Luz (importado)", origin: "imported", tags: ["imported", "gm"] });

    await store.deleteSpell("Luz (importado)");
    expect(remote.deletes[0]).toMatchObject({ kind: "spell", contentKey: remote.saves[0]!.contentKey, expectedRevision: 0 });
    expect(remote.current()).toHaveLength(1);
  });
});
