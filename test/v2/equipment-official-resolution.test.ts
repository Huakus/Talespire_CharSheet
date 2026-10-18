import { describe, expect, it } from "vitest";
import resolved from "../../docs/v2/equipment-preparation-2026-10-17/official-resolution-definitions.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { createCharacter } from "../../src/domain/character/create-character";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { CharacterSpellV2Schema } from "../../src/domain/character/character-spell-model";
import { projectAbilityScore, projectSpellcasting } from "../../src/domain/character/character-projection";
import { recoverInventoryItem, setInventoryItemAttuned, useInventoryFeature } from "../../src/domain/character/character-inventory";

const now = "2026-10-18T15:00:00.000Z", itemId = "inv_11111111111111111111111111111111";
const definitions = resolved.map((d) => EquipmentDefinitionDraftSchema.parse(d));
const definition = (name: string) => definitions.find((d) => d.name === name)!;
const character = (className: string) => {
  const c = createCharacter("chr_11111111111111111111111111111111", "Prueba", now);
  c.identity.className = className; c.spellcasting.ability = "CAR"; c.abilities.charisma = 16;
  return c;
};
const item = (name: string) => bindReviewedEquipment(CharacterInventoryItemV2Schema.parse({ id: itemId, order: 0, group: "Mochila", name, quantity: 1, unitWeight: 0, cost: { quantity: 0, unit: "gp" }, category: "wondrous-item", description: "", properties: [], equipped: true, attuned: true, requiresAttunement: false, usable: false, consumable: false, armor: null, weapon: null, bonuses: [], charges: { current: 1, maximum: 1, reset: "dawn" } }), definition(name));
const spell = (source: string) => CharacterSpellV2Schema.parse({ id: "spl_11111111111111111111111111111111", order: 0, name: "Prueba", level: 1, prepared: true, definition: null, effect: { description: "", active: false }, casting: { source, ability: "charisma", kind: "slots", level: 1, key: "test", traitId: null } });

describe("official replacements of quarantined equipment", () => {
  it("creates six concrete belts with source-verified strengths, including distinct stone and frost variants", () => {
    const belts = definitions.filter((d) => d.capabilities.some((c) => c.id === "giant-strength"));
    expect(belts).toHaveLength(6); expect(new Set(belts.map((d) => d.id)).size).toBe(6);
    expect(belts.map((d) => d.capabilities[0]!.effects[0]!).map((e) => e.kind === "bonus" ? e.value : 0)).toEqual([21,23,23,25,27,29]);
    for (const d of belts) {
      const c = character("Guerrero"); c.inventory = [item(d.name)]; c.abilities.strength = 10;
      const effect = d.capabilities[0]!.effects[0]!;
      expect(projectAbilityScore(c,"strength")).toBe(effect.kind === "bonus" ? effect.value : 0);
      c.abilities.strength = 30; expect(projectAbilityScore(c,"strength")).toBe(30);
      c.abilities.strength = 10; c.inventory[0]!.attuned = false; expect(projectAbilityScore(c,"strength")).toBe(10);
      const table = d.description.find((b) => b.type === "table");
      expect(table?.type === "table" ? table.rows : []).toContainEqual(["Gigante de piedra/escarcha","23","Muy raro"]);
    }
  });

  it("applies the drum only to bard spells, not another spell using the same Charisma score", () => {
    const c = character("Bardo"); c.inventory = [item("Tambor del creador de ritmos +1")];
    expect(projectSpellcasting(c,spell("builder:bard"))).toMatchObject({ attackModifier: 6, saveDc: 14 });
    expect(projectSpellcasting(c,spell("builder:warlock"))).toMatchObject({ attackModifier: 5, saveDc: 13 });
    expect(projectSpellcasting(c,spell("inventory:item"))).toMatchObject({ attackModifier: 5, saveDc: 13 });
    expect(projectSpellcasting(c)).toMatchObject({ attackModifier: 6, saveDc: 14 });
    c.inventory[0]!.attuned = false;
    expect(projectSpellcasting(c,spell("builder:bard"))).toMatchObject({ attackModifier: 5, saveDc: 13 });
  });

  it("does not grant an amulet bonus or allow attunement to an ineligible class", () => {
    const c = character("Mago"); c.inventory = [item("Amuleto del devoto +1")];
    expect(projectSpellcasting(c,spell("builder:wizard"))).toMatchObject({ attackModifier: 5, saveDc: 13 });
    c.inventory[0]!.attuned = false;
    expect(() => setInventoryItemAttuned(c,itemId,true,{ expectedRevision: c.revision, updatedAt: now })).toThrow(/clérigo|paladín/);
    c.identity.className = "Clérigo"; c.inventory[0]!.attuned = true;
    expect(projectSpellcasting(c,spell("builder:wizard"))).toMatchObject({ attackModifier: 6, saveDc: 14 });
  });

  it("tracks the daily property separately and recovers at confirmed dawn, not a rest", () => {
    let c = character("Bardo"); c.inventory = [item("Tambor del creador de ritmos +1")];
    c = useInventoryFeature(c,itemId,"daily-property",{ expectedRevision: c.revision, updatedAt: now });
    expect(c.inventory[0]!.charges?.current).toBe(0);
    expect(() => useInventoryFeature(c,itemId,"daily-property",{ expectedRevision: c.revision, updatedAt: now })).toThrow();
    expect(() => recoverInventoryItem(c,itemId,"long-rest",undefined,{ expectedRevision: c.revision, updatedAt: now })).toThrow(/evento/);
    c = recoverInventoryItem(c,itemId,"dawn",undefined,{ expectedRevision: c.revision, updatedAt: now });
    expect(c.inventory[0]!.charges?.current).toBe(1);
    expect(c.inventory[0]!.rules!.pending.join(" ")).toContain("reserva concreta de Inspiración");
  });

  it("keeps article corroboration separate from an unavailable full official Spanish text", () => {
    for (const d of definitions.filter((d) => d.sources.some((s) => s.id === "tasha-official-identification"))) {
      expect(d.review.identity).toBe(true); expect(d.review.editorial).toBe(false);
      expect(d.description.every((b) => b.provenance !== "official-spanish")).toBe(true);
      expect(d.sources.find((s) => s.id === "tasha-imported-spanish")?.verified).toBe(false);
    }
  });
});
