/** Archive confirmed campaign decisions and preserve the conflicting originals. */
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
import assert from "node:assert/strict";
import decisions from "../src/domain/equipment/campaign-equipment-decisions.json" with { type: "json" };
import { reviewCampaignItem } from "./review-campaign-equipment-rules.mjs";
const root = "tmp/equipment-definitions", prefix = process.argv[2] ?? "wisdom-amulet";
const configurations = {
  "wisdom-amulet": { index: "amulet-of-wisdom", contentKey: "official:equipment:es:9b9bc630f8db9ca7d472176a", decision: "wisdomAmulet", archiveKey: "ece:gm:wisdom-amulet:saving-throws", oldNote: "Identidad oficial no acreditada. El campo indica WIS +1" },
  "reaper-shadow": { index: "sombra-del-segador", contentKey: "imported:equipment:legacy:7464ea9038f8df5a37722aca", decision: "reaperShadow", archiveKey: "ece:gm:reaper-shadow:intelligence-and-dawn", oldNote: "El campo INT +1 no aparece en la descripción." },
};
assert.ok(Object.hasOwn(configurations, prefix), "Unsupported clarification");
const item = configurations[prefix], decision = decisions[item.decision];
const before = JSON.parse(readFileSync(`${root}/${prefix}-live-before.json`, "utf8"));
const payload = structuredClone(before.payload), value = payload.definition;
assert.equal(value.id, `recovery:${item.contentKey}`);
assert.equal(value.revision, 1, "Reconcile an already revised definition instead of overwriting it");
const requirements = (attunement, presence = "possessed", bearer = []) => ({ attunement, presence, bearer, explanation: attunement ? "Requiere sintonización." : "No requiere sintonización." });
const capability = (definition, id, name, effects, extra = {}) => ({ id, name, activation: "passive", trigger: "", requirements: structuredClone(definition.requirements), target: "Portador", range: "", duration: "Mientras se cumplan equipo y sintonización.", concentration: false, costs: [], consumeQuantity: 0, effects: effects.map((effect, index) => ({ id: `${id}-${index}`, condition: "", ...effect })), execution: { mode: "unsupported", handler: null, explanation: "Falta integrar la regla en el formato nuevo.", pendingAutomation: [] }, textBlockIds: definition.description.filter((block) => block.section === "rules").map((block) => block.id), ...extra });
const effect = (kind, rest) => ({ kind, condition: "", ...rest });
const resource = (id, maximum, recovery) => ({ id, name: "Marca de la Cercanía", kind: "uses", maximum, unit: "usos", recovery, exhaustion: "No puedes activar la marca sin un uso disponible." });
const review = reviewCampaignItem({ value, item, payload, capability, requirements, effect, resource });
assert.ok(review); assert.deepEqual(review.notes, []);
value.sources = [...new Map(value.sources.map((source) => [source.id, source])).values()];
value.revision = before.payload.definition.revision + 1;
value.review = { ...value.review, identity: true, editorial: true, mechanics: !value.capabilities.some((capability) => capability.effects.some((effect) => effect.kind === "unmodeled")), information: false, unresolved: value.review.unresolved.filter((note) => !note.startsWith(item.oldNote)) };
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { captureEquipmentSource, verifyEquipmentSource, assessEquipmentRecovery } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const instruction = await captureEquipmentSource("ECE-GM-clarification", item.archiveKey, new Date().toISOString(), { kind: "gm-rule-clarification", itemIndex: item.index, instruction: decision.originalInstruction, interpretation: decision.text });
  payload.originals.push(instruction); value.recoverySourceIds.push(instruction.id);
  assert.deepEqual(payload.originals.slice(0, -1), before.payload.originals);
  assert.deepEqual(EquipmentPreparationPayloadSchema.parse(payload), payload);
  for (const source of payload.originals) assert.ok(await verifyEquipmentSource(source));
  const coverage = await assessEquipmentRecovery(payload.originals, payload.decisions, new Map([[value.id, value]])); assert.deepEqual(coverage.issues, []);
  assert.deepEqual(value.capabilities[0].effects, [decision.effect ?? decision.intelligenceEffect]);
  assert.equal(value.requirements.attunement, true);
} finally { await server.close(); }
writeFileSync(`${root}/${prefix}-clarified-payload.json`, JSON.stringify(payload));
writeFileSync(`docs/v2/equipment-preparation-2026-10-17/${prefix}-clarified-definition.json`, JSON.stringify(value, null, 2));
console.log(JSON.stringify({ item: value.name, origin: value.origin, effect: value.capabilities[0].effects[0], resources: value.resources, capabilities: value.capabilities.length, previousOriginals: before.payload.originals.length, preservedOriginals: payload.originals.length, executed: false }));
