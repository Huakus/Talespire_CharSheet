import{readFileSync,writeFileSync,mkdirSync}from"node:fs";import assert from"node:assert/strict";import{createHash}from"node:crypto";
import{equipmentRetirementCatalog}from"./equipment-retirement-catalog.mjs";
const root="tmp/equipment-definitions",base="docs/v2/equipment-retirement-2026-10-18",read=p=>JSON.parse(readFileSync(p,"utf8"));
const rows=equipmentRetirementCatalog(),byKey=new Map(rows.map(r=>[r.content_key,r])),retired=new Set(["","/bilingual","/physical","/authoritative","/tools-physical","/xanathar","/final-source","/usage-retirement"].flatMap(s=>read(base+s+"/manifest.json").rows.map(r=>r.key)));
const cases={
 "cloak-of-charisma-1":"Carisma +1, máximo 20 y efecto derivado sobre lanzamiento por Carisma: la versión española incluye todas las condiciones y ambientación.",
 "wand-of-annoyance":"Ambas importaciones se sustituyen por la regla de campaña expresamente consolidada por autorización del GM: 3 cargas al amanecer, CD 14, alcance 30 pies y fastidio definido. Peso y rareza siguen la decisión consolidada.",
 "reaper-s-shadow":"Texto español completo de velo, marca, concentración, presencia y fatalismo. INT +1 y recuperación al amanecer confirmados por el GM prevalecen sobre el resumen inglés.",
 "lucent-crystal":"La versión española contiene el consumo, recuperación de espacio, PG temporales, curación en el templo, corrupción, identificación, destrucción y mecanismos del resumen inglés, con más detalle.",
 "wizard-amulet":"Bono +2 a Arcano al llevarlo puesto y ambientación íntegramente presentes en español.",
 jewelry:"La descripción inglesa solo dice Jewelry; Joyas conserva su contenido, precio y peso sin añadir poderes.",
 "wand-of-mage-armor":"Conjuro Armadura de mago, exención material, acción, 3 cargas, recarga 1d6+1 al amanecer y destrucción con 1 al gastar la última carga, completos en español.",
 "lucent-core":"Regla Adaptada de campaña ya consolidada: se conservan las tres resonancias, tiempos, costes, requisito de herramientas, recarga con cristal y desgaste/reparación. Corrige el campo antiguo de descanso corto, peso y rareza según la decisión publicada.",
 "agati-s-robe":"CA +3 mientras se viste; no es armadura ni impide lanzar conjuros. El español conserva también la historia de Agati.",
 "staff-of-haste":"Historia de Isadora, conjuro Acelerar una vez por descanso largo y perfil de bastón conservados en español.",
 "reserve-crystal":"Tres cargas, recuperación 1d3 al amanecer, costes 1/2/3, Rayo abrasador, corrupción, identificación y destrucción completos en la descripción española.",
 "crimson-crystal":"La versión española conserva toda la ambientación del cristal. Es una reliquia narrativa confirmada por el GM; no se añaden poderes cuantificados.",
 "runed-cloak":"Espacio adicional de nivel 1 al vestir la capa, aclarado por el GM: gasto y recuperación heredados del portador.",
 "amulet-of-wisdom":"La regla confirmada por el GM es +1 solo a las salvaciones de Sabiduría, con sintonización. La explicación inglesa de todas las salvaciones queda sustituida por esa decisión.",
 "scholar-s-scroll":"El texto inglés describe un pergamino con notas de estudios o plegarias; la descripción española del Manual del Jugador aportado contiene exactamente ese contenido. No es un pergamino de conjuro.",
};
const preps=read(root+"/latest-preparation-baseline.json").records,findings=[];
for(const f of read(base+"/pending.json").rows.filter(f=>!retired.has(f.key))){
 const old=byKey.get(f.key),reason=cases[old.payload.index];if(!reason)continue;
 assert.equal(f.candidates.length,1);const target=byKey.get(f.candidates[0].key),d=target.payload.rules.definition;
 assert.ok(d.review.identity&&d.review.editorial);assert.ok(d.origin==="campaign"||old.payload.index==="scholar-s-scroll");
 assert.deepEqual(target.payload.cost,old.payload.cost);
 const prep=preps.find(p=>p.payload.definition.id===d.id);
 assert.ok(prep?.payload.originals.some(o=>o.scope==="ECE"&&o.originalKey===old.content_key&&d.recoverySourceIds.includes(o.id)),old.name+": unlinked original");
 const english=JSON.stringify(old.payload),spanish=d.description.filter(b=>b.section!=="gm-notes").map(b=>b.type==="paragraph"?b.text:b.type==="list"?b.items.join(" "):[...b.columns,...b.rows.flat()].join(" ")).join("\n\n");
 findings.push({key:f.key,name:f.name,targetKeys:[target.content_key],issues:[],evidence:{reviewedEnglishSha256:createHash("sha256").update(english).digest("hex"),reviewedSpanishSha256:createHash("sha256").update(spanish).digest("hex"),review:reason},decision:reason+" Original íntegro archivado fuera del catálogo activo; no se modifican copias de inventario ni estados de uso. La ejecución de efectos se verifica por separado, sin confundir la retirada del duplicado con una certificación de automatización."});
}
assert.equal(findings.length,16);
mkdirSync(base+"/campaign-duplicates",{recursive:true});writeFileSync(root+"/campaign-duplicates-audit.json",JSON.stringify(findings,null,2));
const keys=[...new Set(findings.flatMap(f=>f.targetKeys))];writeFileSync(root+"/campaign-duplicates-destinations-select.sql",`select to_jsonb(t) as row,md5(to_jsonb(t)::text) as md5 from public.campaign_content_entries t where campaign_id='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd' and kind='equipment' and content_key in(${keys.map(k=>"'"+k+"'").join(",")}) order by content_key;`);
console.log(JSON.stringify({reviewed:findings.length,destinations:keys.length}));
