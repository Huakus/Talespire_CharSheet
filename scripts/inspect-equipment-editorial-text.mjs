import{readFileSync}from'node:fs';
const root='docs/v2/equipment-editorial-cleanup-2026-11-01/',rows=Array.from({length:16},(_,i)=>JSON.parse(readFileSync(root+'before-'+String(i).padStart(2,'0')+'.json','utf8'))).flat();
const matches=new Map();
for(const r of rows){for(const text of [r.description,r.personalDescription,...(r.features??[]).map(f=>f.description),...(r.blocks??[]).flatMap(b=>b.text??b.items??[])]){for(const p of (text??'').replaceAll('\\n','\n').split(/\n\s*\n/)){if(/conservad|conservar|cotej|versi[oó]n|falta |migr|antigu|pendiente|original|^fuente|^notas|se corrige/i.test(p)&&p.length<1400){const value=p.replace(/original:[a-f0-9]+/g,'original:HASH');const v=matches.get(value)??{count:0,examples:[]};v.count++;if(v.examples.length<2)v.examples.push(r.name);matches.set(value,v);}}}}
console.log(JSON.stringify([...matches].sort((a,b)=>b[1].count-a[1].count).slice(0,65),null,2));
