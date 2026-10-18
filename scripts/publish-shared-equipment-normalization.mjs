import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const root='tmp/equipment-definitions',base='docs/v2/equipment-retirement-2026-10-18/shared',read=p=>JSON.parse(readFileSync(p,'utf8')),plan=read(root+'/shared-equipment-plan.json'),manifest=read(base+'/manifest.json'),sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');assert.equal(sha(plan),manifest.archiveSha256);
for(const r of plan.rows)assert.equal(sha(r.before),r.sha256);
const q=v=>"'"+String(v).replaceAll("'","''")+"'",cid='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd',h=(table,where,order)=>`(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
const hashes={campaigns:h('campaigns','true','id'),content:h('campaign_content_entries','true','campaign_id,kind,content_key'),fragments:h('campaign_state_fragments','true','campaign_id,fragment_kind,parent_id,entity_id'),versions:h('campaign_character_versions','true','campaign_id,character_id'),otherShared:h('official_content_entries',"kind<>'equipment'",'kind,content_key')};
const sharedBefore=h('official_content_entries','true','kind,content_key');
writeFileSync(root+'/shared-equipment-guard.sql',`select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),'shared',${sharedBefore},${Object.entries(hashes).map(([k,v])=>q(k)+','+v).join(',')}) as guard;`);
let before;try{before=read(root+'/shared-equipment-guards.json');}catch{console.log('Fetch shared-equipment-guard.sql first.');process.exit(0);}assert.equal(before.revision,plan.baselineEceRevision);
const checks=Object.entries(hashes).map(([k,v])=>`if ${v} is distinct from ${q(before[k])}then raise exception ${q('SHARED_SCOPE_CHANGED:'+k)};end if;`).join('\n');
const data=plan.rows.map(r=>({key:r.before.content_key,old_md5:r.rowMd5,source_md5:r.sourceRowMd5,next_md5:r.nextPayloadMd5,action:r.action}));
const nextPayload=`jsonb_set(jsonb_set(jsonb_set(c.payload,'{rules,original}','{}'::jsonb),'{rules,pending}','[]'::jsonb),'{rules,personalDescription}',to_jsonb(''::text))`;
const sql=`begin;
lock table public.official_content_entries in share row exclusive mode;
lock table public.campaigns,public.campaign_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
create temporary table _shared_equipment on commit drop as select * from jsonb_to_recordset($shared_data$${JSON.stringify(data)}$shared_data$::jsonb) as x(key text,old_md5 text,source_md5 text,next_md5 text,action text);
do $shared$ declare affected integer;begin
${checks}
if ${sharedBefore} is distinct from ${q(before.shared)}then raise exception 'SHARED_BEFORE_CHANGED';end if;
if(select state_revision from public.campaigns where id=${q(cid)})<>${plan.baselineEceRevision} then raise exception 'SHARED_SOURCE_REVISION_CHANGED';end if;
if(select count(*) from public.official_content_entries where kind='equipment')<>1572 then raise exception 'SHARED_COUNT_CHANGED';end if;
if(select count(*) from public.official_content_entries o join _shared_equipment p on o.content_key=p.key and md5(to_jsonb(o)::text)=p.old_md5 where o.kind='equipment')<>1572 then raise exception 'SHARED_ARCHIVED_ROW_CHANGED';end if;
if(select count(*) from public.campaign_content_entries c join _shared_equipment p on c.content_key=p.key and md5(to_jsonb(c)::text)=p.source_md5 where c.campaign_id=${q(cid)} and c.kind='equipment' and c.deleted_at is null and c.payload#>>'{rules,definition,language}'='es' and c.payload#>>'{rules,definition,origin}'='official' and p.action='normalize')<>757 then raise exception 'SHARED_CANONICAL_SOURCE_CHANGED';end if;
update public.official_content_entries o set name=c.name,tags=array['es','reglas_2014'],payload=${nextPayload} from public.campaign_content_entries c,_shared_equipment p where o.kind='equipment' and o.content_key=p.key and p.action='normalize' and c.campaign_id=${q(cid)} and c.kind='equipment' and c.content_key=p.key;
get diagnostics affected=row_count;if affected<>757 then raise exception 'SHARED_UPDATE_COUNT';end if;
delete from public.official_content_entries o using _shared_equipment p where o.kind='equipment' and o.content_key=p.key and p.action='retire';
get diagnostics affected=row_count;if affected<>815 then raise exception 'SHARED_DELETE_COUNT';end if;
if(select count(*) from public.official_content_entries o join _shared_equipment p on o.content_key=p.key and md5(o.payload::text)=p.next_md5 where o.kind='equipment' and p.action='normalize')<>757 then raise exception 'SHARED_RESULT_PAYLOAD_MISMATCH';end if;
if(select count(*) from public.official_content_entries where kind='equipment')<>757 or exists(select 1 from public.official_content_entries where kind='equipment' and(content_key like 'official:equipment:eng:%' or payload#>>'{rules,definition,language}' is distinct from 'es'))then raise exception 'SHARED_INCOMPLETE';end if;
if exists(select 1 from public.official_content_entries where kind='equipment' group by lower(name) having count(*)>1)then raise exception 'SHARED_DUPLICATE_NAME';end if;
${checks}
end $shared$;
select jsonb_build_object('sharedSpanishDefinitions',757,'sharedRowsRetired',815,'allCampaignDataPreserved',true,'sourceRevision',${plan.baselineEceRevision}) as result;
commit;`;
writeFileSync(root+'/shared-equipment-publication.sql',sql);writeFileSync(root+'/shared-equipment-dry-run.sql',sql.replace(/commit;$/,'rollback;'));console.log(JSON.stringify({sourceRevision:plan.baselineEceRevision,normalize:757,retire:815,characters:sql.length}));
