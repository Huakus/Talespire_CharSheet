/** Prepare and validate the reviewed ECE migration. Never connects to or writes a database. */
import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const root = "tmp/spell-replacement";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const write = (name, data) => writeFileSync(`${root}/${name}`, typeof data === "string" ? data : JSON.stringify(data, null, 2));
mkdirSync(root, { recursive: true });
const snapshot = read(`${root}/snapshot-before.json`);
const previous = read("tmp/spell-cleanup/plan.json");
const uses = read("tmp/spell-cleanup/ece-used-spells-before.json");
const rows = read("tmp/spell-cleanup/ece-spells-after.json");
const guards = read("tmp/spell-cleanup/guards-after.json");
assert.equal(snapshot.used_hash, guards.used, "Refresh the character backup before preparing this migration");
assert.equal(snapshot.catalog_hash, guards.ece, "Refresh the catalog backup before preparing this migration");
const campaign = previous.campaignId;
assert.equal(campaign, snapshot.campaign.id);
const normalize = (name) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = new Map();
function alias(name, key) {
  const normalized = normalize(name);
  aliases.set(normalized, new Set([...(aliases.get(normalized) ?? []), key]));
}
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { SupabaseCampaignContentStore } = await server.ssrLoadModule("/src/infrastructure/remote/supabase-campaign-content-store.ts");
  const { CharacterSpellV2Schema } = await server.ssrLoadModule("/src/domain/character/character-spell-model.ts");
  const { migrateLegacyCharacterSpellClasses } = await server.ssrLoadModule("/src/infrastructure/persistence/legacy-spell-class-migration.ts");
  const { resolveLearnedSpell, isOldSpell, spellDefinitionSignature } = await server.ssrLoadModule("/src/domain/spells/spell-source.ts");
  const { localizedManagedSpell } = await server.ssrLoadModule("/src/ui/localized-spells.ts");
  const { PHB_SPELLS } = await server.ssrLoadModule("/src/domain/character/phb-spells.ts");
  const entries = rows.map((r) => ({ campaignId: r.campaign_id, kind: r.kind, contentKey: r.content_key, name: r.name, origin: r.origin, tags: r.tags, payload: r.payload, revision: r.revision, updatedAt: r.updated_at }));
  const content = await new SupabaseCampaignContentStore({ listCampaignContent: async () => entries }, campaign).load();
  const current = new Map(content.spells.filter((s) => !isOldSpell(s)).map((s) => [s.catalog.contentKey.split(":").at(-1), s]));
  for (const [key, spell] of current) { alias(key, key); alias(spell.name, key); }
  for (const spell of read("src/domain/character/phb-srd-spells.json")) alias(spell.name, spell.key);
  for (const [key, spell] of Object.entries(read("src/domain/character/spells-es-2014.json"))) { alias(spell.englishName, key); alias(spell.name, key); }
  for (const [key, names] of Object.entries(read("tmp/spell-audit/aliases.json"))) for (const name of names) alias(name, key);
  const oldRows = new Map(previous.old.map((s) => [s.content_key, s]));
  const byIdentity = new Map(uses.map((r) => [`${r.parent_id}:${r.entity_id}`, r]));
  const changes = [], pending = [], mapping = [];
  for (const resolution of previous.resolution.filter((r) => r.classification === "old")) {
    const old = oldRows.get(resolution.contentKey);
    const row = byIdentity.get(`${resolution.characterId}:${resolution.spellId}`);
    const original = CharacterSpellV2Schema.parse(migrateLegacyCharacterSpellClasses(row.payload));
    assert.ok(isOldSpell(resolveLearnedSpell(original, content.spells).definition));
    // The old level-six "Mal de ojo" is Eyebite, not the level-one Hex translation.
    let candidates = normalize(old.name) === "maldeojo" && old.payload.level === 6 ? ["eyebite"] : [...(aliases.get(normalize(old.name)) ?? [])];
    candidates = candidates.filter((key) => current.has(key) && current.get(key).level === old.payload.level);
    assert.ok(candidates.length <= 1, `Ambiguous identity: ${old.name}`);
    if (!candidates.length) { pending.push({ ...resolution, reason: old.payload.retainedDefinitionMissing ? "missing-definition" : "absent-from-active-catalog" }); continue; }
    const key = candidates[0], replacement = current.get(key);
    if (original.casting?.key) assert.equal(original.casting.key, key, `Casting identity differs: ${old.name}`);
    assert.equal(spellDefinitionSignature(replacement), spellDefinitionSignature(PHB_SPELLS[key]));
    const payload = { ...row.payload, name: replacement.name, level: replacement.level, definition: replacement };
    CharacterSpellV2Schema.parse(payload);
    const personal = ({ name: _n, level: _l, definition: _d, ...rest }) => rest;
    assert.deepEqual(personal(payload), personal(row.payload), "Personal spell state must be preserved exactly");
    const rendered = localizedManagedSpell(resolveLearnedSpell(CharacterSpellV2Schema.parse(payload), content.spells));
    assert.equal(isOldSpell(rendered.definition), false);
    assert.equal(rendered.definition.catalog.contentKey, replacement.catalog.contentKey);
    changes.push({ characterId: row.parent_id, spellId: row.entity_id, oldContentKey: resolution.contentKey, contentKey: replacement.catalog.contentKey, before: row, payload });
    mapping.push({ characterId: row.parent_id, spellId: row.entity_id, old_content_key: resolution.contentKey, content_key: replacement.catalog.contentKey });
  }
  assert.equal(changes.length, 273); assert.equal(pending.length, 2);
  assert.equal(new Set(changes.map((c) => c.oldContentKey)).size, 240);
  assert.deepEqual(pending.map((p) => p.name).sort(), ["Levantar maldición", "Púas plateadas"].sort());
  const definitions = [...new Map(changes.map((c) => [c.contentKey, c.payload.definition])).entries()].map(([content_key, definition]) => ({ content_key, definition }));
  const affected = new Set(changes.map((c) => c.characterId));
  assert.equal(affected.size, 10);
  const after = uses.map((row) => {
    const change = changes.find((c) => c.characterId === row.parent_id && c.spellId === row.entity_id);
    return change ? { ...row, payload: change.payload } : row;
  });
  const remaining = after.filter((r) => isOldSpell(resolveLearnedSpell(CharacterSpellV2Schema.parse(migrateLegacyCharacterSpellClasses(r.payload)), content.spells).definition));
  assert.equal(remaining.length, 2);
  const plan = { campaignId: campaign, counts: { replaced: changes.length, oldVersionsReplaced: 240, characters: affected.size, remaining: pending.length, learnedTotal: uses.length }, pending, changes };
  write("plan.json", plan);
  writeFileSync(`${root}/backup-before.json.gz`, gzipSync(JSON.stringify({ snapshot, uses, catalog: rows })));
  write("projected-spells-after.json", after);
  const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;
  const data = (value) => { const json = JSON.stringify(value), marker = `migration_${createHash("sha256").update(json).digest("hex").slice(0, 20)}`; assert.ok(!json.includes(`$${marker}$`)); return `$${marker}$${json}$${marker}$::jsonb`; };
  const hash = (table, where, order) => `(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
  const usedHash = hash("campaign_state_fragments", `campaign_id=${quote(campaign)} and fragment_kind='character-spell'`, "parent_id,entity_id");
  const catalogHash = hash("campaign_content_entries", `campaign_id=${quote(campaign)} and kind='spell'`, "content_key");
  const otherHash = hash("campaign_state_fragments", `campaign_id=${quote(campaign)} and fragment_kind<>'character-spell'`, "fragment_kind,parent_id,entity_id");
  let sql = `begin;
lock table public.campaigns, public.campaign_character_versions, public.campaign_state_fragments in share row exclusive mode;
lock table public.campaign_content_entries in share mode;
create temporary table _replacement_map on commit drop as select * from jsonb_to_recordset(${data(mapping)}) as x("characterId" text,"spellId" text,old_content_key text,content_key text);
create temporary table _replacement_definitions on commit drop as select * from jsonb_to_recordset(${data(definitions)}) as x(content_key text,definition jsonb);
create temporary table _before_spells on commit drop as select * from public.campaign_state_fragments where campaign_id=${quote(campaign)} and fragment_kind='character-spell';
create temporary table _before_versions on commit drop as select * from public.campaign_character_versions where campaign_id=${quote(campaign)};
do $replace$ declare affected integer; begin
if ${usedHash} <> ${quote(snapshot.used_hash)} or ${catalogHash} <> ${quote(snapshot.catalog_hash)} then raise exception 'SPELL_REPLACEMENT_CONFLICT:refresh-backups'; end if;
if (select state_revision from public.campaigns where id=${quote(campaign)}) <> ${snapshot.campaign.state_revision} then raise exception 'SPELL_REPLACEMENT_CONFLICT:campaign'; end if;
if exists (select 1 from _replacement_map m left join public.campaign_content_entries o on o.campaign_id=${quote(campaign)} and o.kind='spell' and o.content_key=m.old_content_key and o.deleted_at is null and o.tags=array['old']::text[] left join public.campaign_content_entries n on n.campaign_id=${quote(campaign)} and n.kind='spell' and n.content_key=m.content_key and n.deleted_at is null and n.tags && array['manual_jugador','xanathar']::text[] where o.content_key is null or n.content_key is null or o.payload->>'level'<>n.payload->>'level') then raise exception 'SPELL_REPLACEMENT_INVALID_TARGET'; end if;
update public.campaign_state_fragments s set payload=s.payload || jsonb_build_object('name',d.definition->'name','level',d.definition->'level','definition',d.definition), revision=s.revision+1,updated_at=statement_timestamp()
from _replacement_map m join _replacement_definitions d on d.content_key=m.content_key
where s.campaign_id=${quote(campaign)} and s.fragment_kind='character-spell' and s.parent_id=m."characterId" and s.entity_id=m."spellId";
get diagnostics affected=row_count;
if affected<>273 then raise exception 'SPELL_REPLACEMENT_COUNT:%',affected; end if;
if exists (select 1 from public.campaign_state_fragments s join _before_spells b using(campaign_id,fragment_kind,parent_id,entity_id) join _replacement_map m on m."characterId"=s.parent_id and m."spellId"=s.entity_id join _replacement_definitions d on d.content_key=m.content_key where s.payload <> b.payload || jsonb_build_object('name',d.definition->'name','level',d.definition->'level','definition',d.definition) or s.position<>b.position or s.revision<>b.revision+1 or (s.payload-array['name','level','definition'])<>(b.payload-array['name','level','definition'])) then raise exception 'SPELL_REPLACEMENT_PERSONAL_STATE_CHANGED'; end if;
if exists (select 1 from public.campaign_state_fragments s join _before_spells b using(campaign_id,fragment_kind,parent_id,entity_id) where not exists(select 1 from _replacement_map m where m."characterId"=s.parent_id and m."spellId"=s.entity_id) and to_jsonb(s)<>to_jsonb(b)) then raise exception 'SPELL_REPLACEMENT_UNRELATED_SPELL_CHANGED'; end if;
if (select count(*) from public.campaign_state_fragments where campaign_id=${quote(campaign)} and fragment_kind='character-spell')<>316 then raise exception 'SPELL_REPLACEMENT_LOST_ENTRY'; end if;
update public.campaign_character_versions v set revision=v.revision+1,updated_at=statement_timestamp() where v.campaign_id=${quote(campaign)} and exists(select 1 from _replacement_map m where m."characterId"=v.character_id);
get diagnostics affected=row_count;
if affected<>10 then raise exception 'SPELL_REPLACEMENT_CHARACTER_COUNT'; end if;
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${quote(campaign)};
if ${catalogHash}<>${quote(snapshot.catalog_hash)} or ${otherHash}<>${quote(snapshot.other_ece_hash)} then raise exception 'SPELL_REPLACEMENT_UNRELATED_DATA_CHANGED'; end if;
end $replace$;
commit;
select count(*) as learned_total,count(*) filter(where payload->'definition'->'catalog'->'tags' ? 'old') as explicit_old_tags,count(*) filter(where payload->'definition'->'catalog'->'tags' ? 'manual_jugador' or payload->'definition'->'catalog'->'tags' ? 'xanathar') as explicit_book_tags from public.campaign_state_fragments where campaign_id=${quote(campaign)} and fragment_kind='character-spell';
`;
  write("apply.sql", sql);
  const restore = changes.map((c) => ({ character_id: c.characterId, spell_id: c.spellId, before: c.before.payload, expected: c.payload }));
  // Restore payloads only if none of the migrated entries has subsequently changed.
  // Revisions continue increasing, so an open stale client cannot overwrite a rollback.
  write("rollback.sql", `begin;
lock table public.campaigns,public.campaign_character_versions,public.campaign_state_fragments in share row exclusive mode;
create temporary table _restore_spells on commit drop as select * from jsonb_to_recordset(${data(restore)}) as x(character_id text,spell_id text,before jsonb,expected jsonb);
do $restore$ declare affected integer; begin
if (select count(*) from _restore_spells r join public.campaign_state_fragments s on s.campaign_id=${quote(campaign)} and s.fragment_kind='character-spell' and s.parent_id=r.character_id and s.entity_id=r.spell_id and s.payload=r.expected)<>273 then raise exception 'SPELL_RESTORE_CONFLICT:subsequent-changes'; end if;
update public.campaign_state_fragments s set payload=r.before,revision=s.revision+1,updated_at=statement_timestamp() from _restore_spells r where s.campaign_id=${quote(campaign)} and s.fragment_kind='character-spell' and s.parent_id=r.character_id and s.entity_id=r.spell_id;
get diagnostics affected=row_count;
if affected<>273 then raise exception 'SPELL_RESTORE_COUNT'; end if;
update public.campaign_character_versions v set revision=v.revision+1,updated_at=statement_timestamp() where v.campaign_id=${quote(campaign)} and exists(select 1 from _restore_spells r where r.character_id=v.character_id);
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${quote(campaign)};
end $restore$;
commit;
`);
  const checksums = Object.fromEntries(["plan.json", "snapshot-before.json", "backup-before.json.gz", "projected-spells-after.json", "apply.sql", "rollback.sql"].map((file) => [file, createHash("sha256").update(readFileSync(`${root}/${file}`)).digest("hex")]));
  write("checksums.json", checksums);
  console.log(JSON.stringify({ ...plan.counts, pending: pending.map((p) => p.name), distinctTargets: definitions.length, sqlBytes: Buffer.byteLength(sql), validation: "schemas, active identities, UI resolution, all personal fields, unaffected spells" }));
} finally { await server.close(); }
