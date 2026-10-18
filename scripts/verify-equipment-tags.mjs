/** Verify full post-apply exports and protected DB checksums. Does not execute SQL. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/item-tags", out = "docs/v2/item-tags-2026-10-17";
const read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const load = (scope, after = false) => [0, 500, 1000, 1500].flatMap((offset) => read(`${scope}-${after ? "after-" : ""}${offset}.json`));
const plan = new Map(read("plan.json").map((change) => [`${change.scope}:${change.content_key}`, change]));
const beforeGuards = read("guards-before.json"), afterGuards = read("guards-after.json");
for (const key of ["protected_catalog_hash", "other_shared_hash", "protected_fragments_hash", "inventory_count"]) assert.equal(afterGuards[key], beforeGuards[key], key);
assert.equal(afterGuards.campaign.state_revision, beforeGuards.campaign.state_revision + 1);
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { visibleEquipmentTags } = await server.ssrLoadModule("/src/domain/equipment/equipment-tags.ts");
  const { equipmentRowLanguage } = await server.ssrLoadModule("/src/domain/equipment/classify-equipment.ts");
  const result = { tagsApplied: 0, payloadsChanged: 0, deleted: 0, scopes: {}, protectedHashesUnchanged: true, inventoryCount: afterGuards.inventory_count };
  for (const scope of ["shared", "ece"]) {
    const before = load(scope), after = load(scope, true), byKey = new Map(after.map((row) => [row.content_key, row]));
    assert.equal(before.length, after.length); assert.equal(byKey.size, before.length);
    for (const row of before) {
      const current = byKey.get(row.content_key); assert.ok(current);
      const change = plan.get(`${scope}:${row.content_key}`);
      assert.deepEqual(current.tags, change?.after ?? row.tags, row.content_key);
      if (change) result.tagsApplied++;
      const protectedRow = (value) => { const copy = { ...value }; delete copy.tags; if (scope === "ece") { delete copy.revision; delete copy.updated_at; } return copy; };
      assert.deepEqual(protectedRow(current), protectedRow(row), `Definition changed: ${row.content_key}`);
      if (scope === "ece") assert.equal(current.revision, row.revision + (change ? 1 : 0));
    }
    const entry = (row) => ({ campaignId: row.campaign_id, kind: row.kind, contentKey: row.content_key, name: row.name, origin: row.origin, tags: row.tags, payload: row.payload, revision: row.revision ?? 0, updatedAt: row.updated_at });
    const project = async (rows) => new SupabaseCampaignContentStore({ listCampaignContent: async () => rows.map(entry) }, "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd").load();
    const previous = await project(before), current = await project(after);
    assert.equal(previous.equipment.length, current.equipment.length);
    const oldDefinitions = new Map(previous.equipment.map((item) => [item.catalog.contentKey, item]));
    for (const item of current.equipment) {
      const { catalog: metadata, ...definition } = item;
      const { catalog: _oldMetadata, ...oldDefinition } = oldDefinitions.get(metadata.contentKey);
      assert.deepEqual(definition, oldDefinition);
      assert.ok(visibleEquipmentTags(metadata.tags).length > 0);
    }
    const spanish = after.filter((row) => equipmentRowLanguage(row) === "es");
    const tagCounts = Object.fromEntries([...new Set(spanish.flatMap((row) => visibleEquipmentTags(row.tags)))].sort().map((tag) => [tag, spanish.filter((row) => row.tags.includes(tag)).length]));
    result.scopes[scope] = { total: after.length, visibleSpanish: current.equipment.length, spanishTagCounts: tagCounts };
  }
  assert.equal(result.tagsApplied, plan.size);
  writeFileSync(`${out}/verificacion.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await server.close(); }
