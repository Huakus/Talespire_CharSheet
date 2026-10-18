/** Generates additive SQL only. Execution and guard substitution are separate. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions", read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const before = read("owned-publish-after.json"), records = read("personal-preparations.json");
const campaign = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
const q = (text) => `'${String(text).replaceAll("'", "''")}'`;
const json = (value) => { const text = JSON.stringify(value), tag = "personal_" + createHash("sha256").update(text).digest("hex").slice(0, 24); assert.ok(!text.includes(`$${tag}$`)); return `$${tag}$${text}$${tag}$::jsonb`; };
const scope = `campaign_id=${q(campaign)} and kind='equipment' and ((payload->>'format') is not distinct from 'equipment-preparation')`;
const hash = (table, where, order) => `(select md5(string_agg(md5(to_jsonb(t)::text),'' order by ${order})) from public.${table} t where ${where})`;
const hashes = {
  campaign_catalog_hash: hash("campaign_content_entries", `not (${scope})`, "campaign_id,kind,content_key"),
  shared_hash: hash("official_content_entries", "true", "kind,content_key"),
  fragments_hash: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  versions_hash: hash("campaign_character_versions", "true", "campaign_id,character_id"),
};
const guards = Object.entries(hashes).map(([key, sql]) => `if ${sql} is distinct from ${q(before[key])} then raise exception ${q(`PERSONAL_REVIEW_CONFLICT:${key}`)}; end if;`).join("\n");
const rows = records.map(({ payload }) => ({ content_key: `gm:equipment:preparation:${payload.definition.id}`, name: payload.definition.name, payload }));
assert.equal(new Set(rows.map((row) => row.content_key)).size, records.length);
const batches = []; let current = [];
for (const row of rows) { if (current.length && JSON.stringify([...current, row]).length > 48000) { batches.push(current); current = []; } current.push(row); }
if (current.length) batches.push(current);
mkdirSync(`${root}/personal-batches`, { recursive: true });
let inserted = 0;
const files = batches.map((rows, index) => {
  const sql = `begin;
lock table public.campaigns,public.campaign_content_entries in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
create temporary table _personal_equipment on commit drop as select * from jsonb_to_recordset(${json(rows)}) as x(content_key text,name text,payload jsonb);
do $review$ declare affected integer; begin
${guards}
if (select state_revision from public.campaigns where id=${q(campaign)}) is distinct from __CAMPAIGN_REVISION__ then raise exception 'PERSONAL_REVIEW_CAMPAIGN_CHANGED'; end if;
if ${hash("campaign_content_entries", scope, "content_key")} is distinct from '__PREPARATION_HASH__' then raise exception 'PERSONAL_REVIEW_DRAFT_CHANGED'; end if;
if exists(select 1 from public.campaign_content_entries t join _personal_equipment p using(content_key) where t.campaign_id=${q(campaign)} and t.kind='equipment') then raise exception 'PERSONAL_REVIEW_TARGET_EXISTS'; end if;
insert into public.campaign_content_entries(campaign_id,kind,content_key,name,origin,tags,payload,revision) select ${q(campaign)},'equipment',content_key,name,'gm',array['es','en_preparacion'],payload,0 from _personal_equipment;
get diagnostics affected=row_count; if affected<>${rows.length} then raise exception 'PERSONAL_REVIEW_COUNT'; end if;
if (select count(*) from public.campaign_content_entries where ${scope})<>${before.preparation_rows + inserted + rows.length} then raise exception 'PERSONAL_REVIEW_FINAL_COUNT'; end if;
if (select count(*) from public.campaign_content_entries t join _personal_equipment p using(content_key) where t.campaign_id=${q(campaign)} and t.kind='equipment' and t.payload=p.payload and t.revision=0)<>${rows.length} then raise exception 'PERSONAL_REVIEW_DATA'; end if;
${guards}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaign)};
end $review$;
select ${rows.length} as inserted_rows,${hash("campaign_content_entries", scope, "content_key")} as preparation_hash,(select state_revision from public.campaigns where id=${q(campaign)}) as campaign_revision;
commit;
`;
  inserted += rows.length;
  const file = `${root}/personal-batches/batch-${index}.sql`; writeFileSync(file, sql);
  return { file, rows: rows.length, characters: sql.length, sha256: createHash("sha256").update(sql).digest("hex") };
});
writeFileSync(`${root}/personal-publish-manifest.json`, JSON.stringify({ mode: "add-personal-preparation-only", entries: rows.length, batches: files, migratedCopies: 0, deletedVersions: 0, executed: false }, null, 2));
console.log(JSON.stringify({ entries: rows.length, batches: files.map(({ file, rows, characters }) => ({ file, rows, characters })) }));
