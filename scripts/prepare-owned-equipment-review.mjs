/** Guarded updates exclusively to existing ECE preparation definitions. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions";
const read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const changes = read("owned-reviewed-drafts.json"), before = read("owned-publish-before.json");
const campaignId = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
assert.equal(before.preparation_rows, 806); assert.equal(before.active_equipment, 1609);
assert.equal(new Set(changes.map((item) => item.after.definition.id)).size, changes.length);
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => { const text = JSON.stringify(value); const tag = "owned_" + createHash("sha256").update(text).digest("hex").slice(0, 24); assert.ok(!text.includes(`$${tag}$`)); return `$${tag}$${text}$${tag}$::jsonb`; };
const scope = `campaign_id=${q(campaignId)} and kind='equipment' and ((payload->>'format') is not distinct from 'equipment-preparation')`;
const hash = (table, where, order) => `(select md5(string_agg(md5(to_jsonb(t)::text),'' order by ${order})) from public.${table} t where ${where})`;
const hashes = {
  campaign_catalog_hash: hash("campaign_content_entries", `not (${scope})`, "campaign_id,kind,content_key"),
  shared_hash: hash("official_content_entries", "true", "kind,content_key"),
  fragments_hash: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  versions_hash: hash("campaign_character_versions", "true", "campaign_id,character_id"),
};
const guards = Object.entries(hashes).map(([key, sql]) => `if ${sql} is distinct from ${q(before[key])} then raise exception ${q(`OWNED_REVIEW_CONFLICT:${key}`)}; end if;`).join("\n");
const rows = changes.map(({ before, after }) => {
  assert.equal(before.definition.id, after.definition.id); assert.deepEqual(before.originals, after.originals);
  return { content_key: `gm:equipment:preparation:${after.definition.id}`, name: after.definition.name, definition: after.definition, decisions: after.decisions };
});
const batches = []; let batch = [];
for (const row of rows) {
  if (batch.length && JSON.stringify([...batch, row]).length > 48000) { batches.push(batch); batch = []; }
  batch.push(row);
}
if (batch.length) batches.push(batch);
mkdirSync(`${root}/owned-review-batches`, { recursive: true });
const files = batches.map((rows, index) => {
  const sql = `begin;
lock table public.campaigns,public.campaign_content_entries in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
create temporary table _owned_review on commit drop as select * from jsonb_to_recordset(${json(rows)}) as x(content_key text,name text,definition jsonb,decisions jsonb);
create temporary table _owned_originals on commit drop as select content_key,payload->'originals' as originals,revision from public.campaign_content_entries where ${scope};
do $review$ declare affected integer; begin
${guards}
if (select state_revision from public.campaigns where id=${q(campaignId)}) is distinct from __CAMPAIGN_REVISION__ then raise exception 'OWNED_REVIEW_CAMPAIGN_CHANGED'; end if;
if ${hash("campaign_content_entries", scope, "content_key")} is distinct from '__PREPARATION_HASH__' then raise exception 'OWNED_REVIEW_PREPARATION_CHANGED'; end if;
if (select count(*) from public.campaign_content_entries t join _owned_review p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.deleted_at is null and t.payload->>'format'='equipment-preparation' and t.payload->'definition'->>'id'=p.definition->>'id')<>${rows.length} then raise exception 'OWNED_REVIEW_TARGET'; end if;
update public.campaign_content_entries t set name=p.name,payload=jsonb_set(jsonb_set(t.payload,'{definition}',p.definition),'{decisions}',p.decisions),revision=t.revision+1,updated_at=statement_timestamp()
from _owned_review p where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.content_key=p.content_key;
get diagnostics affected=row_count; if affected<>${rows.length} then raise exception 'OWNED_REVIEW_COUNT'; end if;
if (select count(*) from public.campaign_content_entries t join _owned_review p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.name=p.name and t.payload->'definition'=p.definition and t.payload->'decisions'=p.decisions)<>${rows.length} then raise exception 'OWNED_REVIEW_DATA'; end if;
if exists(select 1 from public.campaign_content_entries t join _owned_originals o using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.payload->'originals' is distinct from o.originals) then raise exception 'OWNED_REVIEW_ORIGINAL_CHANGED'; end if;
if exists(select 1 from public.campaign_content_entries t join _owned_originals o using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.revision<>o.revision+case when exists(select 1 from _owned_review p where p.content_key=t.content_key) then 1 else 0 end) then raise exception 'OWNED_REVIEW_REVISION'; end if;
if (select count(*) from public.campaign_content_entries where ${scope})<>806 then raise exception 'OWNED_REVIEW_FINAL_COUNT'; end if;
${guards}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaignId)};
end $review$;
select ${rows.length} as reviewed_rows,${hash("campaign_content_entries", scope, "content_key")} as preparation_hash,(select state_revision from public.campaigns where id=${q(campaignId)}) as campaign_revision;
commit;
`;
  const file = `${root}/owned-review-batches/batch-${index}.sql`; writeFileSync(file, sql);
  return { file, entries: rows.length, characters: sql.length, sha256: createHash("sha256").update(sql).digest("hex") };
});
writeFileSync(`${root}/owned-publish-manifest.json`, JSON.stringify({ mode: "update-existing-preparations-only", rows: changes.length, batches: files, migratedCopies: 0, deletedVersions: 0, executed: false }, null, 2));
console.log(JSON.stringify({ rows: rows.length, batches: files.map(({ file, entries, characters }) => ({ file, entries, characters })) }));
