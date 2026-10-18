import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import assert from'node:assert/strict';
import{equipmentRetirementCatalog}from'./equipment-retirement-catalog.mjs';
const root='tmp/equipment-definitions',read=n=>JSON.parse(readFileSync(root+'/'+n,'utf8')),audit=read('spanish-duplicates-audit.json'),live=read('spanish-duplicates-live.json'),rows=equipmentRetirementCatalog();
const stable=v=>Array.isArray(v)?`[${v.map(stable)}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k]))}}`:JSON.stringify(v);
const body=b=>b.type==='paragraph'?b.text:b.type==='list'?b.items.join(' '):JSON.stringify([b.columns.map(c=>c==='Bonificación mágica al ataque'?'Bonificación mágica':c),b.rows]);
const findings=[];
for(const f of audit){assert.equal(f.differences.length,0,f.name);const pair=f.keys.map(k=>live.entries.find(r=>r.content_key===k));for(const r of pair)assert.equal(stable(r),stable(rows.find(s=>s.content_key===r.content_key)),'Fresh full catalog row differs');
 const cp=r=>r.payload.cost.quantity*({cp:1,sp:10,ep:50,gp:100,pp:1000})[r.payload.cost.unit];
 pair.sort((a,b)=>cp(b)-cp(a)||a.content_key.localeCompare(b.content_key));const [target,old]=pair;
 const a=target.payload.rules.definition,b=old.payload.rules.definition;
 const content=d=>d.description.filter(b=>b.section!=='gm-notes').map(body).map(s=>s.replace(/\s+/g,' ').trim()).sort();
 assert.deepEqual(content(a),content(b),f.name+' source prose differs');
 const refs=[...live.references,...live.merchantReferences].filter(r=>r.key===old.content_key);
 findings.push({key:old.content_key,name:old.name,targetKeys:[target.content_key],issues:[],references:refs,evidence:[{kind:'identical-spanish-rules-and-mechanics',compared:f.keys,prices:pair.map(r=>({key:r.content_key,price:r.payload.cost})),decision:'Misma identidad oficial, requisitos, estadísticas y texto de reglas. Se conserva el precio de catálogo de la variante mágica ya existente; los precios de las copias se preservan. Ambas filas completas quedan archivadas fuera del catálogo activo.'}],decision:'Duplicado español con reglas y estadísticas idénticas. Reasignar las copias a la definición conservada antes de eliminar la fila redundante.'});
}
mkdirSync('docs/v2/equipment-retirement-2026-10-18/spanish-duplicates',{recursive:true});
writeFileSync(root+'/spanish-duplicates-audit-ready.json',JSON.stringify(findings,null,2));
writeFileSync(root+'/spanish-duplicates-references.json',JSON.stringify(findings.filter(f=>f.references.length)));
console.log(JSON.stringify({duplicates:findings.length,references:findings.flatMap(f=>f.references),choices:findings.map(f=>({name:f.name,from:f.key,to:f.targetKeys[0]}))}));
