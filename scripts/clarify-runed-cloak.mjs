/** Apply the GM's explicit clarification to a separate preparation, preserving every old original. */
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
import assert from "node:assert/strict";
import decisions from "../src/domain/equipment/campaign-equipment-decisions.json" with { type: "json" };
import { reviewCampaignItem } from "./review-campaign-equipment-rules.mjs";
const root = "tmp/equipment-definitions";
const before = JSON.parse(readFileSync(`${root}/runed-cloak-live-before.json`, "utf8"));
const payload = structuredClone(before.payload), value = payload.definition;
const item = { index: "capa-con-runas", contentKey: "imported:equipment:legacy:ad2b2b095ece73a10323c150" };
assert.equal(value.id, `recovery:${item.contentKey}`);
const requirements = (attunement, presence = "possessed", bearer = []) => ({ attunement, presence, bearer, explanation: attunement ? "Requiere sintonización." : "No requiere sintonización." });
const capability = (definition, id, name, effects) => ({ id, name, activation: "passive", trigger: "", requirements: structuredClone(definition.requirements), target: "Portador", range: "", duration: "Mientras lleves puesta la capa.", concentration: false, costs: [], consumeQuantity: 0, effects, execution: { mode: "unsupported", handler: null, explanation: "Falta integrar la regla en el formato nuevo.", pendingAutomation: [] }, textBlockIds: definition.description.filter((block) => block.section === "rules").map((block) => block.id) });
const review = reviewCampaignItem({ value, item, payload, capability, requirements });
assert.ok(review); assert.deepEqual(review.notes, []);
value.sources = [...new Map(value.sources.map((source) => [source.id, source])).values()];
value.revision = before.payload.definition.revision + 1;
value.review = { ...value.review, identity: true, editorial: true, mechanics: true, information: false, unresolved: value.review.unresolved.filter((note) => !note.startsWith("La ranura adicional de nivel 1 está escrita,")) };
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { captureEquipmentSource, verifyEquipmentSource, assessEquipmentRecovery } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const instruction = await captureEquipmentSource("ECE-GM-clarification", "ece:gm:runed-cloak:additional-slot", new Date().toISOString(), { kind: "gm-rule-clarification", itemIndex: item.index, instruction: decisions.runedCloak.originalInstruction, interpretation: decisions.runedCloak.text });
  payload.originals.push(instruction); value.recoverySourceIds.push(instruction.id);
  assert.deepEqual(payload.originals.slice(0, -1), before.payload.originals);
  assert.deepEqual(EquipmentPreparationPayloadSchema.parse(payload), payload);
  for (const source of payload.originals) assert.ok(await verifyEquipmentSource(source));
  const coverage = await assessEquipmentRecovery(payload.originals, payload.decisions, new Map([[value.id, value]])); assert.deepEqual(coverage.issues, []);
  assert.equal(value.resources.length, 0); assert.equal(value.capabilities[0].effects[0].kind, "spell-slot-capacity");
} finally { await server.close(); }
writeFileSync(`${root}/runed-cloak-clarified-payload.json`, JSON.stringify(payload));
writeFileSync("docs/v2/equipment-preparation-2026-10-17/runed-cloak-clarified-definition.json", JSON.stringify(value, null, 2));
console.log(JSON.stringify({ item: value.name, effect: value.capabilities[0].effects[0], previousOriginals: before.payload.originals.length, preservedOriginals: payload.originals.length, activeCopiesChanged: 0, executed: false }));
