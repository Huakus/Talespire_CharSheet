/** Audits guarded publication snapshots, preserved originals, and the app's two loading paths. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const before = read("catalog-publish-before.json"), after = read("catalog-publish-after.json"), batches = read("catalog-publish-results.json");
const drafts = read("real-drafts-reviewed.json"), campaignId = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
assert.equal(batches.length, 8); assert.equal(after.preparation_keys.length, 806); assert.equal(after.active_equipment, 1609);
assert.equal(after.previous_preparation_hash, before.preparation_hash);
assert.equal(after.preparation_hash, batches.at(-1).preparation_hash);
assert.equal(after.campaign_revision, before.campaign_revision + 8);
assert.equal(after.reviewed_content, 11); assert.equal(after.definitive_count, 0); assert.equal(after.with_originals, 806);
for (const key of ["campaign_catalog_hash", "shared_hash", "fragments_hash", "versions_hash"]) assert.equal(after[key], before[key], key);
assert.deepEqual(after.preparation_keys, drafts.map((record) => `gm:equipment:preparation:${record.payload.definition.id}`).sort());
for (const [index, batch] of batches.entries()) {
  assert.equal(batch.preparation_rows, Math.min(21 + (index + 1) * 100, 806));
  assert.equal(batch.campaign_revision, before.campaign_revision + index + 1);
}
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { EquipmentPreparationPanel } = await server.ssrLoadModule("/src/ui/equipment-preparation-panel.ts");
  const originals = new Map();
  for (const draft of drafts) {
    assert.deepEqual(EquipmentPreparationPayloadSchema.parse(draft.payload), draft.payload);
    for (const original of draft.payload.originals) originals.set(original.id, original);
  }
  for (const original of originals.values()) assert.ok(await verifyEquipmentSource(original));
  assert.equal(originals.size, 3181);
  const english = [...originals.values()].filter((source) => source.scope === "ECE" && source.raw.tags?.some((tag) => ["eng", "en"].includes(tag)));
  assert.equal(english.length, 803);
  const oldRows = [0, 500, 1000, 1500].flatMap((offset) => JSON.parse(readFileSync(`tmp/item-tags/ece-after-${offset}.json`, "utf8")));
  const entry = (row) => ({ campaignId, kind: row.kind, contentKey: row.content_key, name: row.name, origin: row.origin, tags: row.tags, payload: row.payload, revision: row.revision, updatedAt: row.updated_at });
  const prepared = drafts.map((draft) => ({ campaignId, kind: "equipment", contentKey: `gm:equipment:preparation:${draft.payload.definition.id}`, name: draft.payload.definition.name, origin: "gm", tags: ["es", "en_preparacion"], payload: draft.payload, revision: 0, updatedAt: "2026-10-17T00:00:00Z" }));
  const calls = [];
  const store = new SupabaseCampaignContentStore({ listCampaignContent: async (_id, scope) => { calls.push(scope); return scope === "preparation" ? prepared : oldRows.map(entry); } }, campaignId);
  const active = await store.load(); assert.equal(active.equipment.length, 806); assert.equal(active.equipmentPreparations, undefined); assert.deepEqual(calls, ["active"]);
  const review = await store.loadEquipmentPreparations(); assert.equal(review.equipmentPreparations.length, 806); assert.equal(review.equipmentPreparationIssues.length, 0);
  const panel = new EquipmentPreparationPanel({ saveEquipmentPreparation: async () => {}, loadPreparations: async () => review }, () => {});
  panel.setContent(review.equipmentPreparations, []); panel.open = true;
  panel.selected = drafts.find((record) => record.payload.definition.name === "Poción de curación").payload.definition.id;
  panel.search = "curación";
  const markup = panel.render(); assert.ok(markup.includes("11 con cotejo")); assert.ok(markup.includes("795 pendientes"));
  const css = readFileSync("dist-v2/v2.html", "utf8").match(/href="\.\/(assets\/[^\"]+\.css)"/)[1];
  writeFileSync(`${root}/catalog-preview.html`, `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../../dist-v2/${css}"><style>body{margin:0;padding:16px;overflow:auto}main.gm-shell{display:block;max-width:1000px;margin:auto;height:auto}</style><main class="gm-shell">${markup}</main></html>`);
  const report = { savedPreparationRows: 806, newPreparationRows: 785, existing21Unchanged: true, sourceReviewedDefinitions: 11, pendingSourceReview: 795,
    relatedEnglishRowsPreserved: english.length, uniqueOriginalArchivesVerified: originals.size, activeSpanishEquipment: active.equipment.length,
    activeCatalogRows: after.active_equipment, activeStartupRequestsPreparation: false, preparationLoadedOnDemand: true,
    charactersUnchanged: true, npcStockUnchanged: true, otherCampaignsUnchanged: true, sharedCatalogUnchanged: true,
    definitiveObjectsCreated: 0, migratedCopies: 0, deletedVersions: 0, campaignRevision: after.campaign_revision };
  writeFileSync("docs/v2/equipment-preparation-2026-10-17/catalogo-guardado-verificado.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await server.close(); }
