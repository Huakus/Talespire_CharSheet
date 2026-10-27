import { describe, expect, it } from "vitest";
import { parseMonsterChecks, serializeMonsterChecks, monsterSavingThrow } from "../../src/domain/monsters/monster-checks";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { auditMonsterDefinition, monsterDiceExpressions } from "../../src/domain/monsters/monster-audit";
describe("standard monster checks and legacy rules", () => {
  it("normalizes Spanish ability keys before opening the editor, without replacing scores with ten", () => {
    const m = normalizeMonsterDefinition({ Name: "Aboleth", Abilities: { Fue: 21, Des: 9, Con: 15, Int: 18, Sab: 15, Car: 18 } });
    expect(m.abilities).toEqual({ Str: 21, Dex: 9, Con: 15, Int: 18, Wis: 15, Cha: 18 });
    expect(monsterSavingThrow(m, "strength")).toBe(5);
  });
  it("accepts Spanish, English, unsigned and negative bonuses without dropping unknown mechanics", () => {
    expect(parseMonsterChecks(["FUE +6, DEX -1", "Con 0", "Contra magia +4"], "saves")).toEqual({ bonuses: { strength: 6, dexterity: -1, constitution: 0 }, unparsed: ["Contra magia +4"] });
    const values = parseMonsterChecks(["Sleight of Hand +7", "Percepción 8", "Survival -2"], "skills");
    expect(parseMonsterChecks(serializeMonsterChecks(values.bonuses, values.unparsed, "skills"), "skills")).toEqual(values);
  });
  it("uses an explicit saving bonus rather than the ability modifier, preserving zero", () => {
    const m = normalizeMonsterDefinition({ Name: "Guardia", Abilities: { Str: 18, Sab: 14 }, Saves: ["Fuerza +0"] });
    expect(monsterSavingThrow(m, "strength")).toBe(0); expect(monsterSavingThrow(m, "wisdom")).toBe(2);
  });
  it("extracts an attack bonus without treating save DC or average damage as an attack", () => {
    expect(monsterDiceExpressions("Melee Weapon Attack: +7 to hit. Hit: 17 (3d8 + 4) damage. DC 15 Strength.")).toEqual(["1d20+7", "3d8+4"]);
    expect(monsterDiceExpressions("Ataque: 1d20+7 · Daño: 1d10+4")).toEqual(["1d20+7", "1d10+4"]);
    expect(monsterDiceExpressions("CD 15. Impacto: 17 (3d8 + 4)")).toEqual(["3d8+4"]);
  });
  it("flags fragmented text for review without silently rewriting homebrew", () => {
    const raw = { Name: "Caballero", AC: 17, HP: 85, Traits: [{ Name: "Corrección", Content: "Una vez por turno:" }, { Name: "Si falla, repite el ataque.", Content: "" }] };
    const before = JSON.stringify(raw), issues = auditMonsterDefinition(raw);
    expect(issues.some(i => i.code === "possible-split-paragraph")).toBe(true); expect(JSON.stringify(raw)).toBe(before);
  });
});
