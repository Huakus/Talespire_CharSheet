/** Explicit, guarded ECE publication. Generates SQL only; preserves every original. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions", read = (n) => JSON.parse(readFileSync(`${root}/${n}`, "utf8"));
const p = read("owned-migration-publication.json"), cid = "9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd";
assert.equal(p.blocked.length, 0); assert.equal(p.copies.length, 265);
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const json = (value) => { const s = JSON.stringify(value), tag = `owned_${createHash("sha256").update(s).digest("hex").slice(0,16)}`; return `$${tag}$${s}$${tag}$::jsonb`; };
const contentKeys = [...p.definitions.map((d) => d.key), ...p.merchants.map((m) => m.before.content_key)];
const ids = [...p.fragments.map((f) => f.before), ...p.spellFragments].map((f) => [f.fragment_kind,f.parent_id,f.entity_id]);
const owners = p.versions.map((v) => v.character_id);
const hash = (table,where,order) => `(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from public.${table} t where ${where})`;
const hashes = {
  unaffected_content: hash("campaign_content_entries",`not (campaign_id=${q(cid)} and content_key in (${contentKeys.map(q).join(",")}))`,"campaign_id,kind,content_key"),
  shared: hash("official_content_entries","true","kind,content_key"),
  unaffected_fragments: hash("campaign_state_fragments",`not (campaign_id=${q(cid)} and (fragment_kind,parent_id,entity_id) in (${ids.map((a)=>`(${a.map(q).join(",")})`).join(",")}))`,"campaign_id,fragment_kind,parent_id,entity_id"),
  unaffected_versions: hash("campaign_character_versions",`not (campaign_id=${q(cid)} and character_id in (${owners.map(q).join(",")}))`,"campaign_id,character_id"),
  other_campaigns: hash("campaigns",`id<>${q(cid)}`,"id"),
};
writeFileSync(`${root}/owned-migration-guard-query.sql`, `select jsonb_build_object('revision',(select state_revision from public.campaigns where id=${q(cid)}),${Object.entries(hashes).map(([k,s])=>`${q(k)},${s}`).join(",")}) as guard;`);
let guards;
try { guards=read("owned-migration-guards.json"); } catch { console.log("Guard query prepared; fetch its result before generating publication SQL."); process.exit(0); }
assert.equal(guards.revision,p.campaignRevision);
const guard = Object.entries(hashes).map(([k,s])=>`if ${s} is distinct from ${q(guards[k])} then raise exception ${q(`OWNED_SCOPE_CHANGED:${k}`)}; end if;`).join("\n");
const jobs=[]; let batch=[];
for(const definition of p.definitions){ if(batch.length && JSON.stringify([...batch,definition]).length>180000){jobs.push({kind:"catalog",definitions:batch});batch=[];}batch.push(definition); }if(batch.length)jobs.push({kind:"catalog",definitions:batch});
for(const v of p.versions)jobs.push({kind:"character",version:v,fragments:p.fragments.filter((f)=>f.before.parent_id===v.character_id),spells:p.spellFragments.filter((f)=>f.parent_id===v.character_id)});
for(const m of p.merchants)jobs.push({kind:"merchant",merchant:m});
mkdirSync(`${root}/owned-publication-batches`,{recursive:true});
const manifest=[];
for(const [index,job] of jobs.entries()){
 let mutation="";
 if(job.kind==="catalog")for(const d of job.definitions){
   if(d.before) mutation+=`if not exists(select 1 from public.campaign_content_entries t where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(d.key)} and to_jsonb(t)=${json(d.before)}) then raise exception 'OWNED_CATALOG_CONFLICT'; end if;
update public.campaign_content_entries set name=${q(d.name)},origin=${q(d.origin)},tags=ARRAY[${d.tags.map(q).join(",")}],payload=${json(d.payload)},revision=${d.revision},updated_at=statement_timestamp() where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(d.key)};
`;
   else mutation+=`if exists(select 1 from public.campaign_content_entries where campaign_id=${q(cid)} and kind='equipment' and content_key=${q(d.key)}) then raise exception 'OWNED_NEW_KEY_CONFLICT'; end if;
insert into public.campaign_content_entries(campaign_id,kind,content_key,name,origin,tags,payload,revision) values(${q(cid)},'equipment',${q(d.key)},${q(d.name)},${q(d.origin)},ARRAY[${d.tags.map(q).join(",")}],${json(d.payload)},${d.revision});
`;
 }
 if(job.kind==="character"){
   const v=job.version;
   mutation+=`if not exists(select 1 from public.campaign_character_versions t where campaign_id=${q(cid)} and character_id=${q(v.character_id)} and to_jsonb(t)=${json(v)}) then raise exception 'OWNED_CHARACTER_CONFLICT'; end if;\n`;
   for(const f of job.fragments){const b=f.before;mutation+=`if not exists(select 1 from public.campaign_state_fragments t where campaign_id=${q(cid)} and fragment_kind=${q(b.fragment_kind)} and parent_id=${q(b.parent_id)} and entity_id=${q(b.entity_id)} and to_jsonb(t)=${json(b)}) then raise exception 'OWNED_FRAGMENT_CONFLICT'; end if;
update public.campaign_state_fragments set payload=${json(f.after.payload)},revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and fragment_kind=${q(b.fragment_kind)} and parent_id=${q(b.parent_id)} and entity_id=${q(b.entity_id)};
`;}
   for(const s of job.spells)mutation+=`insert into public.campaign_state_fragments(campaign_id,fragment_kind,parent_id,entity_id,position,payload,revision) values(${q(cid)},${q(s.fragment_kind)},${q(s.parent_id)},${q(s.entity_id)},${s.position},${json(s.payload)},0);\n`;
   mutation+=`update public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and character_id=${q(v.character_id)};\n`;
 }
 if(job.kind==="merchant"){const m=job.merchant,b=m.before;assert.deepEqual({...m.payload,inventory:b.payload.inventory},b.payload);mutation+=`if not exists(select 1 from public.campaign_content_entries t where campaign_id=${q(cid)} and kind='monster' and content_key=${q(b.content_key)} and to_jsonb(t)=${json(b)}) then raise exception 'OWNED_MERCHANT_CONFLICT'; end if;
update public.campaign_content_entries set payload=${json(m.payload)},revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and kind='monster' and content_key=${q(b.content_key)};
`;}
 const sql=`begin;
lock table public.campaigns,public.campaign_content_entries,public.campaign_state_fragments,public.campaign_character_versions in share row exclusive mode;
lock table public.official_content_entries in share mode;
do $publish$ begin
if (select state_revision from public.campaigns where id=${q(cid)})<>${p.campaignRevision+index} then raise exception 'OWNED_CAMPAIGN_CHANGED'; end if;
${guard}
${mutation}
${guard}
update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};
end $publish$;
select jsonb_build_object('batch',${index},'kind',${q(job.kind)},'revision',(select state_revision from public.campaigns where id=${q(cid)})) as result;
commit;`;
 const file=`${root}/owned-publication-batches/batch-${index}.sql`;writeFileSync(file,sql);manifest.push({index,kind:job.kind,file,bytes:Buffer.byteLength(sql),character:job.version?.character_id??null});
}
writeFileSync(`${root}/owned-publication-manifest.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify({batches:manifest.length,maxBytes:Math.max(...manifest.map((f)=>f.bytes)),catalog:p.definitions.length,inventory:p.copies.length}));
