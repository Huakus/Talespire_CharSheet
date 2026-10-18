/** Generates guarded SQL for the reviewed basic-gear batch. Does not connect or execute it. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions", read = (file) => JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
const previous = read("pilot-live-after.json"), reviews = read("reviewed-basic-drafts.json");
const campaignId = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
const rows = reviews.map((record) => ({ content_key: `gm:equipment:preparation:${record.payload.definition.id}`, name: record.payload.definition.name, payload: record.payload }));
const updated = rows.filter((row) => previous.rows.some((before) => before.content_key === row.content_key));
assert.equal(rows.length, 11); assert.equal(updated.length, 2); assert.equal(previous.rows.length, 12);
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => { const text = JSON.stringify(value); let tag = "eq_" + createHash("sha256").update(text).digest("hex").slice(0, 24); while (text.includes(`$${tag}$`)) tag += "x"; return `$${tag}$${text}$${tag}$::jsonb`; };
const prepared = `campaign_id=${q(campaignId)} and kind='equipment' and ((payload->>'format') is not distinct from 'equipment-preparation')`;
const hash = (table, where, order) => `(select md5(string_agg(md5(to_jsonb(t)::text),'' order by ${order})) from public.${table} t where ${where})`;
const hashes = {
  campaign_catalog_hash: hash("campaign_content_entries", `not (${prepared})`, "campaign_id,kind,content_key"),
  shared_hash: hash("official_content_entries", "true", "kind,content_key"),
  fragments_hash: hash("campaign_state_fragments", "true", "campaign_id,fragment_kind,parent_id,entity_id"),
  versions_hash: hash("campaign_character_versions", "true", "campaign_id,character_id"),
};
const guards = Object.entries(hashes).map(([key, sql]) => `if ${sql} is distinct from ${q(previous[key])} then raise exception ${q(`EQUIPMENT_REVIEW_CONFLICT:${key}`)}; end if;`).join("\n");
const sql = `begin;
lock table public.campaigns,public.campaign_content_entries in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
create temporary table _equipment_review on commit drop as select * from jsonb_to_recordset(${json(rows)}) as x(content_key text,name text,payload jsonb);
do $review$ declare affected integer; begin
${guards}
if (select state_revision from public.campaigns where id=${q(campaignId)}) is distinct from ${previous.campaign_revision} then raise exception 'EQUIPMENT_REVIEW_CAMPAIGN_CHANGED'; end if;
if (select count(*) from public.campaign_content_entries where ${prepared})<>12 then raise exception 'EQUIPMENT_REVIEW_DRAFT_COUNT_CHANGED'; end if;
if (select jsonb_agg(to_jsonb(t) order by content_key) from public.campaign_content_entries t where ${prepared}) is distinct from
 (select jsonb_agg(value order by value->>'content_key') from jsonb_array_elements(${json(previous.rows)})) then raise exception 'EQUIPMENT_REVIEW_DRAFT_CHANGED'; end if;
if exists(select 1 from public.campaign_content_entries t join _equipment_review p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.payload->>'format' is distinct from 'equipment-preparation') then raise exception 'EQUIPMENT_REVIEW_ACTIVE_TARGET'; end if;
insert into public.campaign_content_entries as target(campaign_id,kind,content_key,name,origin,tags,payload,revision)
select ${q(campaignId)},'equipment',content_key,name,'gm',array['es','en_preparacion'],payload,0 from _equipment_review
on conflict(campaign_id,kind,content_key) do update set name=excluded.name,payload=excluded.payload,revision=target.revision+1,updated_at=statement_timestamp();
get diagnostics affected=row_count; if affected<>11 then raise exception 'EQUIPMENT_REVIEW_WRITE_COUNT'; end if;
if (select count(*) from public.campaign_content_entries t join _equipment_review p using(content_key) where t.campaign_id=${q(campaignId)} and t.kind='equipment' and t.payload=p.payload)<>11 then raise exception 'EQUIPMENT_REVIEW_DATA'; end if;
if (select count(*) from public.campaign_content_entries where ${prepared})<>21 then raise exception 'EQUIPMENT_REVIEW_FINAL_COUNT'; end if;
${guards}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(campaignId)};
end $review$;
select count(*) as preparation_rows from public.campaign_content_entries where ${prepared};
commit;
`;
writeFileSync(`${root}/basic-review-apply.sql`, sql);
writeFileSync(`${root}/basic-review-dry-run.sql`, sql.replace("commit;", "rollback;"));
writeFileSync(`${root}/basic-review-rows.json`, JSON.stringify(rows));
console.log(JSON.stringify({ inserted: 9, updated: 2, finalPreparationRows: 21, migratedCopies: 0, executed: false }));
