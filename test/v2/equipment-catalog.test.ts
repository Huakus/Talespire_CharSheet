import { describe, expect, it } from "vitest";
import { createCharacter } from "../../src/domain/character/create-character";
import {
  projectAdjustedRollMode,
  projectCharacterStatistics,
  projectInventory,
} from "../../src/domain/character/character-projection";
import { equipmentRarityLabel, normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";

describe("equipment catalog and bonuses", () => {
  it("normalizes rarity into a selectable catalog value", () => {
    expect(normalizeEquipmentDefinition({ name: "Reliquia", rarity: { index: "very-rare" } }).rarity).toBe("very-rare");
    expect(normalizeEquipmentDefinition({ name: "Reliquia", rarity: { index: "raro" } }).rarity).toBe("rare");
    expect(normalizeEquipmentDefinition({ name: "Reliquia", rarity: { name: "Muy Raro" } }).rarity).toBe("very-rare");
    expect(equipmentRarityLabel("uncommon")).toBe("Poco común");
  });
  it("applies active bonuses from normalized equipment", () => {
    const cloak = normalizeEquipmentDefinition({
      name: "Cloak of Protection", requiresAttunement: true,
      bonuses: [
        { category: "saves", key: "All", value: 1 },
        { category: "combatStats", key: "AC", value: 1 },
      ],
    });

    const base = createCharacter(
      "chr_11111111111111111111111111111111",
      "Hero",
      "2026-07-25T18:00:00.000Z",
    );
    const character = {
      ...base,
      inventory: [{
        ...cloak,
        id: "inv_22222222222222222222222222222222",
        order: 0,
        group: "equipment",
        equipped: true,
        attuned: true,
      }],
    };
    expect(projectCharacterStatistics(character).savingThrows.strength).toBe(1);
    expect(projectInventory(character).calculatedArmorClass).toBe(11);
  });

  it("combines matching item advantage and disadvantage", () => {
    const base = createCharacter(
      "chr_33333333333333333333333333333333",
      "Hero",
      "2026-07-25T18:00:00.000Z",
    );
    const definition = normalizeEquipmentDefinition({ name: "Dagger", category: "weapon" });
    const character = {
      ...base,
      inventory: [{
        ...definition,
        id: "inv_44444444444444444444444444444444",
        order: 0,
        group: "equipment",
        equipped: true,
        bonuses: [{ category: "skills", key: "Perception", value: 0, advantage: true, disadvantage: false }],
      }],
    };
    expect(projectAdjustedRollMode(character, "skills", ["Perception"], "normal")).toBe("advantage");
  });

  it("applies condition roll modes and cancels opposing advantage", () => {
    const base = createCharacter(
      "chr_55555555555555555555555555555555",
      "Hero",
      "2026-07-25T18:00:00.000Z",
    );
    const poisoned = {
      ...base,
      combat: {
        ...base.combat,
        conditions: [{
          id: "con_66666666666666666666666666666666",
          key: "poisoned",
          label: "Envenenado",
          level: null,
          addedAt: "2026-07-25T18:00:00.000Z",
        }],
      },
    };
    expect(projectAdjustedRollMode(poisoned, "skills", ["Perception"], "normal")).toBe("disadvantage");
    expect(projectAdjustedRollMode(poisoned, "skills", ["Perception"], "advantage")).toBe("normal");
  });
});
