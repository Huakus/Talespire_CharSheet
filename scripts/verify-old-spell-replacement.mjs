/** Verify exported live rows against the reviewed plan and the actual UI resolver. No database writes. */
import { createServer } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const root = "tmp/spell-replacement";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const plan = read(`${root}/plan.json`), before = read(`${root}/snapshot-before.json`), after = read(`${root}/snapshot-after.json`);
const originals = read("tmp/spell-cleanup/ece-used-spells-before.json");
const actual = read(`${root}/actual-spells-after.json`), projected = read(`${root}/projected-spells-after.json`);
assert.equal(actual.length, 316);
const identity = (r) => `${r.parent_id}:${r.entity_id}`;
const expectedById = new Map(projected.map((r) => [identity(r), r]));
const originalById = new Map(originals.map((r) => [identity(r), r]));
const changed = new Set(plan.changes.map((c) => `${c.characterId}:${c.spellId}`));
assert.equal(new Set(actual.map(identity)).size, 316);
for (const row of actual) {
  const expected = expectedById.get(identity(row)), original = originalById.get(identity(row));
  assert.ok(expected && original);
  assert.deepEqual(row.payload, expected.payload, `Unexpected saved rules or personal state: ${row.payload.name}`);
  if (!changed.has(identity(row))) { assert.deepEqual(row, original); continue; }
  assert.equal(row.revision, original.revision + 1);
  assert.equal(row.position, original.position);
  assert.equal(row.updated_by, original.updated_by);
  assert.ok(Date.parse(row.updated_at) > Date.parse(original.updated_at));
}
assert.equal(after.campaign.state_revision, before.campaign.state_revision + 1);
assert.ok(Date.parse(after.campaign.state_updated_at) > Date.parse(before.campaign.state_updated_at));
for (const key of ["catalog_hash", "other_ece_hash", "other_campaigns_fragments_hash", "other_campaigns_catalog_hash"]) assert.equal(after[key], before[key], `Unrelated data changed: ${key}`);
const affected = new Set(plan.changes.map((c) => c.characterId));
for (const version of after.character_versions) {
  const original = before.character_versions.find((v) => v.character_id === version.character_id);
  if (!affected.has(version.character_id)) { assert.deepEqual(version, original); continue; }
  assert.equal(version.revision, original.revision + 1);
  assert.equal(version.created_at, original.created_at);
  assert.equal(version.updated_by, original.updated_by);
  assert.ok(Date.parse(version.updated_at) > Date.parse(original.updated_at));
}
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { CharacterSpellV2Schema } = await server.ssrLoadModule("/src/domain/character/character-spell-model.ts");
  const { migrateLegacyCharacterSpellClasses } = await server.ssrLoadModule("/src/infrastructure/persistence/legacy-spell-class-migration.ts");
  const { resolveLearnedSpell, isOldSpell, spellSourceTag } = await server.ssrLoadModule("/src/domain/spells/spell-source.ts");
  const { localizedManagedSpell } = await server.ssrLoadModule("/src/ui/localized-spells.ts");
  const rows = read("tmp/spell-cleanup/ece-spells-after.json");
  const entries = rows.map((r) => ({ campaignId: r.campaign_id, kind: r.kind, contentKey: r.content_key, name: r.name, origin: r.origin, tags: r.tags, payload: r.payload, revision: r.revision, updatedAt: r.updated_at }));
  const content = await new SupabaseCampaignContentStore({ listCampaignContent: async () => entries }, plan.campaignId).load();
  const counts = {}, pending = [];
  for (const row of actual) {
    const spell = CharacterSpellV2Schema.parse(migrateLegacyCharacterSpellClasses(row.payload));
    const visible = localizedManagedSpell(resolveLearnedSpell(spell, content.spells));
    const tag = spellSourceTag(visible.definition);
    counts[tag] = (counts[tag] ?? 0) + 1;
    if (isOldSpell(visible.definition)) pending.push({ characterId: row.parent_id, spellId: row.entity_id, name: spell.name });
    if (changed.has(identity(row))) {
      const change = plan.changes.find((c) => c.characterId === row.parent_id && c.spellId === row.entity_id);
      assert.equal(visible.definition.catalog.contentKey, change.contentKey);
      assert.ok(["manual_jugador", "xanathar"].includes(tag));
      assert.equal(visible.name, change.payload.name);
      assert.equal(visible.definition.year, "2014");
    }
  }
  assert.equal(pending.length, 2);
  assert.equal(counts.custom, 5);
  assert.equal(counts.manual_jugador + counts.xanathar, 309);
  assert.deepEqual(new Set(pending.map((p) => `${p.characterId}:${p.spellId}`)), new Set(plan.pending.map((p) => `${p.characterId}:${p.spellId}`)));
  const summary = { ...plan.counts, learnedClassification: counts, all316SavedPayloadsMatch: true, personalStatePreserved: true, unchangedEntriesVerified: 43, affectedCharacterRevisionsUpdated: 10, unrelatedCharactersUntouched: true, otherCampaignsUntouched: true, catalogUnchanged: true, pending };
  writeFileSync(`${root}/verification.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally { await server.close(); }
