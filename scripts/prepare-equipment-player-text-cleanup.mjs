import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{createServer}from'vite';
const root='docs/v2/equipment-editorial-cleanup-2026-11-01/',read=n=>JSON.parse(readFileSync(root+n,'utf8'));
const catalog=Array.from({length:16},(_,n)=>read('before-'+String(n).padStart(2,'0')+'.json')).flat(),inventory=read('inventory-before.json'),merchants=read('merchants-before.json');
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const{cleanEquipmentPlayerText:clean}=await server.ssrLoadModule('/src/domain/equipment/equipment-player-content.ts');
 const replacements=new Map(),changes=[];
 function edits(r){
  const doss=/Laúd.*Doss/.test(r.name),previous=r.blocks??[];
  let blocks=previous.filter(b=>b.section!=='gm-notes').flatMap(b=>{
   if(b.type==='table')return [{...b,columns:b.columns.map(clean),rows:b.rows.map(row=>row.map(clean))}];
   if(b.type==='list'){const items=b.items.map(clean).filter(Boolean);return items.length?[{...b,items}]:[];}
   let text=clean(b.text);
   if(doss&&b.id==='current-description')text='Laúd de Doss de los Instrumentos de los Bardos. Requiere sintonización por un bardo.';
   if(doss&&b.id==='recovered-campaign-description')text=clean(b.text.replaceAll('\\n','\n').split(/\bHistoria\s*/)[1]?.split(/\bBeneficios\s*/)[0]??'');
   return text?[{...b,text}]:[];
  });
  const seen=new Set();blocks=blocks.filter(b=>{const key=JSON.stringify({...b,id:'',sourceIds:[],provenance:''});if(seen.has(key))return false;seen.add(key);return true;});
  if(!blocks.length&&previous.length){const b=previous[0];blocks=[{id:'player-description',section:'description',type:'paragraph',provenance:'campaign',sourceIds:b.sourceIds,text:r.name.replace(/ · [^·]+$/,'')+'.'}];}
  let description=clean(r.description??'');
  if(doss)description=blocks.map(b=>b.text??b.items?.join('\n')??'').join('\n\n');
  if(!description&&blocks.length)description=blocks.map(b=>b.text??b.items?.join('\n')??[b.columns.join(' · '),...b.rows.map(row=>row.join(' · '))].join('\n')).join('\n\n');
  let personalDescription=clean(r.personalDescription??'');
  if(doss)personalDescription='';
  const features=(r.features??[]).map(f=>({...f,description:doss&&f.id==='preserved-personal-rule'?description:clean(f.description)}));
  const fields=[];
  if(description!==(r.description??''))fields.push({path:['description'],before:r.description,value:description});
  if(JSON.stringify(features)!==JSON.stringify(r.features??[]))fields.push({path:['features'],before:r.features,value:features});
  if(r.blocks&&JSON.stringify(blocks)!==JSON.stringify(r.blocks))fields.push({path:['rules','definition','description'],before:r.blocks,value:blocks});
  if(r.personalDescription!=null&&personalDescription!==r.personalDescription)fields.push({path:['rules','personalDescription'],before:r.personalDescription,value:personalDescription});
  return {fields,blocks};
 }
 for(const r of catalog){const edit=edits(r);if(edit.fields.length){changes.push({...r,fields:edit.fields,newBlocks:edit.blocks});replacements.set(r.scope+':'+r.key,true);}}
 const revisedCatalog=new Map(changes.filter(c=>c.scope==='ece').map(c=>[c.key,c.revision+1]));
 for(const r of inventory){const edit=edits(r);if(revisedCatalog.has(r.catalogKey))edit.fields.push({path:['catalog','revision'],before:r.catalogRevision,value:revisedCatalog.get(r.catalogKey)});if(edit.fields.length)changes.push({...r,fields:edit.fields,newBlocks:edit.blocks});}
 for(const r of merchants){const fields=[];for(const[i,item]of r.inventory.entries()){const edit=edits(item);if(revisedCatalog.has(item.catalogKey))edit.fields.push({path:['catalog','revision'],before:item.catalogRevision,value:revisedCatalog.get(item.catalogKey)});for(const f of edit.fields)fields.push({...f,path:['inventory',String(i),...f.path]});if(edit.fields.some(f=>f.path.join('.')==='rules.definition.description'))fields.push({path:['inventory',String(i),'rules','definition','capabilities'],blockRefs:edit.blocks.map(b=>b.id)});}
  if(fields.length)changes.push({...r,fields});
 }
 for(const c of changes)if(c.fields.some(f=>f.path.join('.')==='rules.definition.description'))c.fields.push({path:['rules','definition','capabilities'],blockRefs:c.newBlocks.map(b=>b.id)});
 const stats={reviewed:catalog.length,changed:Object.fromEntries(['ece','shared','inventory','merchant'].map(s=>[s,changes.filter(c=>c.scope===s).length])),emptyDescriptions:changes.filter(c=>c.fields.some(f=>f.path.join('.')==='description'&&f.value==='')).map(c=>c.name)};
 writeFileSync(root+'plan.json',JSON.stringify({stats,changes}));
 // Restrict updates to text and references to the retained rule blocks. No quantities or mechanics.
 const q=s=>`'${String(s).replaceAll("'","''")}'`,j=v=>{const s=JSON.stringify(v),tag='text_'+createHash('sha256').update(s).digest('hex').slice(0,16);return `$${tag}$${s}$${tag}$::jsonb`;},cid='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd';
 mkdirSync(root+'batches',{recursive:true});const batches=[];let body='',count=0,characterIds=new Set();
 const flush=()=>{if(!count)return;batches.push({body,count,characterIds:[...characterIds]});body='';count=0;characterIds=new Set();};
 for(const c of changes){
  const table=c.scope==='shared'?'official_content_entries':c.scope==='inventory'?'campaign_state_fragments':'campaign_content_entries';
  const where=c.scope==='shared'?`kind='equipment' and content_key=${q(c.key)}`:c.scope==='inventory'?`campaign_id=${q(cid)} and fragment_kind='character-inventory' and parent_id=${q(c.parentId)} and entity_id=${q(c.key)}`:`campaign_id=${q(cid)} and kind=${q(c.scope==='merchant'?'monster':'equipment')} and content_key=${q(c.key)}`;
  let expr='payload';
  for(const f of c.fields){
   assert.ok(f.path[0]==='description'||f.path[0]==='features'||f.path[0]==='rules'||f.path[0]==='inventory'||f.path.join('.')==='catalog.revision');
   const path=q('{'+f.path.join(',')+'}');
   let value;
   if(f.blockRefs){const source=`payload#>${path}`,ids=j(f.blockRefs),fallback=q(f.blockRefs[0]);value=`(select coalesce(jsonb_agg(cap||jsonb_build_object('textBlockIds',coalesce((select jsonb_agg(id) from jsonb_array_elements_text(cap->'textBlockIds')id where ${ids}?id),jsonb_build_array(${fallback})))),'[]'::jsonb) from jsonb_array_elements(${source})cap)`;}
   else value=j(f.value);
   expr=`jsonb_set(${expr},${path},${value},true)`;
  }
  const stmt=`if not exists(select 1 from public.${table} t where ${where} and md5(to_jsonb(t)::text)=${q(c.hash)})then raise exception 'ITEM_TEXT_CONFLICT:${c.scope}:${c.key}';end if;update public.${table} set payload=${expr}${c.scope==='shared'?'':',revision=revision+1,updated_at=statement_timestamp()'} where ${where};\n`;
  if(body.length+stmt.length>100000)flush();body+=stmt;count++;if(c.scope==='inventory')characterIds.add(c.parentId);
 }flush();
 const affected=inventory.filter(i=>changes.some(c=>c.scope==='inventory'&&c.key===i.key&&c.parentId===i.parentId)).map(i=>i.parentId),ids=[...new Set(affected)];
 for(const[i,b]of batches.entries())writeFileSync(root+'batches/'+String(i).padStart(2,'0')+'.sql',`begin;lock table public.campaigns,public.campaign_content_entries,public.campaign_state_fragments,public.campaign_character_versions,public.official_content_entries in share row exclusive mode;do $text$ begin if(select state_revision from public.campaigns where id=${q(cid)})<>${1704+i} then raise exception 'ITEM_TEXT_CAMPAIGN_CONFLICT';end if;${b.body}\nupdate public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};${b.characterIds.length?`update public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and character_id in(${b.characterIds.map(q).join(',')});`:''}end $text$;select ${i} as batch,${b.count} as rows,(select state_revision from public.campaigns where id=${q(cid)})as revision;commit;`);
 writeFileSync(root+'manifest.json',JSON.stringify({stats,batches:batches.map((b,i)=>({index:i,rows:b.count,expectedRevision:1704+i})),affectedCharacters:ids},null,2));
 console.log(JSON.stringify({...stats,batches:batches.length}));
}finally{await server.close();}
