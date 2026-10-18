import { describe, it, expect } from "vitest";
import reviewed from "../../docs/v2/equipment-preparation-2026-10-17/used-equipment-reviewed-definitions.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { storeEquipmentSpell, castEquipmentStoredSpell } from "../../src/domain/equipment/equipment-spell-storage";
import { createCharacter } from "../../src/domain/character/create-character";
import { PHB_SPELLS } from "../../src/domain/character/phb-spells";
const time = "2026-10-18T12:00:00.000Z", itemId = "inv_11111111111111111111111111111111", spellId = "spl_11111111111111111111111111111111";
const setup = () => {
  const c = createCharacter("chr_11111111111111111111111111111111", "Portador", time);
  const definition = EquipmentDefinitionDraftSchema.parse(reviewed.find((d) => d.name === "Anillo de almacenamiento de conjuros"));
  c.inventory = [bindReviewedEquipment({ id: itemId, order: 0, group: "Mochila", name: definition.name, quantity: 1, unitWeight: 0, cost: { quantity: 0, unit: "gp" }, category: "ring", description: "", properties: [], equipped: true, attuned: false, requiresAttunement: true, usable: false, consumable: false, charges: { current: 5, maximum: 5, reset: "dawn" }, armor: null, weapon: null, bonuses: [], features: [], effect: { active: false, description: "" } }, definition)];
  c.inventory[0]!.rules!.storage = { known: true, spells: [] }; return c;
};
const options = (revision: number) => ({ expectedRevision: revision, updatedAt: time });
const loaded = { id: spellId, definition: PHB_SPELLS["haste"]!, slotLevel: 3, ability: "charisma" as const, saveDc: 17, attackBonus: 9, abilityModifier: 5, expenditureConfirmed: true };
describe("spell-storing equipment", () => {
  it("tracks spell levels rather than charges, requires a confirmed casting, and cannot overfill", () => {
    let c = setup(); expect(c.inventory[0]!.charges).toBeNull();
    expect(() => storeEquipmentSpell(c,itemId,{ ...loaded, expenditureConfirmed: false },options(c.revision))).toThrow("gastó");
    c = storeEquipmentSpell(c,itemId,loaded,options(c.revision));
    expect(c.inventory[0]!.rules!.storage!.spells[0]).toMatchObject({ slotLevel: 3, saveDc: 17, attackBonus: 9 });
    expect(() => storeEquipmentSpell(c,itemId,{ ...loaded, id: "spl_22222222222222222222222222222222" },options(c.revision))).toThrow("capacidad");
    expect(() => castEquipmentStoredSpell(c,itemId,spellId,options(c.revision))).toThrow("Sintonizá");
  });
  it("consumes the stored spell once and applies concentration without spending the bearer's slots", () => {
    let c = storeEquipmentSpell(setup(),itemId,loaded,options(0));
    c.inventory[0]!.attuned = true;
    const before = structuredClone(c.spellcasting.slots);
    c = castEquipmentStoredSpell(c,itemId,spellId,{ ...options(c.revision), concentrationCondition: { id: "cnd_11111111111111111111111111111111", key: "concentration", label: "Concentración", level: null, addedAt: time } });
    expect(c.inventory[0]!.rules!.storage!.spells).toEqual([]);
    expect(c.spellcasting.slots).toEqual(before); expect(c.spellcasting.spells).toEqual([]);
    expect(c.combat.conditions.some((s) => s.key === "concentration")).toBe(true);
    expect(c.inventory[0]!.features.some((f) => f.id.startsWith("stored:"))).toBe(false);
    expect(() => castEquipmentStoredSpell(c,itemId,spellId,options(c.revision))).toThrow("ya no");
  });
});
