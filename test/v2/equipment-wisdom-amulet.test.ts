import { describe, expect, it } from "vitest";
import clarified from "../../docs/v2/equipment-preparation-2026-10-17/wisdom-amulet-clarified-definition.json";
import decisions from "../../src/domain/equipment/campaign-equipment-decisions.json";
import { EquipmentDefinitionDraftSchema, equipmentCompletionIssues } from "../../src/domain/equipment/equipment-definition";
import { equipmentReviewPolicy } from "../../src/domain/equipment/equipment-policy";

describe("GM clarification of the Wisdom Amulet", () => {
  it("grants a flat bonus exclusively to Wisdom saving throws with the existing requirements", () => {
    const value = EquipmentDefinitionDraftSchema.parse(clarified);
    expect(value.requirements).toMatchObject({ attunement: true, presence: "worn" });
    expect(value.capabilities).toHaveLength(1);
    expect(value.capabilities[0]!.effects).toEqual([decisions.wisdomAmulet.effect]);
    expect(value.capabilities[0]!.effects[0]).toMatchObject({ kind: "bonus", target: "wisdom-saves", operation: "add", value: 1 });
    expect(value.resources).toEqual([]);
    expect(value.capabilities[0]).toMatchObject({ activation: "passive", costs: [], consumeQuantity: 0 });
  });

  it("identifies the approved campaign rule without certifying official origin or automatic execution", () => {
    const value = EquipmentDefinitionDraftSchema.parse(clarified);
    expect(value.origin).toBe("campaign");
    expect(value.sources.find((source) => source.id === decisions.wisdomAmulet.source.id)).toMatchObject({ kind: "campaign", verified: true });
    expect(value.review).toMatchObject({ identity: true, editorial: true, mechanics: true, information: false });
    expect(value.review.unresolved.join(" ")).not.toContain("no se elige una de las dos reglas");
    expect(value.capabilities[0]!.execution.mode).toBe("unsupported");
    expect(equipmentCompletionIssues(value, equipmentReviewPolicy(value)).join(" ")).toContain("falta soporte de ejecución");
  });
});
