import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const root='docs/v2/equipment-editorial-cleanup-2026-11-01/',plan=JSON.parse(readFileSync(root+'plan.json','utf8')),cid='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd',q=s=>`'${String(s).replaceAll("'","''")}'`,j=v=>{const s=JSON.stringify(v),tag='verify_'+createHash('sha256').update(s).digest('hex').slice(0,16);return `$${tag}$${s}$${tag}$::jsonb`;};
let body='',queries=[];
for(const c of plan.changes){
 const table=c.scope==='shared'?'official_content_entries':c.scope==='inventory'?'campaign_state_fragments':'campaign_content_entries';
 const where=c.scope==='shared'?`kind='equipment' and content_key=${q(c.key)}`:c.scope==='inventory'?`campaign_id=${q(cid)} and fragment_kind='character-inventory' and parent_id=${q(c.parentId)} and entity_id=${q(c.key)}`:`campaign_id=${q(cid)} and kind=${q(c.scope==='merchant'?'monster':'equipment')} and content_key=${q(c.key)}`;
 for(const f of c.fields.filter(f=>f.value!==undefined)){
  if(f.path.at(-1)==='features'){
   assert.deepEqual(f.value.map(({description,...s})=>s),f.before.map(({description,...s})=>s),'Only feature descriptions may change');
  }
 }
 const predicates=c.fields.filter(f=>f.value!==undefined).map(f=>`payload#>${q('{'+f.path.join(',')+'}')}=${j(f.value)}`);
 const sql=`select ${q(c.scope+':'+c.key)} as failed where not exists(select 1 from public.${table} where ${where} and ${predicates.join(' and ')}${c.scope==='shared'?'':` and revision=${c.revision+1}`})`;
 if(body.length+sql.length>100000){queries.push(body);body='';}body+=(body?' union all ':'')+sql;
}if(body)queries.push(body);
mkdirSync(root+'verify',{recursive:true});for(const[i,s]of queries.entries())writeFileSync(root+'verify/'+String(i).padStart(2,'0')+'.sql',`select coalesce(jsonb_agg(t.failed),'[]'::jsonb)as failures from (${s})t;`);
writeFileSync(root+'verify/manifest.json',JSON.stringify({queries:queries.length,checkedRows:plan.changes.length}));console.log(JSON.stringify({queries:queries.length,checkedRows:plan.changes.length}));
