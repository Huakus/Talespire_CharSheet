/** Text-only publication, with identical instance state and guarded linked references. */
import{readFileSync,writeFileSync}from"node:fs";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import{createServer}from"vite";
const root="tmp/equipment-definitions",read=n=>JSON.parse(readFileSync(`${root}/${n}`,"utf8")),cid="9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd",selected=read("tools-context-reviews.json");
const q=s=>`'${String(s).replaceAll("'","''")}'`,j=v=>{const s=JSON.stringify(v),tag="tools_"+createHash("sha256").update(s).digest("hex").slice(0,16);return `$${tag}$${s}$${tag}$::jsonb`;};
const keys=selected.map(r=>q(r.key)).join(","),inventory=`campaign_id=${q(cid)} and fragment_kind='character-inventory' and payload#>>'{catalog,contentKey}' in(${keys})`;
const merchant=`campaign_id=${q(cid)} and kind='monster' and deleted_at is null and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(t.payload->'inventory')='array' then t.payload->'inventory' else '[]'::jsonb end)i where i#>>'{catalog,contentKey}' in(${keys}))`;
const content=`campaign_id=${q(cid)} and kind='equipment' and content_key in(${keys})`;
const version=`campaign_id=${q(cid)} and character_id in(select parent_id from public.campaign_state_fragments where ${inventory})`;
const h=(table,where,order)=>`(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
const hashes={content:h("campaign_content_entries",`((${content})or(${merchant})) is not true`,"campaign_id,kind,content_key"),shared:h("official_content_entries","true","kind,content_key"),fragments:h("campaign_state_fragments",`(${inventory}) is not true`,"campaign_id,fragment_kind,parent_id,entity_id"),versions:h("campaign_character_versions",`(${version}) is not true`,"campaign_id,character_id"),campaigns:h("campaigns",`id<>${q(cid)}`,"id")};
writeFileSync(`${root}/tools-context-select.sql`,`select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),'entries',(select jsonb_agg(to_jsonb(t)) from public.campaign_content_entries t where ${content}),'inventories',coalesce((select jsonb_agg(to_jsonb(t)) from public.campaign_state_fragments t where ${inventory}),'[]'::jsonb),'merchants',coalesce((select jsonb_agg(to_jsonb(t)) from public.campaign_content_entries t where ${merchant}),'[]'::jsonb),'versions',coalesce((select jsonb_agg(to_jsonb(t)) from public.campaign_character_versions t where ${version}),'[]'::jsonb),'guards',jsonb_build_object(${Object.entries(hashes).map(([k,v])=>q(k)+","+v).join(",")})) as snapshot;`);
let before;try{before=read("tools-context-before.json");}catch{console.log("Fetch tools-context-select.sql first.");process.exit(0);}
assert.equal(before.entries.length,selected.length);
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
const definitions=[],fragments=[],merchants=[];
try{
 const{refreshEquipmentEditorialDefinition:refresh}=await server.ssrLoadModule("/src/domain/equipment/equipment-editorial-refresh.ts");
 const{serializeEquipmentContentPayload:serialize}=await server.ssrLoadModule("/src/domain/content/content-payload.ts");
 for(const s of selected){
  const old=before.entries.find(r=>r.content_key===s.key);assert.ok(old);
  const item={...old.payload,id:"inv_00000000000000000000000000000000",order:0,group:"Mochila",catalog:null};
  const next=refresh(item,s.definition,old.name,null),payload=serialize({...next,rarity:s.definition.rarity});
  assert.deepEqual(payload.rules.original,old.payload.rules.original);
  definitions.push({before:old,key:s.key,name:s.definition.name,payload,definition:s.definition,revision:old.revision+1});
 }
 const convert=old=>{
  const target=definitions.find(d=>d.key===old.catalog?.contentKey);if(!target)return old;
  const next=refresh(old,target.definition,target.before.name,{...old.catalog,revision:target.revision});
  const skip=new Set(["name","category","description","catalog","rules"]);
  for(const k of Object.keys(old))if(!skip.has(k))assert.deepEqual(next[k],old[k],k);
  const{definition:_a,...oldRules}=old.rules,{definition:_b,...nextRules}=next.rules;assert.deepEqual(nextRules,oldRules);
  return next;
 };
 for(const r of before.inventories)fragments.push({before:r,payload:convert(r.payload)});
 for(const r of before.merchants)merchants.push({before:r,payload:{...r.payload,inventory:r.payload.inventory.map(convert)}});
}finally{await server.close();}
writeFileSync(`${root}/tools-context-publication.json`,JSON.stringify({revision:before.revision,definitions,fragments,merchants,versions:before.versions}));
const guard=Object.entries(hashes).map(([k,v])=>`if ${v} is distinct from ${q(before.guards[k])} then raise exception ${q("TOOLS_SCOPE_CHANGED:"+k)};end if;`).join("\n");
let mutation="";
for(const d of definitions)mutation+=`if not exists(select 1 from public.campaign_content_entries t where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(d.key)} and to_jsonb(t)=${j(d.before)})then raise exception 'TOOLS_CATALOG_CHANGED';end if;update public.campaign_content_entries set name=${q(d.name)},payload=${j(d.payload)},revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(d.key)};\n`;
for(const r of fragments)mutation+=`if not exists(select 1 from public.campaign_state_fragments t where campaign_id=${q(cid)} and fragment_kind='character-inventory' and parent_id=${q(r.before.parent_id)} and entity_id=${q(r.before.entity_id)} and to_jsonb(t)=${j(r.before)})then raise exception 'TOOLS_COPY_CHANGED';end if;update public.campaign_state_fragments set payload=${j(r.payload)},revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and fragment_kind='character-inventory' and parent_id=${q(r.before.parent_id)} and entity_id=${q(r.before.entity_id)};\n`;
for(const r of merchants)mutation+=`if not exists(select 1 from public.campaign_content_entries t where campaign_id=${q(cid)} and kind='monster' and content_key=${q(r.before.content_key)} and to_jsonb(t)=${j(r.before)})then raise exception 'TOOLS_STOCK_CHANGED';end if;update public.campaign_content_entries set payload=${j(r.payload)},revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and kind='monster' and content_key=${q(r.before.content_key)};\n`;
for(const v of before.versions)mutation+=`if not exists(select 1 from public.campaign_character_versions t where campaign_id=${q(cid)} and character_id=${q(v.character_id)} and to_jsonb(t)=${j(v)})then raise exception 'TOOLS_CHARACTER_CHANGED';end if;update public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and character_id=${q(v.character_id)};\n`;
const sql=`begin;lock table public.campaigns,public.campaign_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share row exclusive mode;lock table public.official_content_entries in share mode;
do $tools$ begin if(select state_revision from public.campaigns where id=${q(cid)})<>${before.revision} then raise exception 'TOOLS_CAMPAIGN_CHANGED';end if;
${guard}\n${mutation}\n${guard}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};
end $tools$;
select jsonb_build_object('catalog',${definitions.length},'copies',${fragments.length},'merchants',${merchants.length},'revision',(select state_revision from public.campaigns where id=${q(cid)})) as result;
commit;`;
writeFileSync(`${root}/tools-context-publication.sql`,sql);writeFileSync(`${root}/tools-context-dry-run.sql`,sql.replace(/commit;$/,"rollback;"));
console.log(JSON.stringify({catalog:definitions.length,copies:fragments.length,merchants:merchants.length,characters:before.versions.length}));
