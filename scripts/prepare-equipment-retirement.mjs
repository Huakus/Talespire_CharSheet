/** Prepare a finite, lossless cleanup. No connection, deletion or inferred translation. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root="tmp/equipment-definitions",out="docs/v2/equipment-retirement-2026-10-18";
const read=n=>JSON.parse(readFileSync(`${root}/${n}`,"utf8"));
const rows=[0,1,2,3].flatMap(n=>read(`cleanup-live-${n}.json`));
const preparations=read("latest-preparation-baseline.json").records;
const live=rows.filter(r=>r.payload.rules?.definition&&!r.deleted_at),retired=rows.filter(r=>r.deleted_at);
const stable=v=>Array.isArray(v)?`[${v.map(stable).join(",")}]`:v&&typeof v==="object"?
  `{${Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")}}`:JSON.stringify(v);
const sha=v=>createHash("sha256").update(stable(v)).digest("hex");
const archived=new Map();
for(const p of preparations)for(const a of p.payload.originals)if(a.scope==="ECE"){
  archived.set(a.originalKey,[...(archived.get(a.originalKey)??[]),{preparation:p,archive:a}]);
}
const plan=[];
for(const row of retired) {
  assert.equal(row.tags.includes("retirado_por_version_oficial"),true);
  const targetKeys=row.payload.index==="belt-of-giant-strength"?live.filter(r=>r.name.startsWith("Cinturón de fuerza de gigante")).map(r=>r.content_key):[];
  if(row.payload.index==="belt-of-giant-strength")assert.equal(targetKeys.length,6);
  plan.push({row,targetKeys,reason:"Retirada explícita del GM o variante inválida ya resuelta; la fila estaba dada de baja.",evidence:"EQUIPMENT_OFFICIAL_RESOLUTION_2026-10-18.md; EQUIPMENT_CAMPAIGN_RESOLUTION_2026-10-18.md"});
}
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
try{
  const {simpleEquipmentReplacementIssues}=await server.ssrLoadModule("/src/domain/equipment/equipment-retirement.ts");
  for(const row of rows.filter(r=>r.tags.includes("eng")&&!r.deleted_at)){
    const sources=archived.get(row.content_key)??[];
    assert.ok(sources.some(s=>stable(s.archive.raw.payload)===stable(row.payload)),`Fresh original mismatch: ${row.name}`);
    const candidates=live.filter(l=>sources.some(s=>s.preparation.payload.definition.id===l.payload.rules.definition.id));
    const discarded=sources.map(s=>retired.find(r=>s.preparation.payload.definition.id===`recovery:${r.content_key}`)).filter(Boolean);
    if(!candidates.length&&discarded.length){
      const belts=row.payload.index==="belt-of-giant-strength"?live.filter(r=>r.name.startsWith("Cinturón de fuerza de gigante")).map(r=>r.content_key):[];
      if(row.payload.index==="belt-of-giant-strength")assert.equal(belts.length,6);
      plan.push({row,targetKeys:belts,reason:"Versión inglesa del objeto cuya retirada o sustitución ya decidió el GM.",evidence:discarded.map(r=>r.content_key).join(",")});
    }else if(candidates.length===1&&sources.some(s=>candidates[0].payload.rules.definition.recoverySourceIds.includes(s.archive.id))&&!simpleEquipmentReplacementIssues(row.payload,candidates[0].payload.rules.definition).length){
      plan.push({row,targetKeys:[candidates[0].content_key],reason:"Duplicado de tabla sin prosa ni poderes adicionales: identidad cotejada, clasificación, precio, peso y estadísticas representados en español.",evidence:candidates[0].payload.rules.definition.id});
    }
  }
}finally{await server.close();}
assert.equal(new Set(plan.map(x=>x.row.content_key)).size,plan.length);
const prepKeys=preparations.filter(p=>
  plan.some(x=>x.row.deleted_at&&p.payload.definition.id===`recovery:${x.row.content_key}`)||
  plan.some(x=>x.targetKeys.length===1&&live.some(l=>l.content_key===x.targetKeys[0]&&p.payload.definition.id===l.payload.rules.definition.id))
).filter(p=>!live.some(l=>l.payload.rules.definition.id===p.payload.definition.id)&&
 !plan.some(x=>x.targetKeys.some(k=>live.find(l=>l.content_key===k)?.payload.rules.definition.id===p.payload.definition.id)))
 .map(p=>p.catalog.contentKey);
// Retire stale preparations for explicitly withdrawn entries only. Other recovery
// workspaces remain until their separate Spanish/shared source accounting closes.
mkdirSync(out,{recursive:true});
const archive={format:"equipment-retirement-archive",schemaVersion:1,campaignId:"9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd",baselineRevision:1287,
 rows:plan.map(x=>({sha256:sha(x.row),...x})),preparationKeys:prepKeys,preparations:[]};
if(existsSync(`${root}/cleanup-preparations.json`)){
 const captured=read("cleanup-preparations.json");
 assert.equal(captured.length,prepKeys.length);
 for(const row of captured){
   assert.ok(prepKeys.includes(row.content_key));
   const baseline=preparations.find(p=>p.catalog.contentKey===row.content_key);
   assert.equal(stable(row.payload),stable(baseline.payload));
   assert.equal(row.revision,baseline.catalog.revision);
   archive.preparations.push({row,sha256:sha(row)});
 }
}
writeFileSync(`${out}/archive.json`,JSON.stringify(archive));
const manifest={campaignId:archive.campaignId,baselineRevision:archive.baselineRevision,archiveSha256:sha(archive),rows:archive.rows.map(({row,sha256,...decision})=>({key:row.content_key,name:row.name,sha256,...decision})),preparations:archive.preparations.map(p=>({key:p.row.content_key,sha256:p.sha256})),preparationKeys:prepKeys};
writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
writeFileSync(`${root}/cleanup-plan.json`,JSON.stringify(archive));
console.log(JSON.stringify({entries:plan.length,oldSpanish:plan.filter(x=>x.row.deleted_at).length,english:plan.filter(x=>!x.row.deleted_at).length,preparationsRequested:prepKeys.length,remainingEnglish:rows.filter(r=>r.tags.includes("eng")&&!r.deleted_at&&!plan.some(x=>x.row.content_key===r.content_key)).length,archiveSha256:manifest.archiveSha256}));
