/** Bounded review of imported flavor, superseded by official 2014 equipment tables. */
import {readFileSync,writeFileSync}from"node:fs";
import assert from"node:assert/strict";
const rows=[0,1,2,3].flatMap(n=>JSON.parse(readFileSync(`tmp/equipment-definitions/cleanup-live-${n}.json`,"utf8")));
const bases=JSON.parse(readFileSync("src/domain/character/phb-srd-equipment.json","utf8")).filter(x=>x.weapon_category);
const reviewed=bases.map(b=>{
 const row=rows.find(x=>x.tags.includes("eng")&&x.payload.index===b.index&&x.name===b.name);
 assert.ok(row,b.index);
 const text=b.index==="pike"?"A long, spear-like polearm designed for thrusting, with a sharp point ideal for keeping enemies at a distance.":row.payload.description??row.payload.desc??"";
 // Each of these 37 paragraphs was read explicitly. These are non-official
 // introductions, some containing misleading claims (light crossbow one-handed,
 // flail bypassing armor, morningstar two damage types). No such bonus is kept.
 return{baseIndex:b.index,name:b.name,text,decision:"Sustituir la introducción importada por las estadísticas y propiedades oficiales de 2014. No conceder efectos por alusiones descriptivas a armaduras, rapidez, barridos o bloqueos.",source:"SRD 5.1 (2014), tabla de armas y reglas de propiedades."};
});
writeFileSync("docs/v2/equipment-retirement-2026-10-18/weapon-prose-review.json",JSON.stringify(reviewed,null,2));
console.log(JSON.stringify({paragraphs:reviewed.length}));
