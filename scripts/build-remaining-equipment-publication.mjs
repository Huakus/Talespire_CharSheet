/** Activate Spanish catalog snapshots without changing possessions. Generates SQL only. */
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {createServer} from "vite";
const root="tmp/equipment-definitions",read=(n)=>JSON.parse(readFileSync(`${root}/${n}`,"utf8")),cid="9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
const prefix=process.argv[2]??"remaining-catalog";
assert.match(prefix,/^[a-z-]+$/);
const selected=read(`${prefix}-selection.json`),before=read(`${prefix}-before.json`);
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
const changes=[];
try{
 const {bindReviewedEquipment}=await server.ssrLoadModule("/src/domain/equipment/equipment-live.ts");
 const {normalizeEquipmentDefinition}=await server.ssrLoadModule("/src/domain/equipment/equipment-catalog.ts");
 const {serializeEquipmentContentPayload}=await server.ssrLoadModule("/src/domain/content/content-payload.ts");
 for(const row of selected){
  const previous=before.find((p)=>p.content_key===row.key);assert.ok(previous,row.key);
  assert.ok(previous.tags.includes("es")&&!previous.tags.includes("en"),row.key);
  const template=normalizeEquipmentDefinition(previous.payload), d=row.definition;
  const item=bindReviewedEquipment({...template,id:"inv_00000000000000000000000000000000",order:0,group:"backpack"},d);
  item.quantity=1;item.equipped=false;item.attuned=false;if(item.charges)item.charges.current=item.charges.maximum;if(item.rules.storage)item.rules.storage={known:true,spells:[]};
  if(d.economy.basePrice)item.cost=d.economy.basePrice;else if(d.economy.campaignPrice)item.cost=d.economy.campaignPrice;
  item.rules.pending=item.rules.pending.filter((n)=>!n.includes("no había contador válido"));
  const{id:_id,order:_order,group:_group,...draft}=item;
  const payload=serializeEquipmentContentPayload({...draft,rarity:d.rarity??"none"});
  changes.push({before:previous,key:row.key,name:d.name,tags:["es",d.review.mechanics?"revisado":"texto_revisado",d.origin==="campaign"?"custom":"reglas_2014"],payload,revision:previous.revision+1});
 }
}finally{await server.close();}
assert.equal(new Set(changes.map((c)=>c.key)).size,changes.length);
writeFileSync(`${root}/${prefix}-publication.json`,JSON.stringify(changes));
const q=(s)=>`'${String(s).replaceAll("'","''")}'`,j=(v)=>{const s=JSON.stringify(v),tag=`rest_${createHash("sha256").update(s).digest("hex").slice(0,16)}`;return `$${tag}$${s}$${tag}$::jsonb`;};
const h=(table,where,order)=>`(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
const hashes={content:h("campaign_content_entries",`not(campaign_id=${q(cid)} and kind='equipment' and content_key in(${changes.map((c)=>q(c.key)).join(",")}))`,"campaign_id,kind,content_key"),shared:h("official_content_entries","true","kind,content_key"),fragments:h("campaign_state_fragments","true","campaign_id,fragment_kind,parent_id,entity_id"),versions:h("campaign_character_versions","true","campaign_id,character_id"),campaigns:h("campaigns",`id<>${q(cid)}`,"id")};
writeFileSync(`${root}/${prefix}-guard-query.sql`,`select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),${Object.entries(hashes).map(([k,v])=>`${q(k)},${v}`).join(",")}) as guard;`);
let guards;try{guards=read(`${prefix}-guards.json`);}catch{console.log(JSON.stringify({selected:changes.length,mode:"guard-query-ready"}));process.exit(0);}
const guard=Object.entries(hashes).map(([k,v])=>`if ${v} is distinct from ${q(guards[k])} then raise exception ${q(`REST_SCOPE_CONFLICT:${k}`)}; end if;`).join("\n");
const batches=[];let batch=[];for(const c of changes){if(batch.length&&JSON.stringify([...batch,c]).length>180000){batches.push(batch);batch=[];}batch.push(c);}if(batch.length)batches.push(batch);
mkdirSync(`${root}/${prefix}-batches`,{recursive:true});const manifest=[];
for(const [index,rows] of batches.entries()){
 const sql=`begin;
lock table public.campaigns,public.campaign_content_entries in share row exclusive mode;
lock table public.official_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share mode;
do $rest$ begin
if(select state_revision from public.campaigns where id=${q(cid)})<>${guards.revision+index} then raise exception 'REST_CAMPAIGN_CHANGED';end if;
${guard}
${rows.map((r)=>`if not exists(select 1 from public.campaign_content_entries t where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(r.key)} and to_jsonb(t)=${j(r.before)})then raise exception 'REST_CATALOG_CONFLICT';end if;
update public.campaign_content_entries set name=${q(r.name)},tags=ARRAY[${r.tags.map(q).join(",")}],payload=${j(r.payload)},revision=${r.revision},updated_at=statement_timestamp() where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(r.key)};`).join("\n")}
${guard}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};
end $rest$;
select jsonb_build_object('batch',${index},'updated',${rows.length},'revision',(select state_revision from public.campaigns where id=${q(cid)})) as result;
commit;`;
 const file=`${root}/${prefix}-batches/batch-${index}.sql`;writeFileSync(file,sql);manifest.push({index,file,count:rows.length,bytes:Buffer.byteLength(sql)});
}
writeFileSync(`${root}/${prefix}-manifest.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify({definitions:changes.length,batches:manifest.length,largest:Math.max(...manifest.map((b)=>b.bytes))}));
