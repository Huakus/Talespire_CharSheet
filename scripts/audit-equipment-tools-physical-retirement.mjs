import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { equipmentRetirementCatalog } from "./equipment-retirement-catalog.mjs";
const root="tmp/equipment-definitions",base="docs/v2/equipment-retirement-2026-10-18",read=p=>JSON.parse(readFileSync(p,"utf8"));
const rows=equipmentRetirementCatalog(),byKey=new Map(rows.map(r=>[r.content_key,r]));
const removed=new Set(["","/bilingual","/physical","/authoritative"].flatMap(s=>read(base+s+"/manifest.json").rows.map(r=>r.key)));
const reviews=read(`${root}/tools-context-reviews.json`),context=read(base+"/tools-context-source.json"),preps=read(`${root}/latest-preparation-baseline.json`).records;
const pending=read(`${root}/cleanup-analysis.json`).filter(f=>!removed.has(f.key));
const verified=read(base+"/tools-context-verified.json");assert.equal(verified.catalog,37);assert.equal(verified.revision,1292);
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
let unknown;try{({unaccountedLegacyEquipmentPaths:unknown}=await server.ssrLoadModule("/src/domain/equipment/equipment-retirement-evidence.ts"));}finally{await server.close();}
const findings=[];
for(const f of pending){
 const change=reviews.find(s=>f.candidates.length===1&&f.candidates[0].key===s.key);if(!change)continue;
 const old=byKey.get(f.key),p=old.payload,target=byKey.get(change.key),d=target.payload.rules.definition,issues=[];
 assert.deepEqual(d,change.definition);
 const prep=preps.find(r=>r.payload.definition.id===d.id),primary=prep?.payload.originals.find(o=>o.scope==="ECE"&&o.originalKey===d.id.slice(9));
 if(primary?.raw.payload.index!==p.index||change.index!==p.index||d.origin!=="official"||!d.review.identity||!d.review.editorial)issues.push("identity");
 if(!prep?.payload.originals.some(o=>o.scope==="ECE"&&o.originalKey===old.content_key&&d.recoverySourceIds.includes(o.id)))issues.push("recovery-not-linked");
 if(unknown(p).some(path=>!(["dragonchess-set","three-dragon-ante-set"].includes(p.index)&&["/page","/source"].includes(path))))issues.push("unaccounted-field");
 if(p.cost?.quantity!==target.payload.cost.quantity||p.cost?.unit!==target.payload.cost.unit||p.weight!==target.payload.unitWeight)issues.push("price-or-weight");
 for(const key of ["general",change.group])if(!d.description.some(b=>b.type==="paragraph"&&b.text===context.contexts[key].text&&b.sourceIds.some(id=>d.sources.some(s=>s.id===id&&s.verified&&s.language==="es"&&s.rulesEdition==="2014"))))issues.push("missing-primary-context");
 if(!d.sources.some(s=>s.id==="srd-5.1-es-tools-context"&&s.verified&&s.rulesEdition==="2014"&&s.language==="es"))issues.push("unverified-source");
 findings.push({key:f.key,name:f.name,targetKeys:[target.content_key],issues,evidence:{index:p.index,group:change.group,officialSpanishContext:["general",change.group],source:"SRD 5.1 español, PDF 72–73",publishedRevision:1292},decision:"Texto español completado con las reglas generales y específicas oficiales de herramientas, instrumentos o juegos; se conserva la identidad, precio, peso y originales. Las copias de personajes y comercio ya apuntan a la revisión completa. Las etiquetas antiguas de procedencia no son poderes adicionales."});
}
assert.equal(findings.length,37);
for(const f of read(`${root}/physical-audit.json`).filter(f=>!removed.has(f.key))){
 assert.ok(["trident","lance","net","pike"].includes(f.baseIndex));assert.deepEqual(f.targetIssues,[]);assert.equal(f.targetKeys.length,1);
 const d=byKey.get(f.targetKeys[0]).payload.rules.definition,p=byKey.get(f.key).payload;
 if(f.baseIndex==="trident"){
  assert.ok(f.issues.every(i=>["extra-or-different-damage","extra-or-different-versatile-damage"].includes(i)));
  assert.ok(d.weapon.baseDamage.every(e=>e.damageType==="piercing"));assert.equal(p.damage.damage_type.index,"slashing");
 }else if(["lance","net"].includes(f.baseIndex)){
  assert.ok(f.issues.every(i=>i==="special-rule-review"));
  assert.ok(d.description.some(b=>b.id===f.baseIndex+"-special"));
 }else{
  assert.deepEqual(f.issues,["unreviewed-English-prose"]);assert.equal(f.enhancement,0);assert.equal(d.magical,false);
  assert.ok(String(p.description).includes("extra 7 damage"));assert.equal(d.weapon.attackBonus,0);assert.equal(d.weapon.damageBonus,0);
 }
 findings.push({...f,issues:[],evidence:{officialBase:f.baseIndex,enhancement:f.enhancement,originalIssues:f.issues,correction:f.baseIndex==="trident"?"Daño perforante oficial; el cortante inglés era erróneo.":f.baseIndex==="pike"?"Pica normal; la prosa inglesa de arma feroz estaba asignada erróneamente a esta base.":"Regla especial completa ya presente en el bloque español de la misma arma."},decision:"Aplicada la preferencia expresa del GM por la versión oficial de 2014. Se conserva el perfil y regla especial españoles ya cotejados con la fuente, así como el precio existente; se descarta el error normativo de la importación y se conserva íntegro fuera del catálogo."});
}
assert.equal(findings.length,41); // Nine former physical exceptions were already resolved in the authoritative batch.
mkdirSync(base+"/tools-physical",{recursive:true});writeFileSync(`${root}/tools-physical-audit.json`,JSON.stringify(findings,null,2));
const targetKeys=[...new Set(findings.filter(f=>!f.issues.length).flatMap(f=>f.targetKeys))];
writeFileSync(`${root}/tools-physical-destinations-select.sql`,`select to_jsonb(t) as row,md5(to_jsonb(t)::text) as md5 from public.campaign_content_entries t where campaign_id='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd' and kind='equipment' and content_key in(${targetKeys.map(k=>"'"+k+"'").join(",")}) order by content_key;`);
console.log(JSON.stringify({examined:findings.length,safe:findings.filter(f=>!f.issues.length).length,blocked:findings.filter(f=>f.issues.length)}));
