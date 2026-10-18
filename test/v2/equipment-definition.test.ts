import { describe, expect, it } from "vitest";
import { EquipmentDefinitionDraftSchema, equipmentCompletionIssues, parseEquipmentDefinitionDraft, serializeEquipmentDefinitionDraft, type EquipmentCompletionPolicy } from "../../src/domain/equipment/equipment-definition";
import { equipmentDraftExample, equipmentDraftExamples, equipmentCapabilityExample } from "../fixtures/equipment-definition-drafts";

const policy: EquipmentCompletionPolicy = { formatSupported: true, allowReviewedTranslations: true, allowAssistedEffects: true, allowedSourceIds: new Set(["test-source"]), handlers: new Map() };
const reviewed = () => {
  const value = equipmentDraftExample();
  value.review = { identity: true, information: true, editorial: true, mechanics: true, unresolved: [] };
  return value;
};

describe("equipment definition preparation format", () => {
  it("distinguishes an explicitly harmless weapon from an unknown or contradictory damage profile", () => {
    const value = equipmentDraftExamples()[1]!;
    value.weapon!.baseDamage = [];
    expect(equipmentCompletionIssues(value, policy).join(" ")).toContain("Falta el daño base");
    value.weapon!.damageMode = "none"; value.weapon!.damageBonus = 0;
    expect(equipmentCompletionIssues(value, policy).join(" ")).not.toContain("Falta el daño base");
    value.weapon!.damageBonus = 1;
    expect(equipmentCompletionIssues(value, policy).join(" ")).toContain("Un arma sin daño");
  });
  it("preserves concentration determined by the stored spell rather than disabling it", () => {
    const value = equipmentDraftExample();
    const capability = equipmentCapabilityExample();
    capability.concentration = "spell-dependent";
    value.capabilities = [capability];
    expect(parseEquipmentDefinitionDraft(serializeEquipmentDefinitionDraft(value)).capabilities[0]!.concentration).toBe("spell-dependent");
    expect(EquipmentDefinitionDraftSchema.safeParse({ ...value, capabilities: [{ ...capability, concentration: "unknown" }] }).success).toBe(false);
  });
  it("round-trips seven representative examples with complete structure and exact text", () => {
    for (const value of equipmentDraftExamples()) {
      expect(parseEquipmentDefinitionDraft(serializeEquipmentDefinitionDraft(value))).toEqual(value);
      expect(equipmentCompletionIssues(value, policy).length).toBeGreaterThan(0);
    }
    expect(parseEquipmentDefinitionDraft(serializeEquipmentDefinitionDraft(equipmentDraftExample())).description[0]).toMatchObject({ text: "  Texto conservado con espacios y saltos.\nSegundo párrafo del ejemplo.  " });
  });

  it("rejects undeclared fields rather than silently deleting useful information", () => {
    expect(() => serializeEquipmentDefinitionDraft({ ...equipmentDraftExample(), forgottenRule: "Información que no debe perderse" })).toThrow();
    const value = equipmentDraftExample();
    expect(() => serializeEquipmentDefinitionDraft({ ...value, economy: { ...value.economy, legacyPrice: 50 } })).toThrow();
  });

  it("keeps instance state out of definitions", () => {
    expect(EquipmentDefinitionDraftSchema.safeParse({ ...equipmentDraftExample(), equipped: true, quantity: 5 }).success).toBe(false);
    const value = equipmentDraftExamples()[3]!;
    expect(EquipmentDefinitionDraftSchema.safeParse({ ...value, resources: [{ ...value.resources[0], current: 2 }] }).success).toBe(false);
  });

  it("distinguishes unknown values, explicit false, zero price and unknown price", () => {
    const value = reviewed();
    expect(value.economy.basePrice).toBeNull();
    expect(equipmentCompletionIssues(value, policy)).toEqual([]);
    value.economy.basePrice = { quantity: 0, unit: "gp" };
    expect(parseEquipmentDefinitionDraft(serializeEquipmentDefinitionDraft(value)).economy.basePrice?.quantity).toBe(0);
    value.magical = null;
    expect(equipmentCompletionIssues(value, policy).join(" ")).toContain("Faltan datos");
  });

  it("blocks completion before integration even if the content author marks every review done", () => {
    expect(equipmentCompletionIssues(reviewed(), { ...policy, formatSupported: false }).join(" ")).toContain("integrado");
  });

  it("does not turn a translation into verified official Spanish", () => {
    const value = reviewed();
    value.sources[0] = { ...value.sources[0]!, kind: "book", language: "en" };
    value.description[0]!.provenance = "official-spanish";
    expect(equipmentCompletionIssues(value, policy).join(" ")).toContain("fuente española oficial");
    value.description[0]!.provenance = "reviewed-translation";
    expect(equipmentCompletionIssues(value, { ...policy, allowReviewedTranslations: false }).join(" ")).toContain("traducción");
    expect(equipmentCompletionIssues(value, policy)).toEqual([]);
  });

  it("requires an actual compatible registered handler for automatic or assisted effects", () => {
    const value = reviewed();
    const capability = equipmentCapabilityExample();
    capability.effects = [{ id: "heal", kind: "healing", expression: "1d4", target: "portador", condition: "" }];
    capability.execution = { mode: "automatic", handler: "healing", explanation: "" , pendingAutomation: [] };
    value.capabilities = [capability];
    expect(equipmentCompletionIssues(value, policy).join(" ")).toContain("adaptador");
    const handlers = new Map([["healing", { mode: "automatic" as const, effectKinds: new Set(["healing"]) }]]);
    expect(equipmentCompletionIssues(value, { ...policy, handlers })).toEqual([]);
    capability.execution.mode = "assisted";
    capability.execution.explanation = "El jugador confirma la aplicación al objetivo.";
    capability.execution.pendingAutomation = ["Aplicar la curación directamente al objetivo."];
    const assisted = new Map([["healing", { mode: "assisted" as const, effectKinds: new Set(["healing"]) }]]);
    expect(equipmentCompletionIssues(value, { ...policy, handlers: assisted, allowAssistedEffects: false }).join(" ")).toContain("automatización");
    capability.execution = { mode: "narrative", handler: null, explanation: "Resolver a mano" , pendingAutomation: [] };
    expect(equipmentCompletionIssues(value, policy).join(" ")).toContain("no aplica efectos de ficha");
  });

  it("validates links, unique identifiers, tables and individual damage expressions", () => {
    const value = equipmentDraftExamples()[4]!;
    value.capabilities[0]!.costs[0]!.resourceId = "missing";
    value.capabilities[0]!.textBlockIds = ["missing"];
    value.sources.push(value.sources[0]!);
    const issues = equipmentCompletionIssues(value, policy).join(" ");
    expect(issues).toContain("repetidos"); expect(issues).toContain("recurso de coste inexistente"); expect(issues).toContain("texto de reglas inexistente");
    const custom = equipmentDraftExamples()[6]!;
    const table = custom.description.find((block) => block.type === "table")!;
    if (table.type === "table") table.rows[0] = ["Falta una columna"];
    expect(() => serializeEquipmentDefinitionDraft(custom)).toThrow();
    const weapon = equipmentDraftExamples()[1]!;
    if (weapon.weapon?.baseDamage[0]?.kind === "damage") weapon.weapon.baseDamage[0].expression = "1d8/2d6";
    expect(() => serializeEquipmentDefinitionDraft(weapon)).toThrow();
  });

  it("preserves an unmodeled rule but refuses to certify it as complete", () => {
    const value = equipmentDraftExamples()[6]!;
    value.review = reviewed().review;
    expect(equipmentCompletionIssues(value, policy).join(" ")).toContain("mecánica aún sin representar");
    expect(parseEquipmentDefinitionDraft(serializeEquipmentDefinitionDraft(value)).capabilities[0]!.effects[0]).toMatchObject({ original: { specialRule: { limit: null, active: false } } });
  });

  it("blocks impossible costs and narrative operations that would silently omit consumption", () => {
    const value = equipmentDraftExamples()[3]!;
    value.review = reviewed().review;
    value.capabilities[0]!.costs.push({ resourceId: "reserve", amount: 3 });
    const issues = equipmentCompletionIssues(value, policy).join(" ");
    expect(issues).toContain("coste supera");
    expect(issues).toContain("consumo de recursos necesita un adaptador");
  });
});
