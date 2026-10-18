import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';import{createHash}from'node:crypto';import assert from'node:assert/strict';
import{postgresJsonbText}from'./postgres-jsonb-text.mjs';import{equipmentRetirementCatalog}from'./equipment-retirement-catalog.mjs';
const root='tmp/equipment-definitions',base='docs/v2/equipment-retirement-2026-10-18',read=p=>JSON.parse(readFileSync(p,'utf8')),metadata=read(root+'/preparation-retirement-metadata.json'),baseline=read(root+'/latest-preparation-baseline.json').records;
const md5=s=>createHash('md5').update(s).digest('hex'),sha=s=>createHash('sha256').update(s).digest('hex');
const stages=['','/bilingual','/physical','/authoritative','/tools-physical','/xanathar','/final-source','/usage-retirement','/campaign-duplicates','/final-corrections','/spanish-duplicates'];
const manifests=stages.map(s=>read(base+s+'/manifest.json')),retired=new Map(manifests.flatMap(m=>m.rows.map(r=>[r.key,r.targetKeys]))),active=new Map(equipmentRetirementCatalog().filter(r=>r.payload.rules&&!retired.has(r.content_key)).map(r=>[r.payload.rules.definition.id,r]));
const rows=[],mismatches=[];
for(const m of metadata){const b=baseline.find(b=>b.catalog.contentKey===m.metadata.content_key);assert.ok(b,m.metadata.content_key);const payload=b.payload;
 if(md5(postgresJsonbText(payload))!==m.payload_md5){mismatches.push(m.metadata.content_key);continue;}
 const row={...m.metadata,payload};assert.equal(md5(postgresJsonbText(row)),m.row_md5,m.metadata.content_key+' row hash');
 const d=payload.definition,direct=active.get(d.id),oldKey=d.id.startsWith('recovery:')?d.id.slice(9):'gm:equipment:owned:'+d.id;
 const targets=direct?[direct.content_key]:retired.get(oldKey);assert.ok(targets,'Missing preparation destination '+oldKey);
 assert.ok(targets.every(k=>[...active.values()].some(r=>r.content_key===k)),'Destination no longer active');
 rows.push({row,payloadMd5:m.payload_md5,rowMd5:m.row_md5,sha256:sha(JSON.stringify(row)),targetKeys:targets});
}
writeFileSync(root+'/preparation-retirement-mismatches.json',JSON.stringify(mismatches));
if(mismatches.length){console.log(JSON.stringify({matched:rows.length,mismatches:mismatches.length,examples:mismatches.slice(0,5)}));process.exit(1);}
assert.equal(rows.length,833);mkdirSync(base+'/preparations',{recursive:true});
writeFileSync(base+'/preparations/archive.json',JSON.stringify({format:'equipment-preparation-retirement-archive',campaignId:'9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd',baselineRevision:1302,rows}));
writeFileSync(base+'/preparations/manifest.json',JSON.stringify({baselineRevision:1302,archiveSha256:sha(readFileSync(base+'/preparations/archive.json')),rows:[],preparationKeys:rows.map(r=>r.row.content_key),preparations:rows.map(r=>({key:r.row.content_key,sha256:r.sha256,rowMd5:r.rowMd5,targetKeys:r.targetKeys}))},null,2));
console.log(JSON.stringify({archived:rows.length,allFullPayloadHashesMatch:true}));
