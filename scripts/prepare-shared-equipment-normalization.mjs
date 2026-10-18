/** Audit the shared source independently; existing campaign copies are outside this plan. */
import{readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync}from'node:fs';import{createHash}from'node:crypto';import assert from'node:assert/strict';
import{equipmentRetirementCatalog}from'./equipment-retirement-catalog.mjs';import{postgresJsonbText}from'./postgres-jsonb-text.mjs';
const root='tmp/equipment-definitions',base='docs/v2/equipment-retirement-2026-10-18',read=p=>JSON.parse(readFileSync(p,'utf8')),metadata=read(root+'/shared-equipment-metadata.json'),originals=read(root+'/latest-preparation-baseline.json').records.flatMap(r=>r.payload.originals).filter(o=>o.scope==='shared'),md5=v=>createHash('md5').update(postgresJsonbText(v)).digest('hex'),sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stages=['',...readdirSync(base,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='shared'&&existsSync(base+'/'+d.name+'/manifest.json')&&existsSync(base+'/'+d.name+'/verified.json')).map(d=>'/'+d.name)],retired=new Map(stages.flatMap(s=>read(base+s+'/manifest.json').rows.map(r=>[r.key,r]))),catalog=equipmentRetirementCatalog(),active=new Map(catalog.filter(r=>r.payload.rules&&!r.deleted_at&&!retired.has(r.content_key)).map(r=>[r.content_key,r]));
const rows=[],missing=[];
for(const m of metadata){const original=originals.find(o=>o.originalKey===m.metadata.content_key&&md5(o.raw)===m.row_md5);if(!original){missing.push(m.metadata.content_key);continue;}
 assert.equal(md5(original.raw.payload),m.payload_md5);const target=active.get(m.metadata.content_key),official=target?.payload.rules.definition.origin==='official';
 assert.ok(official||retired.has(m.metadata.content_key)||target?.payload.rules.definition.origin==='campaign','Unexplained shared row '+m.metadata.content_key);
 if(official){assert.equal(target.payload.rules.definition.language,'es');assert.ok(target.payload.rules.definition.review.identity&&target.payload.rules.definition.review.editorial,'Unreviewed shared destination '+target.name);}
 const payload=official?structuredClone(target.payload):null;
 if(payload){payload.rules.original={};payload.rules.personalDescription='';payload.rules.pending=[];}
 rows.push({before:original.raw,rowMd5:m.row_md5,sha256:sha(original.raw),action:official?'normalize':'retire',sourceKey:official?target.content_key:null,sourceRowMd5:official?md5(target):null,nextPayloadMd5:payload?md5(payload):null,reason:official?'Definición española revisada y funcional de la misma identidad. Se excluyen del catálogo común las notas e históricos propios de la campaña.':target?'Objeto de campaña conservado en ECE; no se presenta como oficial en campañas nuevas.':retired.get(m.metadata.content_key).decision??'Entrada sustituida o retirada por decisión del GM; originales completos archivados.'});
}
writeFileSync(root+'/shared-equipment-missing-originals.json',JSON.stringify(missing));
assert.equal(missing.length,0,'Some shared rows changed or have no full offline archive');assert.equal(rows.length,1572);
assert.equal(rows.filter(r=>r.action==='normalize').length,757);
mkdirSync(base+'/shared',{recursive:true});const archive={format:'shared-equipment-normalization-archive',schemaVersion:1,baselineEceRevision:1304,rows};writeFileSync(base+'/shared/archive.json',JSON.stringify(archive));writeFileSync(base+'/shared/manifest.json',JSON.stringify({archiveSha256:sha(archive),normalize:757,retire:815,rows:rows.map(({before,...proof})=>({key:before.content_key,name:before.name,...proof}))},null,2));
writeFileSync(root+'/shared-equipment-plan.json',JSON.stringify(archive));console.log(JSON.stringify({fullRowsArchived:rows.length,normalize:757,retire:815,englishToRetire:rows.filter(r=>r.before.content_key.includes(':eng:')).length}));
