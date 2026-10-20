import{readFileSync,writeFileSync}from'node:fs';import{equipmentRetirementCatalog}from'./equipment-retirement-catalog.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),audit=read('tmp/equipment-definitions/new-builder-equipment-audit.json'),active=new Set(audit.catalogNames.map(c=>c.key)),rows=equipmentRetirementCatalog().filter(r=>active.has(r.content_key)&&r.payload.rules.definition.origin==='official'&&r.payload.rules.definition.magical===false),bases=read('src/domain/character/phb-srd-equipment.json'),norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const records=read('tmp/equipment-definitions/latest-preparation-baseline.json').records;
const candidates=b=>rows.filter(r=>records.some(record=>record.payload.definition.id===r.payload.rules.definition.id&&record.payload.originals.some(o=>(o.raw.payload?.index??o.raw.index)===b.index))||r.payload.rules.original?.index===b.index||[r.name,...r.payload.rules.definition.aliases].some(n=>norm(n)===norm(b.name)));
const mapped=bases.map(b=>({index:b.index,name:b.name,matches:candidates(b).map(r=>({key:r.content_key,name:r.name}))}));
writeFileSync('tmp/equipment-definitions/builder-equipment-bindings-audit.json',JSON.stringify(mapped));
console.log(JSON.stringify({unique:mapped.filter(r=>r.matches.length===1).length,unmatched:mapped.filter(r=>r.matches.length!==1)},null,2));
