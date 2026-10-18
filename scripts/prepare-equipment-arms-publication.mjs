/** Generate guarded preparation-only updates; never executes SQL. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions", read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const prefix = process.argv[2] ?? "arms";
assert.match(prefix, /^[a-z]+(?:-[a-z]+)*$/);
const changes = read(`${prefix}-reviewed-changes.json`), before = read(`${prefix}-publish-before.json`);
assert.equal(before.preparation_rows, 853);
const campaignId = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const json = (v) => { const text = JSON.stringify(v), tag = "arms_" + createHash("sha256").update(text).digest("hex").slice(0, 20); assert.ok(!text.includes(`$${tag}$`)); return `$${tag}$${text}$${tag}$::jsonb`; };
const scope = `campaign_id=${q(campaignId)} and kind='equipment' and ((payload->>'format') is not distinct from 'equipment-preparation')`;
const hash = (table, where, order) => `(select md5(string_agg(md5(to_jsonb(t)::text),'' order by ${order})) from public.${table} t where ${where})`;
const hashes = {
  other_content_hash: hash("campaign_content_entries", `not (${scope})`, "campaign_id,kind,content_key"),
  shared_hash: hash("official_content_entries", "true", "kind,content_key"),
  fragments_hash: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  versions_hash: hash("campaign_character_versions", "true", "campaign_id,character_id"),
};
const guard = Object.entries(hashes).map(([key, sql]) => `if ${sql} is distinct from ${q(before[key])} then raise exception ${q(`ARMS_CONFLICT:${key}`)}; end if;`).join("\n");
const rows = changes.map(({ before: old, after }) => {
  assert.deepEqual(after.originals, old.originals); assert.equal(after.definition.revision, old.definition.revision + 1);
  return { content_key: `gm:equipment:preparation:${after.definition.id}`, expected_definition: old.definition, expected_decisions: old.decisions, definition: after.definition, decisions: after.decisions };
});
assert.equal(new Set(rows.map((r) => r.content_key)).size, rows.length);
const batches = []; let batch = [];
for (const row of rows) { if (batch.length && JSON.stringify([...batch, row]).length > 245000) { batches.push(batch); batch = []; } batch.push(row); } if (batch.length) batches.push(batch);
mkdirSync(`${root}/${prefix}-review-batches`, { recursive: true });
const files = batches.map((batch, index) => {
  const sql = `begin;
lock table public.campaigns,public.campaign_content_entries in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
create temporary table _arms on commit drop as select * from jsonb_to_recordset(${json(batch)}) as x(content_key text,expected_definition jsonb,expected_decisions jsonb,definition jsonb,decisions jsonb);
create temporary table _arms_before on commit drop as select to_jsonb(t) as row from public.campaign_content_entries t where ${scope};
do $review$ declare affected integer; begin
${guard}
if (select state_revision from public.campaigns where id=${q(campaignId)}) is distinct from __CAMPAIGN_REVISION__ then raise exception 'ARMS_CAMPAIGN_CHANGED'; end if;
if ${hash("campaign_content_entries", scope, "content_key")} is distinct from '__PREPARATION_HASH__' then raise exception 'ARMS_PREPARATION_CHANGED'; end if;
if (select count(*) from public.campaign_content_entries t join _arms p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.deleted_at is null and t.payload->>'format'='equipment-preparation' and t.payload->'definition'=p.expected_definition and t.payload->'decisions'=p.expected_decisions)<>${batch.length} then raise exception 'ARMS_BASELINE_MISMATCH'; end if;
update public.campaign_content_entries t set name=p.definition->>'name',payload=jsonb_set(jsonb_set(t.payload,'{definition}',p.definition),'{decisions}',p.decisions),revision=t.revision+1,updated_at=statement_timestamp() from _arms p where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.content_key=p.content_key;
get diagnostics affected=row_count; if affected<>${batch.length} then raise exception 'ARMS_COUNT'; end if;
if (select count(*) from public.campaign_content_entries t join _arms p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.payload->'definition'=p.definition and t.payload->'decisions'=p.decisions and t.name=p.definition->>'name')<>${batch.length} then raise exception 'ARMS_DATA'; end if;
if exists(select 1 from public.campaign_content_entries t join _arms_before b on b.row->>'content_key'=t.content_key where t.campaign_id=${q(campaignId)} and t.kind='equipment' and case when exists(select 1 from _arms p where p.content_key=t.content_key) then (to_jsonb(t)-'name'-'revision'-'updated_at'-'payload') is distinct from (b.row-'name'-'revision'-'updated_at'-'payload') or (t.payload-'definition'-'decisions') is distinct from ((b.row->'payload')-'definition'-'decisions') or t.revision<>(b.row->>'revision')::bigint+1 else to_jsonb(t) is distinct from b.row end) then raise exception 'ARMS_UNEXPECTED_CHANGE'; end if;
if (select count(*) from public.campaign_content_entries where ${scope})<>853 then raise exception 'ARMS_SCOPE'; end if;
${guard}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaignId)};
end $review$;
select jsonb_build_object('reviewed_rows',${batch.length},'preparation_hash',${hash("campaign_content_entries", scope, "content_key")},'campaign_revision',(select state_revision from public.campaigns where id=${q(campaignId)})) as result;
commit;
`;
  const file = `${root}/${prefix}-review-batches/batch-${index}.sql`; writeFileSync(file, sql);
  return { file, rows: batch.length, characters: sql.length };
});
writeFileSync(`${root}/${prefix}-publish-manifest.json`, JSON.stringify({ rows: rows.length, batches: files }, null, 2));
console.log(JSON.stringify({ rows: rows.length, batches: files.map((f) => ({ rows: f.rows, characters: f.characters })) }));
