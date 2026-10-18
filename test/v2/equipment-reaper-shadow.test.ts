import { describe, expect, it } from "vitest";
import clarified from "../../docs/v2/equipment-preparation-2026-10-17/reaper-shadow-clarified-definition.json";
import decisions from "../../src/domain/equipment/campaign-equipment-decisions.json";
import { EquipmentDefinitionDraftSchema, equipmentCompletionIssues } from "../../src/domain/equipment/equipment-definition";
import { equipmentReviewPolicy } from "../../src/domain/equipment/equipment-policy";

const definition = () => EquipmentDefinitionDraftSchema.parse(clarified);
describe("GM clarification of Reaper Shadow", () => {
  it("retains INT +1 as an attribute bonus and keeps the authored bodily-contact requirement", () => {
    const value = definition();
    expect(value.origin).toBe("campaign");
    expect(value.capabilities.find((capability) => capability.id === "intelligence-bonus")!.effects).toEqual([decisions.reaperShadow.intelligenceEffect]);
    expect(value.requirements).toMatchObject({ attunement: true, presence: "other" });
    expect(value.requirements.explanation).toContain("contacto con el cuerpo");
    expect(value.sources.find((source) => source.id === decisions.reaperShadow.source.id)).toMatchObject({ kind: "campaign", verified: true });
    expect(value.review.unresolved.join(" ")).not.toContain("INT +1 no aparece");
  });

  it("uses a single dawn-restored mark and spends it only when marking the target", () => {
    const value = definition(), mark = value.capabilities.find((capability) => capability.id === "nearness-mark")!;
    expect(value.resources).toHaveLength(1);
    expect(value.resources[0]).toMatchObject({ id: "marca", maximum: 1, recovery: { kind: "event", event: "dawn", amount: { kind: "full" } } });
    expect(mark).toMatchObject({ activation: "bonus-action", range: "30 pies (9 m)", duration: "Hasta 1 minuto", concentration: true, costs: [{ resourceId: "marca", amount: 1 }] });
    expect(value.capabilities.filter((capability) => capability.costs.length)).toEqual([mark]);
    const damage = mark.effects.find((effect) => effect.kind === "damage")!;
    expect(damage).toMatchObject({ expression: "2d6", damageType: "necrotic", timing: "other" });
    expect(damage.condition).toContain("primera vez");
    expect(damage.condition).toContain("no al activarla ni en cada turno");
  });

  it("keeps the four named powers and their penalties separate from the dawn recharge", () => {
    const value = definition();
    expect(value.capabilities.map((capability) => capability.id)).toEqual(["intelligence-bonus", "veil-of-penumbra", "nearness-mark", "lingering-presence", "whisper-of-finality"]);
    const veil = value.capabilities.find((capability) => capability.id === "veil-of-penumbra")!;
    expect(veil.effects[0]!.condition).toContain("inmóvil");
    const presence = value.capabilities.find((capability) => capability.id === "lingering-presence")!;
    expect(presence.trigger).toContain("15 pies");
    const whisper = value.capabilities.find((capability) => capability.id === "whisper-of-finality")!;
    expect(whisper.duration).toContain("próximo descanso largo");
    expect(whisper.concentration).toBe(false);
    expect(whisper.effects[0]).toMatchObject({ kind: "defense", defense: "disadvantage", target: "death-saving-throws" });
    expect(whisper.execution.pendingAutomation.join(" ")).toContain("aunque llegue un amanecer o termine la marca");
    expect(JSON.stringify(whisper.effects)).toContain("Sabiduría CD 10");
    for (const capability of value.capabilities) for (const id of capability.textBlockIds) expect(value.description.some((block) => block.id === id)).toBe(true);
  });

  it("cleans display markup while retaining the full rule text and explicit execution blockers", () => {
    const value = definition();
    expect(value.description.some((block) => block.type === "list" && block.items.some((text) => text.includes("salvación contra la muerte")))).toBe(true);
    for (const block of value.description) if (block.type === "paragraph") expect(block.text).not.toMatch(/^###|\*\*/);
    expect(value.review.information).toBe(false);
    expect(value.review.mechanics).toBe(false);
    expect(value.capabilities.every((capability) => capability.execution.mode === "unsupported")).toBe(true);
    expect(equipmentCompletionIssues(value, equipmentReviewPolicy(value)).join(" ")).toContain("falta soporte de ejecución");
  });
});
