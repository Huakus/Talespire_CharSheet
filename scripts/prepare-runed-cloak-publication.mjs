/** Generate a one-row guarded update; no active catalog or instance writes. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const prefix = process.argv[2] ?? "runed-cloak";
assert.match(prefix, /^[a-z]+(?:-[a-z]+)*$/);
const row = read(`${prefix}-live-before.json`), payload = read(`${prefix}-clarified-payload.json`), guard = read(`${prefix}-guards-before.json`);
const q = (text) => `'${String(text).replaceAll("'", "''")}'`;
const json = (value) => { const text = JSON.stringify(value), tag = "cloak_" + createHash("sha256").update(text).digest("hex").slice(0, 24); assert.ok(!text.includes(`$${tag}$`)); return `$${tag}$${text}$${tag}$::jsonb`; };
const target = `campaign_id=${q(row.campaign_id)} and kind='equipment' and content_key=${q(row.content_key)}`;
const hash = (table, where, order) => `(select md5(string_agg(md5(to_jsonb(t)::text),'' order by ${order})) from public.${table} t where ${where})`;
const hashes = {
  other_content_hash: hash("campaign_content_entries", `not (${target})`, "campaign_id,kind,content_key"),
  shared_hash: hash("official_content_entries", "true", "kind,content_key"),
  fragments_hash: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  versions_hash: hash("campaign_character_versions", "true", "campaign_id,character_id"),
};
const guards = Object.entries(hashes).map(([key, sql]) => `if ${sql} is distinct from ${q(guard[key])} then raise exception ${q(`CLOAK_CLARIFICATION_CONFLICT:${key}`)}; end if;`).join("\n");
assert.equal(payload.definition.id, row.payload.definition.id); assert.deepEqual(payload.originals.slice(0, -1), row.payload.originals);
assert.equal(payload.originals.length, row.payload.originals.length + 1); assert.equal(payload.definition.revision, row.payload.definition.revision + 1);
const scope = `campaign_id=${q(row.campaign_id)} and kind='equipment' and ((payload->>'format') is not distinct from 'equipment-preparation')`;
const sql = `begin;
lock table public.campaigns,public.campaign_content_entries in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
do $clarification$ declare affected integer; begin
${guards}
if (select state_revision from public.campaigns where id=${q(row.campaign_id)}) is distinct from ${guard.campaign_revision} then raise exception 'CLOAK_CLARIFICATION_CAMPAIGN_CHANGED'; end if;
if (select to_jsonb(t) from public.campaign_content_entries t where ${target}) is distinct from ${json(row)} then raise exception 'CLOAK_CLARIFICATION_PREPARATION_CHANGED'; end if;
if (select count(*) from public.campaign_content_entries where ${scope})<>853 then raise exception 'CLOAK_CLARIFICATION_SCOPE_CHANGED'; end if;
update public.campaign_content_entries set payload=${json(payload)},revision=revision+1,updated_at=statement_timestamp() where ${target};
get diagnostics affected=row_count; if affected<>1 then raise exception 'CLOAK_CLARIFICATION_COUNT'; end if;
if (select payload from public.campaign_content_entries where ${target}) is distinct from ${json(payload)} then raise exception 'CLOAK_CLARIFICATION_DATA'; end if;
${guards}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(row.campaign_id)};
end $clarification$;
select jsonb_build_object('entry',(select to_jsonb(t) from public.campaign_content_entries t where ${target}),'campaign_revision',(select state_revision from public.campaigns where id=${q(row.campaign_id)}),'preparation_rows',(select count(*) from public.campaign_content_entries where ${scope})) as result;
commit;
`;
writeFileSync(`${root}/${prefix}-apply.sql`, sql); writeFileSync(`${root}/${prefix}-dry-run.sql`, sql.replace(/commit;\s*$/, "rollback;"));
console.log(JSON.stringify({ changes: 1, activeCopiesChanged: 0, sqlCharacters: sql.length, executed: false }));
