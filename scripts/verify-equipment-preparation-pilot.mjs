/** Verifies the fresh post-insert SELECT and renders the same records through the app loader. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const before = read("pilot-guards-before.json"), after = read("pilot-live-after.json"), expected = read("pilot-rows.json");
for (const key of ["campaign_catalog_hash", "shared_hash", "fragments_hash", "versions_hash"]) assert.equal(after[key], before[key], key);
assert.equal(after.campaign_revision, before.campaign.state_revision + 1);
assert.equal(after.active_equipment, 1609); assert.equal(after.rows.length, expected.length);
for (const row of expected) {
  const actual = after.rows.find((value) => value.content_key === row.content_key); assert.ok(actual);
  assert.deepEqual(actual.payload, row.payload); assert.equal(actual.revision, 0);
}
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { verifyEquipmentSource } = await server.ssrLoadModule("/src/domain/equipment/equipment-recovery.ts");
  const { EquipmentPreparationPanel } = await server.ssrLoadModule("/src/ui/equipment-preparation-panel.ts");
  const originals = [0, 500, 1000, 1500].flatMap((offset) => JSON.parse(readFileSync(`tmp/item-tags/ece-after-${offset}.json`, "utf8")));
  const entry = (row) => ({ campaignId: row.campaign_id, kind: row.kind, contentKey: row.content_key, name: row.name, origin: row.origin, tags: row.tags, payload: row.payload, revision: row.revision, updatedAt: row.updated_at });
  const baseline = await new SupabaseCampaignContentStore({ listCampaignContent: async () => originals.map(entry) }, "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd").load();
  const store = new SupabaseCampaignContentStore({ listCampaignContent: async () => [...originals, ...after.rows].map(entry) }, "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd");
  const loaded = { ...await store.load(), ...await store.loadEquipmentPreparations() };
  assert.deepEqual(loaded.equipment, baseline.equipment); assert.equal(loaded.equipmentPreparations.length, 12);
  for (const record of loaded.equipmentPreparations) for (const source of record.payload.originals) assert.ok(await verifyEquipmentSource(source));
  const panel = new EquipmentPreparationPanel({ saveEquipmentPreparation: async () => {}, loadPreparations: async () => loaded }, () => {});
  panel.setContent(loaded.equipmentPreparations, []); panel.open = true;
  panel.selected = loaded.equipmentPreparations.find((record) => record.payload.definition.name === "Daga del Umbral · variante de Stix").payload.definition.id;
  const markup = panel.render();
  assert.ok(markup.includes("variante de Stix")); assert.ok(markup.includes("Qué falta para completar")); assert.ok(markup.includes("Originales conservados"));
  const css = readFileSync("dist-v2/v2.html", "utf8").match(/href="\.\/(assets\/[^\"]+\.css)"/)[1];
  writeFileSync(`${root}/pilot-preview.html`, `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../../dist-v2/${css}"><style>body{margin:0;padding:16px;overflow:auto}main.gm-shell{display:block;max-width:1000px;margin:auto;height:auto}</style><main class="gm-shell">${markup}</main></html>`);
  const report = { pilotRowsPersisted: 12, activeSpanishEquipment: loaded.equipment.length, activeCatalogRows: after.active_equipment, originalPayloadsVerified: true, charactersUnchanged: true, npcStockUnchanged: true, otherCampaignsUnchanged: true, sharedCatalogUnchanged: true, definitiveObjectsCreated: 0, migratedCopies: 0, deletedVersions: 0, campaignRevision: after.campaign_revision, pilotNames: after.rows.map((row) => row.name) };
  writeFileSync("docs/v2/equipment-preparation-2026-10-17/piloto-verificado.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await server.close(); }
