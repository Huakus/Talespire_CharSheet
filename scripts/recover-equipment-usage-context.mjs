import{readFileSync,writeFileSync}from"node:fs";import assert from"node:assert/strict";
import{equipmentRetirementCatalog}from"./equipment-retirement-catalog.mjs";
const root="tmp/equipment-definitions",read=p=>JSON.parse(readFileSync(p,"utf8")),prose=read("tmp/pdfs/srd-mundane-prose.json"),preps=read(root+"/latest-preparation-baseline.json").records;
const arcane=new Set(["orb","crystal","rod","staff","wand"]),druid=new Set(["sprig-of-mistletoe","wooden-staff","yew-wand","totem"]),holy=new Set(["amulet","emblem","reliquary"]);
const map={"scale-merchants":"Balanza de mercader","scale-merchant-s":"Balanza de mercader",pouch:"Bolsa"};
const changes=[];
for(const row of equipmentRetirementCatalog().filter(r=>r.payload.rules&&!r.deleted_at)){
 const d=structuredClone(row.payload.rules.definition);if(d.origin!=="official"||d.magical!==false)continue;
 const prep=preps.find(p=>p.payload.definition.id===d.id),original=prep?.payload.originals.find(o=>o.scope==="ECE"&&o.originalKey===d.id.slice(9))?.raw.payload;if(!original)continue;
 const index=original.index,heading=arcane.has(index)?"Canalizador arcano":druid.has(index)?"Canalizador druídico":holy.has(index)?"Símbolo sagrado":index?.startsWith("saddle-")?"Sillas":map[index];if(!heading)continue;
 const source=prose.find(p=>p.name===heading);assert.ok(source,heading);
 const text=source.lines.map(l=>l.text).join(" ").replace(/\s+/g," ").trim();
 if(d.description.some(b=>b.type==="paragraph"&&b.text.replace(/\s+/g," ").trim()===text))continue;
 const sid="srd-5.1-es-usage-context";
 d.sources.push({id:sid,kind:"srd",title:"SRD 5.1 · contexto de uso del equipo · edición oficial española",language:"es",rulesEdition:"2014",locator:`https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf · página PDF ${source.page} · CC BY 4.0`,verified:true});
 d.description.push({id:"official-usage-context",type:"paragraph",section:"rules",provenance:"official-spanish",sourceIds:[sid],text});
 const rename=({"Silla de Motar, Mochila":"Silla de carga","Silla de Montar, Militar":"Silla de montar militar","Bastón Magico":"Bastón arcano"})[d.name];
 if(rename){const previous=d.name;d.name=rename;d.aliases=[...new Set([...d.aliases,previous])];for(const b of d.description)if(b.type==="table")for(const row of b.rows)if(row[0]===previous)row[0]=rename;}
 d.revision++;
 changes.push({key:row.content_key,index,heading,definition:d});
}
assert.ok(changes.length>=12);
writeFileSync(root+"/usage-context-reviews.json",JSON.stringify(changes));
writeFileSync("docs/v2/equipment-retirement-2026-10-18/usage-context-definitions.json",JSON.stringify(changes.map(c=>c.definition)));
console.log(JSON.stringify({definitions:changes.length,groups:[...new Set(changes.map(c=>c.heading))],names:changes.map(c=>c.definition.name)}));
