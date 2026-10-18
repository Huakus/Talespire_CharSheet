/** Build a guarded SQL transaction from an auditable, offline recovery archive. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root="tmp/equipment-definitions",batch=process.argv[2]??"cleanup";
assert.match(batch,/^[a-z-]+$/);
const report="docs/v2/equipment-retirement-2026-10-18"+(batch==="cleanup"?"":"/"+batch);
const read=n=>JSON.parse(readFileSync(`${root}/${n}`,"utf8"));
const plan=read(`${batch}-plan.json`),cid=plan.campaignId;
const stable=v=>Array.isArray(v)?`[${v.map(stable).join(",")}]`:v&&typeof v==="object"?
  `{${Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")}}`:JSON.stringify(v);
const sha=v=>createHash("sha256").update(stable(v)).digest("hex"),q=v=>`'${String(v).replaceAll("'","''")}'`;
const json=v=>{const text=JSON.stringify(v),tag="retirement_"+sha(v).slice(0,16);return `$${tag}$${text}$${tag}$::jsonb`;};
assert.equal(plan.preparations.length,plan.preparationKeys.length,"Capture the full preparation rows before deletion.");
assert.equal(sha(plan),JSON.parse(readFileSync(`${report}/manifest.json`,"utf8")).archiveSha256);
const data=[...plan.rows.map(x=>({before:x.row,target_keys:x.targetKeys,reason:x.reason,sha256:x.sha256})),
 ...plan.preparations.map(x=>({before:x.row,target_keys:[],reason:"Preparación obsoleta de un objeto retirado expresamente; original completo conservado en el archivo de recuperación.",sha256:x.sha256}))];
for(const d of data)assert.equal(sha(d.before),d.sha256);
if(batch!=="cleanup")assert.equal(plan.destinations?.length,new Set(plan.rows.flatMap(r=>r.targetKeys)).size,"Capture and compare fresh destination hashes before publishing.");
const destinationChecks=(plan.destinations??[]).map(d=>{
 assert.match(d.md5,/^[a-f0-9]{32}$/);
 return `if not exists(select 1 from public.campaign_content_entries t where t.campaign_id=${q(cid)} and t.kind='equipment' and t.content_key=${q(d.key)} and md5(to_jsonb(t)::text)=${q(d.md5)}) then raise exception 'RETIREMENT_DESTINATION_CHANGED'; end if;`;
}).join("\n");
const keys=data.map(x=>q(x.before.content_key)).join(",");
const target=`campaign_id=${q(cid)} and kind='equipment' and content_key in(${keys})`;
const hash=(table,where,order)=>`(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
const hashes={
 content:hash("campaign_content_entries",`not(${target})`,"campaign_id,kind,content_key"),
 shared:hash("official_content_entries","true","kind,content_key"),
 fragments:hash("campaign_state_fragments","true","campaign_id,fragment_kind,parent_id,entity_id"),
 versions:hash("campaign_character_versions","true","campaign_id,character_id"),
 otherCampaigns:hash("campaigns",`id<>${q(cid)}`,"id"),
};
writeFileSync(`${root}/${batch}-guard.sql`,`select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),${Object.entries(hashes).map(([k,v])=>q(k)+","+v).join(",")}) as guard;`);
let guard;try{guard=read(`${batch}-guards.json`);}catch{console.log(`Fetch ${batch}-guard.sql, save ${batch}-guards.json, then run again.`);process.exit(0);}
assert.equal(guard.revision,plan.baselineRevision);
const checks=Object.entries(hashes).map(([k,v])=>`if ${v} is distinct from ${q(guard[k])} then raise exception ${q("RETIREMENT_CHANGED:"+k)}; end if;`).join("\n");
const script=`begin;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('campaign-content:' || ${q(cid)},0));
lock table public.campaigns,public.campaign_content_entries,private.campaign_content_retirements in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
create temporary table _retirement on commit drop as
 select * from jsonb_to_recordset(${json(data)}) as x(before jsonb,target_keys text[],reason text,sha256 text);
-- Historical originals can contain obsolete references intentionally. Walk the
-- live document only, rather than confusing those archives with owned copies.
create temporary table _retirement_live_refs on commit drop as
with recursive walk(doc) as (
 (select payload from public.campaign_state_fragments where campaign_id=${q(cid)}
  union all
  select payload from public.campaign_content_entries
    where campaign_id=${q(cid)} and deleted_at is null and kind<>'equipment')
 union all
 select child.value from walk w cross join lateral (
   select key,value from jsonb_each(case when jsonb_typeof(w.doc)='object' then w.doc else '{}'::jsonb end)
   union all
   select '',value from jsonb_array_elements(case when jsonb_typeof(w.doc)='array' then w.doc else '[]'::jsonb end)
 ) child where child.key not in('original','originals','legacyData')
)
select distinct doc->>'contentKey' as content_key from walk where doc ? 'contentKey';
do $cleanup$ declare affected integer; begin
 if(select state_revision from public.campaigns where id=${q(cid)})<>${plan.baselineRevision} then raise exception 'RETIREMENT_REVISION_CHANGED'; end if;
 ${checks}
 ${destinationChecks}
 if(select count(*) from public.campaign_content_entries t join _retirement r
   on to_jsonb(t)=r.before where t.campaign_id=${q(cid)})<>${data.length} then raise exception 'RETIREMENT_BEFORE_CHANGED'; end if;
 if exists(select 1 from _retirement r join private.campaign_content_retirements x
   on x.campaign_id=${q(cid)} and x.kind='equipment' and x.content_key=r.before->>'content_key') then raise exception 'RETIREMENT_ALREADY_RECORDED'; end if;
 if exists(select 1 from _retirement r cross join lateral unnest(r.target_keys) dest(key)
   where not exists(select 1 from public.campaign_content_entries t
     where t.campaign_id=${q(cid)} and t.kind='equipment' and t.content_key=dest.key and t.deleted_at is null and t.payload#>>'{rules,definition,language}'='es')) then raise exception 'RETIREMENT_DESTINATION_MISSING'; end if;
 if exists(select 1 from _retirement_live_refs refs join _retirement r on refs.content_key=r.before->>'content_key')
   then raise exception 'RETIREMENT_HAS_REFERENCES'; end if;
 insert into private.campaign_content_retirements(campaign_id,kind,content_key,replacement_keys,reason,archive_sha256)
   select ${q(cid)},'equipment',before->>'content_key',target_keys,reason,sha256 from _retirement;
 delete from public.campaign_content_entries t using _retirement r
   where t.campaign_id=${q(cid)} and t.kind='equipment' and t.content_key=r.before->>'content_key' and to_jsonb(t)=r.before;
 get diagnostics affected=row_count;
 if affected<>${data.length} then raise exception 'RETIREMENT_DELETE_COUNT'; end if;
 if exists(select 1 from public.campaign_content_entries t join _retirement r
   on t.content_key=r.before->>'content_key' where t.campaign_id=${q(cid)} and t.kind='equipment') then raise exception 'RETIREMENT_INCOMPLETE'; end if;
 ${checks}
 update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};
end $cleanup$;
select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),'definitionsDeleted',${plan.rows.length},'preparationsDeleted',${plan.preparations.length},'registryCount',(select count(*) from private.campaign_content_retirements where campaign_id=${q(cid)})) as result;
commit;`;
writeFileSync(`${root}/${batch}-publication.sql`,script);
writeFileSync(`${root}/${batch}-dry-run.sql`,script.replace(/commit;$/,"rollback;"));
console.log(JSON.stringify({definitions:plan.rows.length,preparations:plan.preparations.length,archiveVerified:true,bytes:script.length}));
