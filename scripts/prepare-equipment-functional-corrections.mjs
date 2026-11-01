import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const root='docs/v2/equipment-functional-corrections-2026-11-01';mkdirSync(root,{recursive:true});
const cid='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd',q=s=>`'${s.replaceAll("'","''")}'`;
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {EQUIPMENT_CORRECTION_KEYS,correctedEquipmentDefinition,refreshCorrectedEquipment}=await server.ssrLoadModule('/src/domain/equipment/equipment-functional-corrections.ts');
 const {serializeEquipmentContentPayload}=await server.ssrLoadModule('/src/domain/content/content-payload.ts');
 const keys=Object.values(EQUIPMENT_CORRECTION_KEYS).map(q).join(','),target=`campaign_id=${q(cid)} and kind='equipment' and content_key in(${keys})`;
 const inventory=`campaign_id=${q(cid)} and fragment_kind='character-inventory' and payload#>>'{catalog,contentKey}' in(${keys})`;
 const merchant=`campaign_id=${q(cid)} and kind='monster' and deleted_at is null and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(t.payload->'inventory')='array' then t.payload->'inventory' else '[]'::jsonb end)i where i#>>'{catalog,contentKey}' in(${keys}))`;
 const versions=`campaign_id=${q(cid)} and character_id in(select parent_id from public.campaign_state_fragments where ${inventory})`;
 const hash=(table,where,order)=>`(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
 const guards={content:hash('campaign_content_entries',`((${target})or(${merchant})) is not true`,'campaign_id,kind,content_key'),shared:hash('official_content_entries','true','kind,content_key'),fragments:hash('campaign_state_fragments',`(${inventory}) is not true`,'campaign_id,fragment_kind,parent_id,entity_id'),versions:hash('campaign_character_versions',`(${versions}) is not true`,'campaign_id,character_id'),campaigns:hash('campaigns',`id<>${q(cid)}`,'id')};
 const select=`select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),'entries',(select jsonb_agg(to_jsonb(t)) from public.campaign_content_entries t where ${target}),'inventories',coalesce((select jsonb_agg(to_jsonb(t)) from public.campaign_state_fragments t where ${inventory}),'[]'::jsonb),'merchants',coalesce((select jsonb_agg(to_jsonb(t)) from public.campaign_content_entries t where ${merchant}),'[]'::jsonb),'versions',coalesce((select jsonb_agg(to_jsonb(t)) from public.campaign_character_versions t where ${versions}),'[]'::jsonb),'guards',jsonb_build_object(${Object.entries(guards).map(([k,v])=>q(k)+','+v).join(',')})) as snapshot;`;
 writeFileSync(root+'/select.sql',select);
 if(!process.argv.includes('--prepare')){console.log('Select prepared.');process.exitCode=0;}
 else{
  const before=JSON.parse(readFileSync(root+'/before.json','utf8'));assert.equal(before.entries.length,4);
  const changes=[];
  const corrected=new Map(before.entries.map(r=>[r.content_key,correctedEquipmentDefinition(r.content_key,r.payload.rules.definition)]));
  const convert=(item,key,catalog)=>{
   const result=refreshCorrectedEquipment(item,corrected.get(key),catalog,key);
   for(const field of ['id','quantity','order','group','equipped','attuned','charges','cost','armor','weapon','unitWeight','effect'])assert.deepEqual(result[field],item[field],field);
   return result;
  };
  for(const r of before.entries){
   const item={...r.payload,id:'inv_00000000000000000000000000000000',order:0,group:'Mochila',catalog:null};
   const payload=serializeEquipmentContentPayload({...convert(item,r.content_key,null),rarity:corrected.get(r.content_key).rarity});
   changes.push({table:'campaign_content_entries',where:`campaign_id=${q(cid)} and kind='equipment' and content_key=${q(r.content_key)}`,before:r,payload});
  }
  for(const r of before.inventories){const key=r.payload.catalog.contentKey,entry=before.entries.find(e=>e.content_key===key);changes.push({table:'campaign_state_fragments',where:`campaign_id=${q(cid)} and fragment_kind='character-inventory' and parent_id=${q(r.parent_id)} and entity_id=${q(r.entity_id)}`,before:r,payload:convert(r.payload,key,{...r.payload.catalog,revision:entry.revision+1})});}
  for(const r of before.merchants){const payload={...r.payload,inventory:r.payload.inventory.map(i=>corrected.has(i.catalog?.contentKey)?convert(i,i.catalog.contentKey,{...i.catalog,revision:before.entries.find(e=>e.content_key===i.catalog.contentKey).revision+1}):i)};changes.push({table:'campaign_content_entries',where:`campaign_id=${q(cid)} and kind='monster' and content_key=${q(r.content_key)}`,before:r,payload});}
  const j=v=>{const s=JSON.stringify(v),tag='fix_'+createHash('sha256').update(s).digest('hex').slice(0,16);return `$${tag}$${s}$${tag}$::jsonb`;};
  const guardSql=Object.entries(guards).map(([key,expr])=>`if ${expr} is distinct from ${q(before.guards[key])} then raise exception 'EQUIPMENT_FIX_SCOPE_CHANGED:${key}';end if;`).join('\n');
  let update='';
  for(const c of changes){
   let expression='payload';
   for(const field of Object.keys(c.payload))if(JSON.stringify(c.payload[field])!==JSON.stringify(c.before.payload[field])){
    if(field==='rules'&&c.before.payload.rules){
     assert.deepEqual(c.payload.rules.original,c.before.payload.rules.original,'Lossless archive preserved');
     for(const rk of Object.keys(c.payload.rules))if(JSON.stringify(c.payload.rules[rk])!==JSON.stringify(c.before.payload.rules[rk]))expression=`jsonb_set(${expression},'{rules,${rk}}',${j(c.payload.rules[rk])},true)`;
    }else if(field==='inventory'){
     for(const [index,item]of c.payload.inventory.entries()){
      const prev=c.before.payload.inventory[index];if(JSON.stringify(prev)===JSON.stringify(item))continue;
      for(const f of Object.keys(item))if(JSON.stringify(prev[f])!==JSON.stringify(item[f])){
       if(f==='rules'&&prev.rules){assert.deepEqual(item.rules.original,prev.rules.original);for(const rk of Object.keys(item.rules))if(JSON.stringify(prev.rules[rk])!==JSON.stringify(item.rules[rk]))expression=`jsonb_set(${expression},'{inventory,${index},rules,${rk}}',${j(item.rules[rk])},true)`;}
       else expression=`jsonb_set(${expression},'{inventory,${index},${f}}',${j(item[f])},true)`;
      }
     }
    }else expression=`jsonb_set(${expression},'{${field}}',${j(c.payload[field])},true)`;
   }
   update+=`if not exists(select 1 from public.${c.table} t where ${c.where} and revision=${c.before.revision})then raise exception 'EQUIPMENT_FIX_ROW_CHANGED';end if;update public.${c.table} set payload=${expression},revision=revision+1,updated_at=statement_timestamp() where ${c.where};\n`;
  }
  for(const v of before.versions)update+=`if not exists(select 1 from public.campaign_character_versions t where campaign_id=${q(cid)} and character_id=${q(v.character_id)} and to_jsonb(t)=${j(v)})then raise exception 'EQUIPMENT_FIX_CHARACTER_CHANGED';end if;update public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and character_id=${q(v.character_id)};\n`;
  const sql=`begin;lock table public.campaigns,public.campaign_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share row exclusive mode;lock table public.official_content_entries in share mode;do $fix$ begin if(select state_revision from public.campaigns where id=${q(cid)})<>${before.revision} then raise exception 'EQUIPMENT_FIX_REVISION_CHANGED';end if;${guardSql}\n${update}${guardSql}\nupdate public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};end $fix$;select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),'definitions',4,'inventoryCopies',${before.inventories.length},'merchantRecords',${before.merchants.length})as result;commit;`;
  writeFileSync(root+'/publication.json',JSON.stringify({baselineRevision:before.revision,changes,versions:before.versions}));writeFileSync(root+'/publication.sql',sql);writeFileSync(root+'/dry-run.sql',sql.replace(/commit;$/,'rollback;'));
  console.log(JSON.stringify({definitions:4,inventoryCopies:before.inventories.length,merchantRecords:before.merchants.length,characters:before.versions.length,bytes:sql.length}));
 }
}finally{await server.close();}
