import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { postgresJsonbText } from './postgres-jsonb-text.mjs';
const root='tmp/equipment-definitions', read=n=>JSON.parse(readFileSync(`${root}/${n}`,'utf8'));
const batch=process.argv[2]??'healing-potion-variants',baseline=process.argv[3]??'potions-2026-10-19-before.json';
assert.match(batch,/^[a-z-]+$/);assert.match(baseline,/^[a-z0-9-]+\.json$/);
const reviews=read(batch+'-reviews.json'), shared=read(baseline).shared;
const q=s=>`'${s.replaceAll("'","''")}'`, j=v=>`$potion$${JSON.stringify(v)}$potion$::jsonb`, md5=v=>createHash('md5').update(postgresJsonbText(v)).digest('hex');
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true,hmr:false},appType:'custom'});
const changes=[];
try {
  const module=await server.ssrLoadModule('/src/domain/equipment/equipment-editorial-refresh.ts');
  const refresh=process.argv.includes('--slot-recovery')?module.refreshEquipmentSlotRecoveryDefinition:process.argv.includes('--healing-execution')?module.refreshEquipmentHealingExecution:module.refreshEquipmentEditorialDefinition;
  const { serializeEquipmentContentPayload:serialize }=await server.ssrLoadModule('/src/domain/content/content-payload.ts');
  for(const review of reviews){const old=shared.find(r=>r.content_key===review.key);assert.ok(old);
    const item={...old.payload,id:'inv_00000000000000000000000000000000',order:0,group:'Mochila',catalog:null};
    const next=refresh(item,review.definition,old.name,null),payload=serialize({...next,rarity:review.definition.rarity});
    assert.deepEqual(payload.rules.original,old.payload.rules.original);
    changes.push({before:old,payload});
  }
}finally{await server.close();}
writeFileSync(`${root}/shared-${batch}-plan.json`,JSON.stringify(changes));
const keys=changes.map(c=>q(c.before.content_key)).join(',');
const protectedHash=`md5(concat((select coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'') from public.campaigns t),(select coalesce(string_agg(md5(to_jsonb(t)::text),'' order by campaign_id,kind,content_key),'') from public.campaign_content_entries t),(select coalesce(string_agg(md5(to_jsonb(t)::text),'' order by campaign_id,fragment_kind,parent_id,entity_id),'') from public.campaign_state_fragments t),(select coalesce(string_agg(md5(to_jsonb(t)::text),'' order by campaign_id,character_id),'') from public.campaign_character_versions t),(select coalesce(string_agg(md5(to_jsonb(t)::text),'' order by kind,content_key),'') from public.official_content_entries t where not(kind='equipment' and content_key in(${keys})))))`;
let sql=`begin;lock table public.official_content_entries in share row exclusive mode;lock table public.campaigns,public.campaign_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;\ndo $check$ declare protected_before text;begin protected_before:=${protectedHash};\n`;
for(const c of changes)sql+=`if not exists(select 1 from public.official_content_entries t where kind='equipment' and content_key=${q(c.before.content_key)} and md5(to_jsonb(t)::text)=${q(md5(c.before))})then raise exception 'POTION_SHARED_CHANGED';end if;update public.official_content_entries set payload=${j(c.payload)} where kind='equipment' and content_key=${q(c.before.content_key)};\n`;
sql+=`if ${protectedHash} is distinct from protected_before then raise exception 'POTION_SCOPE_CHANGED';end if;end $check$;select jsonb_build_object('entries',(select jsonb_agg(to_jsonb(t)) from public.official_content_entries t where kind='equipment' and content_key in(${keys})),'protectedHash',${protectedHash}) as snapshot;commit;`;
writeFileSync(`${root}/shared-${batch}-publication.sql`,sql);writeFileSync(`${root}/shared-${batch}-dry-run.sql`,sql.replace(/commit;$/,'rollback;'));
console.log(JSON.stringify({catalog:changes.length,sqlLength:sql.length}));

