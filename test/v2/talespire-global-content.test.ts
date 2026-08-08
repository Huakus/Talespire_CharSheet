import { describe, expect, it } from "vitest";
import { parseLegacyGlobalContentText, TaleSpireGlobalContentStore } from "../../src/infrastructure/talespire/talespire-global-content";

describe("TaleSpire global custom content", () => {
  it("parses an exported extensionless global file and keeps every legacy field", () => {
    const loaded = parseLegacyGlobalContentText(JSON.stringify({
      "Custom Spells": { Eco: { name: "Eco", level: "2nd-level", class: "Mago, Bardo", components: "V, S", customField: "preserved" } },
      "Custom Equipment": { Capa: { name: "Capa", rarity: { index: "rare" }, description: ["Primera línea", "Segunda línea"], properties: [{ name: "magic" }], hasCharges: true, chargesOptions: { maxCharges: 3, chargeReset: "at-dawn" }, customField: 7 } },
      "Custom Monsters": { Guardián: { Name: "Guardián", Type: "Mediano no muerto, legal maligno", HP: { Value: 30 }, QuickAction: [{ Name: "Golpe", Damage: "1d8" }], Actions: [{ Name: "Golpe", Content: "Impacto: 1d8" }], DamageResistances: ["frío"], customField: true } },
    }));
    expect(loaded).toMatchObject({
      spells: [{ name: "Eco", level: 2, classes: "Mago, Bardo", legacyData: { customField: "preserved" } }],
      equipment: [{ name: "Capa", rarity: "rare", description: "Primera línea\n\nSegunda línea", properties: ["magic"], charges: { current: 3, maximum: 3, reset: "at-dawn" }, legacyData: { customField: 7 } }],
      monsters: [{ name: "Guardián", size: "Mediano", alignment: "legal maligno", hitPoints: 30, damageResistances: ["frío"], actions: [{ name: "Golpe", content: "Impacto: 1d8" }], legacyData: { customField: true } }],
    });
  });

  it("loads legacy collections and preserves unrelated global settings on write", async () => {
    let blob = JSON.stringify({
      language: { "Preferred Language": "es" },
      "Custom Spells": {
        Spark: { name: "Spark", level: "Cantrip", desc: "A spark", damage_dice: "1d4" },
      },
      "Custom Equipment": {
        Rope: { name: "Rope", weight: 10, equipment_category: { index: "adventuring-gear" } },
      },
      "Custom Monsters": {
        Slime: { Id: "Slime", Name: "Slime", Type: "Aberración", CR: "1", HP: { Value: 12, Notes: "(3d8)" }, AC: { Value: 9 } },
      },
    });
    const store = new TaleSpireGlobalContentStore({
      getBlob: async () => blob,
      setBlob: async (value) => { blob = value; },
    });
    const loaded = await store.load();
    expect(loaded.spells[0]).toMatchObject({ name: "Spark", level: 0 });
    expect(loaded.equipment[0]).toMatchObject({ name: "Rope", unitWeight: 10 });
    expect(loaded.monsters[0]).toMatchObject({ name: "Slime", challenge: "1", hitPoints: 12, armorClass: 9 });
    expect(loaded.shops).toEqual([]);
    expect(loaded.checklist).toEqual([]);

    await store.saveSpell({ ...loaded.spells[0]!, description: "Updated" });
    expect(JSON.parse(blob)).toMatchObject({
      language: { "Preferred Language": "es" },
      "Custom Spells": { Spark: { description: "Updated" } },
    });
  });

  it("round-trips shops, checklist entries, renamed spells and equipment", async () => {
    let blob = JSON.stringify({
      "Custom Spells": { Viejo: { name: "Viejo", level: 1 } },
      "Custom Equipment": { Viejo: { name: "Viejo" } },
      "Shop Data": { Mercado: { Pociones: ["potion-of-healing"] } },
      checklists: { task: { text: "Preparar mapa", checked: false } },
    });
    const store = new TaleSpireGlobalContentStore({ getBlob: async () => blob, setBlob: async (value) => { blob = value; } });
    const loaded = await store.load();
    expect(loaded.shops[0]).toEqual({ name: "Mercado", categories: { Pociones: ["potion-of-healing"] } });
    expect(loaded.checklist[0]).toEqual({ id: "task", text: "Preparar mapa", checked: false });

    await store.saveShop({ name: "Gran mercado", categories: { Equipo: ["rope"] } }, "Mercado");
    await store.saveChecklistItem({ id: "task", text: "Preparar mapa", checked: true });
    await store.deleteEquipment("Viejo");
    await store.deleteSpell("Viejo");
    const persisted = JSON.parse(blob);
    expect(persisted["Shop Data"]).toEqual({ "Gran mercado": { Equipo: ["rope"] } });
    expect(persisted.checklists.task.checked).toBe(true);
    expect(persisted["Custom Equipment"]).toEqual({});
    expect(persisted["Custom Spells"]).toEqual({});
  });

  it("creates, renames and deletes legacy-compatible custom monsters", async () => {
    let blob = JSON.stringify({ language: { "Preferred Language": "es" }, "Custom Monsters": {} });
    const store = new TaleSpireGlobalContentStore({
      getBlob: async () => blob,
      setBlob: async (value) => { blob = value; },
    });
    const monster = {
      id: "Mímico menor", name: "Mímico menor", type: "Monstruosidad", challenge: "2",
      armorClass: 13, hitPoints: 30, hitPointFormula: "4d8+12", initiativeModifier: 1,
      initiativeAdvantage: false, speed: ["15 pies"], abilities: { Str: 17, Dex: 12 },
      saves: [], skills: ["Sigilo +5"], senses: ["visión en la oscuridad 60 pies"], languages: [],
      damageVulnerabilities: [], damageResistances: ["ácido"], damageImmunities: [], conditionImmunities: [],
      traits: [{ name: "Forma falsa", content: "Parece un objeto.", usage: "" }],
      actions: [{ name: "Mordisco", content: "Impacto: 1d8+3.", usage: "" }], reactions: [], legendaryActions: [],
      spells: ["Burla cruel"], inventory: ["Poción de curación"], legacyData: {},
    };
    await store.saveMonster(monster);
    expect(JSON.parse(blob)).toMatchObject({
      language: { "Preferred Language": "es" },
      "Custom Monsters": { "Mímico menor": { Name: "Mímico menor", CR: "2", HP: { Value: 30 }, Actions: [{ Name: "Mordisco" }], Spells: ["Burla cruel"], Inventory: ["Poción de curación"] } },
    });
    await store.saveMonster({ ...monster, id: "Mímico", name: "Mímico" }, "Mímico menor");
    expect(JSON.parse(blob)["Custom Monsters"]["Mímico menor"]).toBeUndefined();
    expect(JSON.parse(blob)["Custom Monsters"].Mímico).toBeDefined();
    await store.deleteMonster("Mímico");
    expect(JSON.parse(blob)["Custom Monsters"]).toEqual({});
  });
});
