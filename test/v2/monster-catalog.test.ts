import { describe, expect, it } from "vitest";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";

describe("monster catalog", () => {
  it("normalizes database payloads into combat statistics and actions", () => {
    const monster = normalizeMonsterDefinition({
      id: "wolf",
      name: "Lobo",
      type: "Bestia",
      size: "Mediano",
      alignment: "Sin alineamiento",
      challenge: "1/4",
      hitPoints: 11,
      hitPointFormula: "2d8+2",
      armorClass: 13,
      initiativeModifier: 2,
      initiativeAdvantage: true,
      speed: ["40 pies"],
      abilities: { strength: 12, dexterity: 15 },
      actions: [{ name: "Mordisco", content: "Impacto: 7 (2d4+2) perforante.", usage: "" }],
    });
    expect(monster).toMatchObject({
      id: "wolf",
      hitPoints: 11,
      hitPointFormula: "2d8+2",
      armorClass: 13,
      initiativeModifier: 2,
      actions: [{ name: "Mordisco", content: expect.stringContaining("2d4+2") }],
    });
  });
});
