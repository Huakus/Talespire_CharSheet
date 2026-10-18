import { describe, expect, it } from "vitest";
import data from "../../docs/v2/equipment-preparation-2026-10-17/arms-magic-reviewed-definitions.json";
import evidence from "../../docs/v2/equipment-preparation-2026-10-17/arms-magic-source-review.json";
import { EquipmentDefinitionDraftSchema, equipmentCompletionIssues } from "../../src/domain/equipment/equipment-definition";
import { equipmentReviewPolicy } from "../../src/domain/equipment/equipment-policy";
const definitions = data.map((d) => EquipmentDefinitionDraftSchema.parse(d));
const family = (name: string) => definitions.filter((d) => evidence.sourceChecks.some((s) => s.id === d.id && s.family === name));
describe("2014 magic weapon and armor families", () => {
  it("keeps the original fixed seven-point vicious damage rather than the SRD or 2024 dice", () => {
    const values = family("vicious"); expect(values.length).toBeGreaterThan(25);
    for (const value of values) {
      const capability = value.capabilities.find((c) => c.id === "vicious-natural-20")!;
      expect(capability.effects[0]).toMatchObject({ expression: "7", timing: "critical", damageType: value.weapon!.baseDamage[0]!.kind === "damage" ? value.weapon!.baseDamage[0]!.damageType : null });
      expect(capability.trigger).toContain("20 natural");
      expect(capability.effects[0]!.condition).toContain("no se duplica");
      expect(value.weapon).toMatchObject({ attackBonus: 0, damageBonus: 0 });
      expect(value).toMatchObject({ rarity: "rare", requirements: { attunement: false }, economy: { basePrice: null } });
      expect(value.description.find((b) => b.id === "vicious-source-difference")).toBeDefined();
    }
  });
  it("keeps adamantine critical protection separate from armor class or ordinary hit immunity", () => {
    const values = family("adamantine"); expect(values).toHaveLength(6);
    for (const value of values) {
      expect(value).toMatchObject({ category: "armor", rarity: "uncommon", requirements: { attunement: false, presence: "worn" }, armor: { armorClassBonus: 0 } });
      expect(["medium", "heavy"]).toContain(value.armor!.category);
      expect(value.capabilities[0]!.effects[0]).toMatchObject({ kind: "defense", target: "critical-hits", condition: expect.stringContaining("impactos normales") });
      expect(value.description.find((b) => b.id === "family-rule")).toMatchObject({ provenance: "official-spanish", text: expect.stringContaining("cualquier crítico") });
    }
  });
  it("requires attunement, ignition and a hit before flame tongue adds fire damage", () => {
    const values = family("flame-tongue"); expect(values).toHaveLength(2);
    for (const value of values) {
      expect(value).toMatchObject({ rarity: "rare", requirements: { attunement: true, presence: "held" }, weapon: { attackBonus: 0, damageBonus: 0 } });
      const toggle = value.capabilities.find((c) => c.id === "flaming-toggle")!, hit = value.capabilities.find((c) => c.id === "flaming-hit")!;
      expect(toggle.activation).toBe("bonus-action");
      expect(JSON.stringify(toggle.effects)).toContain("envainarla");
      expect(hit.effects[0]).toMatchObject({ expression: "2d6", damageType: "fire", timing: "on-hit", condition: expect.stringContaining("encendida") });
      expect(hit.requirements.attunement).toBe(true);
    }
  });
  it("retains source references and preserves explicit integration and recovery blockers", () => {
    for (const value of definitions) {
      expect(value.magical).toBe(true); expect(value.economy.basePrice).toBeNull();
      expect(value.review.information).toBe(false);
      const issues = equipmentCompletionIssues(value, equipmentReviewPolicy(value));
      expect(issues.join(" ")).toContain("falta soporte de ejecución");
      expect(issues.some((i) => /inexistente|repetidos/.test(i))).toBe(false);
    }
  });
});
