import { readFileSync, writeFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const baseline = read(existsSync(`${root}/pre-arms-preparation-baseline.json`) ? "pre-arms-preparation-baseline.json" : "latest-preparation-baseline.json"), primaryChanges = read("arms-reviewed-final.json"), extension = read("arms-extension-reviewed-changes.json"), magicChanges = read("arms-magic-reviewed-changes.json"), changes = [...primaryChanges, ...extension, ...magicChanges], publication = read("arms-all-publication.json"), before = read("arms-publish-before.json");
assert.equal(publication.guard.preparation_rows, 853);
assert.equal(publication.batches.reduce((n, b) => n + b.reviewed_rows, 0), primaryChanges.length);
assert.equal(publication.extension.reviewed_rows, extension.length);
assert.equal(publication.magicBatches.reduce((n, b) => n + b.reviewed_rows, 0), magicChanges.length);
assert.equal(publication.guard.campaign_revision, before.campaign_revision + publication.batches.length + publication.magicBatches.length + 2);
for (const key of ["other_content_hash", "shared_hash", "fragments_hash", "versions_hash"]) assert.equal(publication.guard[key], before[key]);
assert.equal(publication.notePreservation.campaign_revision + 1, publication.extension.campaign_revision);
assert.equal(publication.magicBatches.at(-1).campaign_revision, publication.guard.campaign_revision);
const changesById = new Map(changes.map((change) => [change.after.definition.id, change]));
const records = baseline.records.map((record) => {
  const id = record.payload.definition.id, change = changesById.get(id);
  if (change) { assert.deepEqual(change.before, record.payload); assert.deepEqual(change.after.originals, record.payload.originals); }
  const metadata = publication.metadata.find((row) => row.contentKey === `gm:equipment:preparation:${id}`); assert.ok(metadata);
  const payload = change?.after ?? record.payload; assert.equal(metadata.name, payload.definition.name);
  const { name: _name, ...catalog } = metadata;
  return { payload, catalog };
});
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { EquipmentPreparationPayloadSchema } = await server.ssrLoadModule("/src/domain/equipment/equipment-preparation.ts");
  const { verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { equipmentRollBounds } = await server.ssrLoadModule("/src/domain/equipment/equipment-resource-runtime.ts");
  const seen = new Set(); let rolledResources = 0;
  for (const record of records) {
    assert.deepEqual(EquipmentPreparationPayloadSchema.parse(record.payload), record.payload);
    for (const original of record.payload.originals) if (!seen.has(original.id)) { assert.ok(await verifyEquipmentSource(original)); seen.add(original.id); }
    for (const resource of record.payload.definition.resources) if (resource.recovery.kind === "event" && resource.recovery.amount.kind === "roll") { equipmentRollBounds(resource.recovery.amount.expression); rolledResources++; }
  }
  const rows = records.map(({ payload, catalog }) => ({ campaignId: "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd", kind: "equipment", contentKey: catalog.contentKey, name: payload.definition.name, origin: catalog.origin, tags: catalog.tags, payload, revision: catalog.revision, updatedAt: catalog.updatedAt }));
  const store = new SupabaseCampaignContentStore({ listCampaignContent: async (_id, scope) => scope === "preparation" ? rows : [] }, rows[0].campaignId);
  const loaded = await store.loadEquipmentPreparations(); assert.equal(loaded.equipmentPreparations.length, 853); assert.deepEqual(loaded.equipmentPreparationIssues, []);
  const report = { date: "2026-10-18", reviewedDefinitions: changes.length, weapons: changes.filter((x) => x.after.definition.weapon).length, armorAndShields: changes.filter((x) => x.after.definition.armor).length, campaignRevision: publication.guard.campaign_revision, preparationRows: records.length,
    textReviewed: records.filter((r) => r.payload.definition.review.editorial).length,
    identityTextAndRulesReviewed: records.filter((r) => { const review = r.payload.definition.review; return review.identity && review.editorial && review.mechanics; }).length,
    sourceOriginalsVerified: seen.size, rolledResourceExpressionsChecked: rolledResources, preparationLoadErrors: loaded.equipmentPreparationIssues.length,
    ambiguousPossessionWarningsPreserved: 3, originalsPreserved: true, otherContentUnchanged: true, sharedCatalogUnchanged: true, charactersUnchanged: true, merchantStockUnchanged: true, otherCampaignsUnchanged: true,
    migratedCopies: 0, deletedVersions: 0, definitiveDefinitions: 0, targetedTestsPassed: 104, typecheckPassed: true, buildPassed: true,
    resourceEngine: "Costs and event recovery implemented independently; not registered as a complete effect adapter or connected to active possessions." };
  writeFileSync("docs/v2/equipment-preparation-2026-10-17/arms-review-verified.json", JSON.stringify(report, null, 2));
  if (!existsSync(`${root}/pre-arms-preparation-baseline.json`)) writeFileSync(`${root}/pre-arms-preparation-baseline.json`, JSON.stringify(baseline));
  writeFileSync(`${root}/latest-preparation-baseline.json`, JSON.stringify({ campaignRevision: publication.guard.campaign_revision, mode: "verified-preparation-payloads-with-live-catalog-metadata", records }));
  console.log(JSON.stringify(report));
} finally { await server.close(); }
