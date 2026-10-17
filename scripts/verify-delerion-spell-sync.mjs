/** Read-only verification of the exported live update. */
import { createServer } from "vite";
import { readFileSync,writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const root = "tmp/delerion-spell-sync", read = (name) => JSON.parse(readFileSync(`${root}/${name}`,"utf8"));
const before = read("snapshot-before.json"), after = read("snapshot-after.json"), plan = read("plan.json");
const originalRows = read("fragments-before.json").filter((r) => r.parent_id === plan.targetId);
assert.equal(after.other_fragments_hash,before.other_fragments_hash);
assert.equal(after.catalog_hash,before.catalog_hash);
assert.equal(after.version.revision,before.versions.find((v) => v.character_id === plan.targetId).revision+1);
assert.equal(after.campaign.state_revision,before.campaign.state_revision+1);
assert.equal(after.rows.length,originalRows.length+22);
for (const row of originalRows) {
  const actual = after.rows.find((r) => r.fragment_kind === row.fragment_kind && r.entity_id === row.entity_id);
  const change = plan.changes.find((c) => c.before.fragment_kind === row.fragment_kind && c.before.entity_id === row.entity_id);
  assert.deepEqual(actual.payload,change?.payload ?? row.payload);
  assert.equal(actual.position,row.position);
  assert.equal(actual.revision,row.revision+(change ? 1 : 0));
}
for (const added of plan.added) {
  const actual = after.rows.find((r) => r.fragment_kind === added.fragment_kind && r.entity_id === added.entity_id);
  assert.deepEqual(actual.payload,added.payload);
  assert.equal(actual.position,added.position);
  assert.equal(actual.revision,1);
}
const server = await createServer({ configFile: false,root: process.cwd(),server: { middlewareMode: true },appType: "custom" });
try {
  const { CharacterV2Schema } = await server.ssrLoadModule("/src/domain/character/character-v2.ts");
  const { migrateLegacyCharacterSpellClasses: migrate } = await server.ssrLoadModule("/src/infrastructure/persistence/legacy-spell-class-migration.ts");
  const { validateWizardBuild,advanceGuidedWizard } = await server.ssrLoadModule("/src/domain/character/wizard-builder.ts");
  const { completeWizardChoice } = await server.ssrLoadModule("/test/fixtures/phb-wizard-builder.ts");
  const { projectCharacterProgression } = await server.ssrLoadModule("/src/domain/character/character-progression.ts");
  const { spellPersonalInfo } = await server.ssrLoadModule("/src/ui/spell-casting-filters.ts");
  const one = (kind) => after.rows.find((r) => r.fragment_kind === kind)?.payload;
  const many = (kind) => after.rows.filter((r) => r.fragment_kind === kind).sort((a,b) => a.position-b.position).map((r) => r.payload);
  const runtime = one("character-runtime");
  const c = CharacterV2Schema.parse({ ...one("character-core"),...runtime,revision: after.version.revision,spellcasting: { ...runtime.spellcasting,spells: many("character-spell").map(migrate) },actions: many("character-action"),inventory: many("character-inventory"),traits: many("character-trait"),notes: many("character-note"),extras: many("character-extra"),metadata: { createdAt: after.version.created_at,updatedAt: after.version.updated_at } });
  validateWizardBuild(c.builder,c.spellcasting.wizard.copied);
  assert.equal(new Set(c.spellcasting.spells.map((s) => s.id)).size,55);
  assert.equal(c.spellcasting.wizard.book.length,48);
  assert.equal(c.spellcasting.wizard.copied.length,24);
  const progression = await projectCharacterProgression(c);
  assert.equal(progression.levels[9].studies.length,24);
  for (const copy of c.spellcasting.wizard.copied) {
    const spell = c.spellcasting.spells.find((s) => s.casting?.key === copy.key);
    assert.equal(spellPersonalInfo(c,spell).learning,"external-book");
    assert.equal(spell.casting.ability,"intelligence");
  }
  const next = await advanceGuidedWizard(c,completeWizardChoice(c,"necromancy"),"2026-10-17T03:00:00.000Z");
  assert.equal(next.spellcasting.wizard.copied.length,24);
  assert.equal(next.spellcasting.spells.length,57);
  const result = { ...plan.counts,characterRevision: c.revision,campaignRevision: after.campaign.state_revision,unchangedOtherCharactersAndCampaigns: true,unchangedCatalog: true,pending: plan.pending,validation: "exact payloads, revisions, live schemas, copy provenance, progression and next level" };
  writeFileSync(`${root}/verification.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await server.close(); }
