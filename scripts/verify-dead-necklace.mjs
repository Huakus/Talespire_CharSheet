/** Read-only validation of the exported live grant. No database access. */
import { readFileSync,writeFileSync } from "node:fs";
import { createServer } from "vite";
import assert from "node:assert/strict";
const root = "tmp/dead-necklace",read = (name) => JSON.parse(readFileSync(`${root}/${name}`,"utf8"));
const before = read("before.json"),after = read("after.json"),context = read("context.json"),plan = read("plan.json");
assert.equal(after.other_fragments_hash,context.other_fragments_hash);
assert.equal(after.catalog_hash,context.catalog_hash);
assert.equal(after.version.revision,before.version.revision+1);
assert.equal(after.campaign.state_revision,before.campaign.state_revision+1);
assert.equal(after.rows.length,before.rows.length+1);
for (const old of before.rows) {
  const row = after.rows.find((r) => r.entity_id === old.entity_id && r.fragment_kind === old.fragment_kind);
  assert.ok(row);
  assert.deepEqual(row.payload,old.entity_id === plan.spellId && old.fragment_kind === "character-spell" ? plan.payload : old.payload);
  assert.equal(row.revision,old.revision+(old.entity_id === plan.spellId && old.fragment_kind === "character-spell" ? 1 : 0));
  assert.equal(row.position,old.position);
}
assert.deepEqual(after.rows.find((r) => r.fragment_kind === "character-inventory" && r.entity_id === plan.itemId).payload,plan.item);
assert.deepEqual(after.catalog.payload,plan.catalog.payload);
assert.equal(after.catalog.revision,1);assert.equal(after.catalog.origin,"gm");assert.deepEqual(after.catalog.tags,["custom"]);
const server = await createServer({ configFile: false,root: process.cwd(),server: { middlewareMode: true },appType: "custom" });
try {
  const { CharacterV2Schema } = await server.ssrLoadModule("/src/domain/character/character-v2.ts");
  const { migrateLegacyCharacterSpellClasses: migrate } = await server.ssrLoadModule("/src/infrastructure/persistence/legacy-spell-class-migration.ts");
  const { castCharacterSpell } = await server.ssrLoadModule("/src/domain/character/character-spells.ts");
  const { itemSpellState } = await server.ssrLoadModule("/src/domain/character/item-spells.ts");
  const { spellReady } = await server.ssrLoadModule("/src/ui/wizard-play-panel.ts");
  const { applyCharacterResourceCommand } = await server.ssrLoadModule("/src/domain/character/character-resources.ts");
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { validateWizardBuild } = await server.ssrLoadModule("/src/domain/character/wizard-builder.ts");
  const one = (kind) => after.rows.find((r) => r.fragment_kind === kind)?.payload;
  const many = (kind) => after.rows.filter((r) => r.fragment_kind === kind).sort((a,b) => a.position-b.position).map((r) => r.payload);
  const runtime = one("character-runtime");
  const c = CharacterV2Schema.parse({ ...one("character-core"),...runtime,revision: after.version.revision,spellcasting: { ...runtime.spellcasting,spells: many("character-spell").map(migrate) },actions: many("character-action"),inventory: many("character-inventory"),traits: many("character-trait"),notes: many("character-note"),extras: many("character-extra"),metadata: { createdAt: after.version.created_at,updatedAt: after.version.updated_at } });
  validateWizardBuild(c.builder,c.spellcasting.wizard.copied);
  const spell = c.spellcasting.spells.find((s) => s.id === plan.spellId);
  assert.ok(itemSpellState(c,spell).available);assert.ok(spellReady(spell,c));
  assert.equal(c.spellcasting.spells.length,55);assert.equal(c.spellcasting.wizard.book.length,48);assert.equal(c.spellcasting.wizard.copied.length,24);
  assert.equal(c.spellcasting.spells.filter((s) => s.level > 0 && s.prepared && s.casting?.kind === "wizard").length,4);
  assert.equal(c.spellcasting.spells.filter((s) => s.casting?.key === "speak-with-dead").length,1);
  const now = new Date().toISOString(),spent = castCharacterSpell(c,spell.id,3,{ expectedRevision: c.revision,updatedAt: now });
  assert.equal(spent.inventory.find((i) => i.id === plan.itemId).charges.current,0);
  assert.deepEqual(spent.spellcasting.slots,c.spellcasting.slots);
  assert.equal(spellReady(spell,spent),false);
  const rested = applyCharacterResourceCommand(spent,{ kind: "long-rest" },{ expectedRevision: spent.revision,updatedAt: now }).character;
  assert.ok(itemSpellState(rested,spell).available);
  const r = after.catalog;
  const content = await new SupabaseCampaignContentStore({ listCampaignContent: async () => [{ campaignId: r.campaign_id,kind: r.kind,contentKey: r.content_key,name: r.name,origin: r.origin,tags: r.tags,payload: r.payload,revision: r.revision,updatedAt: r.updated_at }] },plan.campaignId).load();
  assert.equal(content.equipment.length,1);assert.equal(content.equipment[0].name,plan.item.name);assert.equal(content.equipment[0].rarity,"rare");
  const result = { item: plan.item.name,character: c.name,characterRevision: c.revision,campaignRevision: after.campaign.state_revision,equipped: true,attuned: true,charges: "1/1",recharge: "long-rest",spellOrigin: "item",spellAbility: "intelligence",wizardBookUnchanged: true,otherCharactersAndCampaignsUnchanged: true,priorCatalogUnchanged: true,validation: "live payloads, schemas, canonical spell, catalog load, UI readiness, offline cast and recharge",pending: [] };
  writeFileSync(`${root}/verification.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally { await server.close(); }
