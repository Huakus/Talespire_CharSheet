import type { EquipmentCompletionPolicy, EquipmentDefinitionDraft } from "./equipment-definition";

/** User decisions, 2026-10-17. This policy never expands character-builder sources. */
export const EQUIPMENT_CATALOG_DECISIONS = {
  existingOfficialItems: "validate-original-2014-rules",
  characterBuilderSources: "unchanged",
  missingSpanishText: "reviewed-translation-from-english",
  preferOfficialSpanishWhenAvailable: true,
  execution: "automatic-or-assisted-with-visible-backlog",
  umbralDagger: "phase-blade-exclusive-to-stix-variant",
} as const;

export function equipmentReviewPolicy(
  definition: EquipmentDefinitionDraft,
  handlers: EquipmentCompletionPolicy["handlers"] = new Map(),
  formatSupported = false,
): EquipmentCompletionPolicy {
  return {
    formatSupported, allowReviewedTranslations: true, allowAssistedEffects: true, handlers,
    allowedSourceIds: new Set(definition.sources.filter((source) => source.verified &&
      (source.kind === "campaign" || (["book", "srd"].includes(source.kind) && source.rulesEdition === "2014")),
    ).map((source) => source.id)),
  };
}

export interface EquipmentAutomationGap { capabilityId: string; capabilityName: string; description: string }
/** A public backlog, separate from correctness/review blockers. */
export function equipmentAutomationGaps(definition: EquipmentDefinitionDraft): EquipmentAutomationGap[] {
  return definition.capabilities.flatMap((capability) => {
    const notes = [...capability.execution.pendingAutomation];
    if (capability.execution.mode === "unsupported" && !notes.length) notes.push(capability.execution.explanation.trim() || "Falta implementar la ejecución de esta capacidad.");
    if (capability.effects.some((effect) => effect.kind === "unmodeled")) notes.push("Falta representar la mecánica conservada en el original.");
    if (capability.execution.mode === "assisted" && !notes.length) notes.push("Falta detallar qué pasos de esta capacidad siguen siendo asistidos.");
    return [...new Set(notes)].map((description) => ({ capabilityId: capability.id, capabilityName: capability.name, description }));
  });
}
