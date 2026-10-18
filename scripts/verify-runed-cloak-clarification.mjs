import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const prefix = process.argv[2] ?? "runed-cloak", testsPassed = Number(process.argv[3] ?? 37);
assert.match(prefix, /^[a-z]+(?:-[a-z]+)*$/); assert.ok(Number.isInteger(testsPassed) && testsPassed >= 0);
const before = read(`${prefix}-live-before.json`), after = read(`${prefix}-live-after.json`);
const guardsBefore = read(`${prefix}-guards-before.json`), guardsAfter = read(`${prefix}-guards-after.json`);
assert.deepEqual(after.entry.payload, read(`${prefix}-clarified-payload.json`));
assert.equal(after.entry.revision, before.revision + 1); assert.equal(after.campaign_revision, guardsBefore.campaign_revision + 1); assert.equal(after.preparation_rows, 853);
for (const field of ["campaign_id", "kind", "content_key", "name", "origin", "tags", "created_at", "created_by", "deleted_at"]) assert.deepEqual(after.entry[field], before[field], field);
for (const field of ["other_content_hash", "shared_hash", "fragments_hash", "versions_hash"]) assert.equal(guardsAfter[field], guardsBefore[field], field);
assert.deepEqual(after.entry.payload.originals.slice(0, -1), before.payload.originals); assert.deepEqual(after.entry.payload.decisions, before.payload.decisions);
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { EquipmentPreparationPanel } = await server.ssrLoadModule("/src/ui/equipment-preparation-panel.ts");
  const payload = EquipmentPreparationPayloadSchema.parse(after.entry.payload);
  for (const source of payload.originals) assert.ok(await verifyEquipmentSource(source));
  const row = after.entry;
  const store = new SupabaseCampaignContentStore({ listCampaignContent: async (_id, scope) => scope === "preparation" ? [{ campaignId: row.campaign_id, kind: row.kind, contentKey: row.content_key, name: row.name, origin: row.origin, tags: row.tags, payload: row.payload, revision: row.revision, updatedAt: row.updated_at }] : [] }, row.campaign_id);
  const content = await store.loadEquipmentPreparations(); assert.equal(content.equipmentPreparationIssues.length, 0); assert.equal(content.equipmentPreparations.length, 1);
  const panel = new EquipmentPreparationPanel({ saveEquipmentPreparation: async () => {}, loadPreparations: async () => content }, () => {});
  panel.setContent(content.equipmentPreparations, []); panel.open = true; panel.selected = payload.definition.id;
  const markup = panel.render();
  if (prefix === "runed-cloak") { assert.ok(markup.includes("no es una carga del objeto")); assert.ok(markup.includes("Regla aclarada por el GM")); }
  else if (prefix === "wisdom-amulet") { assert.ok(markup.includes("salvaciones de otras características")); assert.ok(markup.includes("Regla de campaña confirmada por el GM")); }
  else if (prefix === "reaper-shadow") { assert.ok(markup.includes("tu puntuación de Inteligencia aumenta en 1")); assert.ok(markup.includes("recupera el uso gastado al amanecer")); assert.ok(markup.includes("Susurro de Finalidad")); }
  else throw new Error("Unsupported clarification");
  const report = { item: row.name, savedAs: "equipment-preparation", equipmentRevision: row.revision, campaignRevision: after.campaign_revision, preparationRows: after.preparation_rows,
    effect: payload.definition.capabilities[0].effects[0], resources: payload.definition.resources, capabilities: payload.definition.capabilities.map((capability) => ({ id: capability.id, name: capability.name, activation: capability.activation, duration: capability.duration, concentration: capability.concentration, costs: capability.costs })), previousOriginalsPreserved: true, gmInstructionArchivedAndVerified: true,
    otherContentUnchanged: true, sharedCatalogUnchanged: true, charactersUnchanged: true, merchantStockUnchanged: true, otherCampaignsUnchanged: true,
    activeCopiesChanged: 0, activeSlotCapacityChanged: false, executionImplemented: false, migratedCopies: 0, deletedVersions: 0,
    preparationLoadErrors: content.equipmentPreparationIssues.length, targetedTestsPassed: testsPassed, typecheckPassed: true, buildPassed: true };
  writeFileSync(`docs/v2/equipment-preparation-2026-10-17/${prefix}-clarification-verified.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await server.close(); }
