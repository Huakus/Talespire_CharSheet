import { describe, expect, it } from "vitest";
import { equipmentAutomationGaps, equipmentReviewPolicy, EQUIPMENT_CATALOG_DECISIONS } from "../../src/domain/equipment/equipment-policy";
import { equipmentCompletionIssues } from "../../src/domain/equipment/equipment-definition";
import { equipmentDraftExample, equipmentCapabilityExample } from "../fixtures/equipment-definition-drafts";

describe("agreed equipment catalog policy", () => {
  it("admits verified original 2014 sources without modifying character builder sources", () => {
    const draft = equipmentDraftExample();
    draft.sources.push({ id: "another-book", kind: "book", title: "Otra fuente existente", language: "en", rulesEdition: "2014", locator: null, verified: true });
    draft.sources.push({ id: "unverified", kind: "book", title: "Sin cotejar", language: "es", rulesEdition: "2014", locator: null, verified: false });
    draft.sources.push({ id: "unknown-edition", kind: "book", title: "Edición desconocida", language: "es", rulesEdition: null, locator: null, verified: true });
    const policy = equipmentReviewPolicy(draft);
    expect([...policy.allowedSourceIds]).toEqual(["test-source", "another-book"]);
    expect(policy.allowReviewedTranslations).toBe(true); expect(policy.allowAssistedEffects).toBe(true);
    expect(policy.formatSupported).toBe(false);
    expect(EQUIPMENT_CATALOG_DECISIONS.characterBuilderSources).toBe("unchanged");
    expect(EQUIPMENT_CATALOG_DECISIONS.umbralDagger).toBe("phase-blade-exclusive-to-stix-variant");
  });

  it("requires a visible assisted procedure and automation backlog even when assistance is permitted", () => {
    const draft = equipmentDraftExample();
    const capability = equipmentCapabilityExample();
    capability.execution = { mode: "assisted", handler: "test", explanation: "", pendingAutomation: [] };
    draft.capabilities = [capability];
    const handlers = new Map([["test", { mode: "assisted" as const, effectKinds: new Set(["narrative"]) }]]);
    expect(equipmentCompletionIssues(draft, equipmentReviewPolicy(draft, handlers, true)).join(" ")).toContain("asistencia debe explicar");
    capability.execution.explanation = "El GM confirma el resultado indicado.";
    capability.execution.pendingAutomation = ["Registrar el resultado sin intervención del GM."];
    expect(equipmentCompletionIssues(draft, equipmentReviewPolicy(draft, handlers, true)).join(" ")).not.toContain("asistencia debe explicar");
    expect(equipmentAutomationGaps(draft)).toEqual([{ capabilityId: "use", capabilityName: "Capacidad de prueba", description: "Registrar el resultado sin intervención del GM." }]);
  });

  it("exposes unmodeled and unsupported work and rejects automatic labels with pending automation", () => {
    const draft = equipmentDraftExample();
    const capability = equipmentCapabilityExample(); capability.execution.mode = "unsupported"; draft.capabilities = [capability];
    expect(equipmentAutomationGaps(draft)).toHaveLength(1);
    capability.execution = { mode: "automatic", handler: "test", explanation: "", pendingAutomation: ["Falta aplicar el efecto."] };
    expect(equipmentCompletionIssues(draft, equipmentReviewPolicy(draft)).join(" ")).toContain("automática no puede ocultar");
  });
});
