import {readFileSync,writeFileSync,existsSync}from"node:fs";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import { equipmentRetirementCatalog } from "./equipment-retirement-catalog.mjs";
const root="tmp/equipment-definitions",batch=process.argv[2]??"bilingual",revision=Number(process.argv[3]??1288);
assert.match(batch,/^(bilingual|physical|authoritative|tools-physical|xanathar|final-source|usage-retirement|campaign-duplicates|final-corrections|spanish-duplicates)$/);assert.ok(Number.isInteger(revision)&&revision>0);
const out="docs/v2/equipment-retirement-2026-10-18/"+batch;
const read=p=>JSON.parse(readFileSync(p,"utf8"));
const sourceRows=equipmentRetirementCatalog();
const findings=read(`${root}/${batch}-audit${batch==='spanish-duplicates'?'-ready':''}.json`).filter(f=>!f.issues.length);
const stable=v=>Array.isArray(v)?`[${v.map(stable).join(",")}]`:v&&typeof v==="object"?
 `{${Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")}}`:JSON.stringify(v);
const sha=v=>createHash("sha256").update(stable(v)).digest("hex");
const rows=findings.map(f=>{const row=sourceRows.find(r=>r.content_key===f.key);assert.ok(row);return{row,sha256:sha(row),targetKeys:f.targetKeys??[f.targetKey],
 reason:f.decision??"Texto inglés íntegro contenido en la sección primaria del SRD 5.1; sección española completa cotejada; identidad, precio y peso conservados. Las estadísticas importadas se subordinan a las reglas oficiales de 2014.",
 evidence:f.evidence??{baseIndex:f.baseIndex,enhancement:f.enhancement}};});
const archive={format:"equipment-retirement-archive",schemaVersion:1,campaignId:"9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd",baselineRevision:revision,rows,preparationKeys:[],preparations:[]};
const hashesPath=`${root}/${batch}-destination-hashes.json`;
if(existsSync(hashesPath)){
 archive.destinations=read(hashesPath);
 const keys=[...new Set(rows.flatMap(r=>r.targetKeys))];
 assert.equal(archive.destinations.length,keys.length);
 for(const d of archive.destinations){
  assert.ok(keys.includes(d.key));assert.match(d.md5,/^[a-f0-9]{32}$/);
  assert.equal(d.auditedSha256,sha(sourceRows.find(r=>r.content_key===d.key)));
 }
}
writeFileSync(`${out}/archive.json`,JSON.stringify(archive));
writeFileSync(`${out}/manifest.json`,JSON.stringify({campaignId:archive.campaignId,baselineRevision:archive.baselineRevision,archiveSha256:sha(archive),
 rows:rows.map(({row,sha256,...decision})=>({key:row.content_key,name:row.name,sha256,...decision})),preparationKeys:[],preparations:[]},null,2));
writeFileSync(`${root}/${batch}-plan.json`,JSON.stringify(archive));
console.log(JSON.stringify({entries:rows.length,archiveSha256:sha(archive)}));
