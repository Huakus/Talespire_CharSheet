/** Remove preparation documents only after full offline payload/row hashes matched. */
import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const root='tmp/equipment-definitions',base='docs/v2/equipment-retirement-2026-10-18/preparations',read=p=>JSON.parse(readFileSync(p,'utf8')),archive=read(base+'/archive.json'),manifest=read(base+'/manifest.json'),cid=archive.campaignId;
const sha=s=>createHash('sha256').update(s).digest('hex');assert.equal(sha(readFileSync(base+'/archive.json')),manifest.archiveSha256);
const q=v=>"'"+String(v).replaceAll("'","''")+"'",j=v=>'$prep_data$'+JSON.stringify(v)+'$prep_data$::jsonb';
const data=archive.rows.map(r=>{assert.equal(sha(JSON.stringify(r.row)),r.sha256);return{key:r.row.content_key,md5:r.rowMd5,sha256:r.sha256,target_keys:r.targetKeys};});assert.equal(data.length,833);
const target=`campaign_id=${q(cid)} and kind='equipment' and payload->>'format'='equipment-preparation'`;
const h=(table,where,order)=>`(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
const hashes={content:h('campaign_content_entries',`(${target}) is not true`,'campaign_id,kind,content_key'),shared:h('official_content_entries','true','kind,content_key'),fragments:h('campaign_state_fragments','true','campaign_id,fragment_kind,parent_id,entity_id'),versions:h('campaign_character_versions','true','campaign_id,character_id'),otherCampaigns:h('campaigns',`id<>${q(cid)}`,'id')};
writeFileSync(root+'/preparation-retirement-guard.sql',`select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),${Object.entries(hashes).map(([k,v])=>q(k)+','+v).join(',')}) as guard;`);
let before;try{before=read(root+'/preparation-retirement-guards.json');}catch{console.log('Fetch preparation-retirement-guard.sql first.');process.exit(0);}assert.equal(before.revision,archive.baselineRevision);
const checks=Object.entries(hashes).map(([k,v])=>`if ${v} is distinct from ${q(before[k])} then raise exception ${q('PREPARATION_SCOPE_CHANGED:'+k)};end if;`).join('\n');
const sql=`begin;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('campaign-content:'||${q(cid)},0));
lock table public.campaigns,public.campaign_content_entries,private.campaign_content_retirements in share row exclusive mode;
lock table public.campaign_state_fragments,public.campaign_character_versions,public.official_content_entries in share mode;
create temporary table _prep_retirement on commit drop as select * from jsonb_to_recordset(${j(data)}) as x(key text,md5 text,sha256 text,target_keys text[]);
do $prep$ declare affected integer;begin
if(select state_revision from public.campaigns where id=${q(cid)})<>${archive.baselineRevision} then raise exception 'PREPARATION_REVISION_CHANGED';end if;
${checks}
if(select count(*) from public.campaign_content_entries where ${target})<>${data.length} then raise exception 'PREPARATION_COUNT_CHANGED';end if;
if(select count(*) from public.campaign_content_entries t join _prep_retirement r on t.content_key=r.key and md5(to_jsonb(t)::text)=r.md5 where t.campaign_id=${q(cid)} and t.kind='equipment')<>${data.length} then raise exception 'PREPARATION_BEFORE_CHANGED';end if;
if exists(select 1 from _prep_retirement r cross join lateral unnest(r.target_keys) dest(key) where not exists(select 1 from public.campaign_content_entries t where t.campaign_id=${q(cid)} and t.kind='equipment' and t.content_key=dest.key and t.deleted_at is null and t.payload#>>'{rules,definition,language}'='es'))then raise exception 'PREPARATION_DESTINATION_MISSING';end if;
if exists(
with recursive walk(doc) as (
(select payload from public.campaign_state_fragments where campaign_id=${q(cid)} union all select payload from public.campaign_content_entries where campaign_id=${q(cid)} and kind<>'equipment' and deleted_at is null)
union all select child.value from walk w cross join lateral(select key,value from jsonb_each(case when jsonb_typeof(w.doc)='object' then w.doc else '{}'::jsonb end) union all select '',value from jsonb_array_elements(case when jsonb_typeof(w.doc)='array' then w.doc else '[]'::jsonb end)) child where child.key not in('original','originals','legacyData'))
select 1 from walk join _prep_retirement r on doc->>'contentKey'=r.key)then raise exception 'PREPARATION_STILL_REFERENCED';end if;
insert into private.campaign_content_retirements(campaign_id,kind,content_key,replacement_keys,reason,archive_sha256) select ${q(cid)},'equipment',key,target_keys,'Documento interno de preparación archivado íntegramente fuera del catálogo. Las definiciones españolas activas y las copias poseen sus reglas; la recuperación histórica queda en el archivo verificado.',sha256 from _prep_retirement;
delete from public.campaign_content_entries t using _prep_retirement r where t.campaign_id=${q(cid)} and t.kind='equipment' and t.content_key=r.key and md5(to_jsonb(t)::text)=r.md5;
get diagnostics affected=row_count;if affected<>${data.length} then raise exception 'PREPARATION_DELETE_COUNT';end if;
${checks}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};
end $prep$;
select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),'preparationsDeleted',${data.length},'registryCount',(select count(*) from private.campaign_content_retirements where campaign_id=${q(cid)})) as result;
commit;`;
writeFileSync(root+'/preparation-retirement-publication.sql',sql);writeFileSync(root+'/preparation-retirement-dry-run.sql',sql.replace(/commit;$/,'rollback;'));console.log(JSON.stringify({rows:data.length,characters:sql.length}));
