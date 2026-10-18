import { describe, expect, it } from "vitest";
import clarified from "../../docs/v2/equipment-preparation-2026-10-17/runed-cloak-clarified-definition.json";
import decision from "../../src/domain/equipment/campaign-equipment-decisions.json";
import { EquipmentDefinitionDraftSchema, EquipmentEffectSchema, equipmentCompletionIssues } from "../../src/domain/equipment/equipment-definition";
import { equipmentReviewPolicy } from "../../src/domain/equipment/equipment-policy";

describe("GM clarification of the Runed Cloak", () => {
  it("models additional slot capacity with inherited recovery rather than an independent use", () => {
    const value = EquipmentDefinitionDraftSchema.parse(clarified);
    expect(value.requirements).toMatchObject({ attunement: false, presence: "worn" });
    expect(value.resources).toEqual([]);
    expect(value.capabilities).toHaveLength(1);
    expect(value.capabilities[0]).toMatchObject({ activation: "passive", costs: [], consumeQuantity: 0 });
    expect(value.capabilities[0]!.effects).toEqual([decision.runedCloak.effect]);
    expect(value.capabilities[0]!.effects[0]).toMatchObject({ kind: "spell-slot-capacity", level: 1, amount: 1, pool: "inherit", recovery: "inherit" });
  });

  it("rejects independent resets, current spending, cantrip slots and nonpositive capacity", () => {
    const effect = decision.runedCloak.effect;
    for (const invalid of [{ ...effect, recovery: "long-rest" }, { ...effect, current: 1 }, { ...effect, used: 0 }, { ...effect, level: 0 }, { ...effect, amount: 0 }, { ...effect, amount: -1 }]) expect(EquipmentEffectSchema.safeParse(invalid).success).toBe(false);
  });

  it("records the GM source but keeps execution blocked until the actual adapter exists", () => {
    const value = EquipmentDefinitionDraftSchema.parse(clarified);
    expect(value.sources.find((source) => source.id === decision.runedCloak.source.id)).toMatchObject({ kind: "campaign", verified: true });
    expect(value.review.mechanics).toBe(true);
    expect(value.review.information).toBe(false);
    expect(value.review.unresolved.join(" ")).not.toContain("no se define su recuperación");
    expect(value.capabilities[0]!.execution.mode).toBe("unsupported");
    expect(value.capabilities[0]!.execution.pendingAutomation.join(" ")).toContain("quitar, volver a poner o transferir");
    expect(equipmentCompletionIssues(value, equipmentReviewPolicy(value)).join(" ")).toContain("falta soporte de ejecución");
  });
});
