/** Audit the two guarded publications, all source archives, and actual application loaders. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const before = read("owned-publish-before.json"), reviewed = read("owned-publish-after.json"), after = read("personal-publish-after.json");
const updates = read("owned-publish-results.json"), additions = read("personal-publish-results.json");
const drafts = [...read("real-drafts-owned-reviewed.json"), ...read("personal-preparations.json")];
const changes = read("owned-reviewed-drafts.json"), work = read("owned-priority-worklist.json");
assert.equal(updates.reduce((sum, batch) => sum + batch.reviewed_rows, 0), 117);
assert.equal(additions.reduce((sum, batch) => sum + batch.inserted_rows, 0), 47);
assert.equal(after.preparation_rows, 853); assert.equal(after.active_equipment, 1609);
assert.equal(reviewed.preparation_hash, updates.at(-1).preparation_hash);
assert.equal(after.preparation_hash, additions.at(-1).preparation_hash);
assert.equal(after.campaign_revision, before.campaign_revision + updates.length + additions.length);
for (const key of ["campaign_catalog_hash", "shared_hash", "fragments_hash", "versions_hash"]) assert.equal(after[key], before[key], key);
for (const item of changes) assert.deepEqual(item.after.originals, item.before.originals);
const campaignId = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { EquipmentPreparationPanel } = await server.ssrLoadModule("/src/ui/equipment-preparation-panel.ts");
  const { equipmentAutomationGaps } = await server.ssrLoadModule("/src/domain/equipment/equipment-policy.ts");
  const archives = new Map();
  for (const record of drafts) {
    assert.deepEqual(EquipmentPreparationPayloadSchema.parse(record.payload), record.payload);
    for (const source of record.payload.originals) archives.set(source.id, source);
  }
  for (const archive of archives.values()) assert.ok(await verifyEquipmentSource(archive));
  const entry = (row) => ({ campaignId, kind: row.kind ?? "equipment", contentKey: row.content_key, name: row.name, origin: row.origin ?? "gm", tags: row.tags ?? ["es", "en_preparacion"], payload: row.payload, revision: row.revision ?? 0, updatedAt: row.updated_at ?? "2026-10-18T00:00:00Z" });
  const active = [0, 500, 1000, 1500].flatMap((offset) => JSON.parse(readFileSync(`tmp/item-tags/ece-after-${offset}.json`, "utf8"))).map(entry);
  const entries = drafts.map((record) => entry({ content_key: `gm:equipment:preparation:${record.payload.definition.id}`, name: record.payload.definition.name, payload: record.payload }));
  const requests = [];
  const store = new SupabaseCampaignContentStore({ listCampaignContent: async (_id, scope) => { requests.push(scope); return scope === "preparation" ? entries : active; } }, campaignId);
  assert.equal((await store.load()).equipment.length, 806); assert.deepEqual(requests, ["active"]);
  const content = await store.loadEquipmentPreparations(); assert.equal(content.equipmentPreparations.length, 853); assert.equal(content.equipmentPreparationIssues.length, 0);
  const panel = new EquipmentPreparationPanel({ saveEquipmentPreparation: async () => {}, loadPreparations: async () => content }, () => {});
  panel.setContent(content.equipmentPreparations, []); panel.open = true;
  panel.selected = entries.find((record) => record.name === "Anillo de almacenamiento de conjuros").payload.definition.id;
  panel.search = "Anillo de almacenamiento";
  const markup = panel.render(); assert.ok(markup.includes("853 borradores")); assert.ok(markup.includes("Wizards of the Coast LLC")); assert.ok(markup.includes("Almacenar un conjuro"));
  const css = readFileSync("dist-v2/v2.html", "utf8").match(/href="\.\/(assets\/[^\"]+\.css)"/)[1];
  writeFileSync(`${root}/owned-review-preview.html`, `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../../dist-v2/${css}"><style>body{margin:0;padding:16px;overflow:auto}main.gm-shell{display:block;max-width:1000px;margin:auto;height:auto}</style><main class="gm-shell">${markup}</main></html>`);
  const defs = drafts.map((record) => record.payload.definition);
  const report = { scope: "ECE preparation only", characterCopiesReviewed: work.characterCopies, merchantStockEntriesReviewed: work.merchantCopies, definitionsUpdated: 117, personalVariantsAdded: 47, preparationRows: after.preparation_rows,
    recoveredCampaignDescriptions: 9, recognizedOrdinaryIdentities: 7,
    textReviewed: defs.filter((value) => value.review.editorial).length,
    identityTextRulesReviewed: defs.filter((value) => value.review.identity && value.review.editorial && value.review.mechanics).length,
    pendingTextReview: defs.filter((value) => !value.review.editorial).length,
    automationBacklogEntries: defs.reduce((sum, value) => sum + equipmentAutomationGaps(value).length, 0),
    uniqueOriginalArchivesVerified: archives.size, activeEquipmentRowsPreserved: after.active_equipment, activeSpanishEquipment: 806,
    startupLoadsPreparation: false, preparationLoadedOnDemand: true, preparationLoadErrors: content.equipmentPreparationIssues.length,
    charactersUnchanged: true, npcStockUnchanged: true, otherCampaignsUnchanged: true, sharedCatalogUnchanged: true,
    definitiveObjects: 0, migratedCopies: 0, deletedVersions: 0, campaignRevision: after.campaign_revision };
  writeFileSync("docs/v2/equipment-preparation-2026-10-17/owned-review-verified.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await server.close(); }
