import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {createServer} from "vite";
import {equipmentRetirementCatalog} from "./equipment-retirement-catalog.mjs";
const root="tmp/equipment-definitions",base="docs/v2/equipment-retirement-2026-10-18",read=p=>JSON.parse(readFileSync(p,"utf8"));
const rows=equipmentRetirementCatalog(),byKey=new Map(rows.map(r=>[r.content_key,r])),removed=new Set(["","/bilingual","/physical","/authoritative","/tools-physical"].flatMap(s=>read(base+s+"/manifest.json").rows.map(r=>r.key)));
const preps=read(`${root}/latest-preparation-baseline.json`).records,sections=read("tmp/pdfs/xge-magic-items.json");
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
let fp,unknown;try{({equipmentRuleTextFingerprint:fp,unaccountedLegacyEquipmentPaths:unknown}=await server.ssrLoadModule("/src/domain/equipment/equipment-retirement-evidence.ts"));}finally{await server.close();}
const norm=s=>String(s??"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,"");
const findings=[];
for(const f of read(`${root}/cleanup-analysis.json`).filter(f=>!removed.has(f.key))){
 const target=f.candidates.length===1?byKey.get(f.candidates[0].key):null,d=target?.payload.rules.definition;
 if(!d?.sources.some(s=>s.id==="xanathar-supplied-es"))continue;
 const p=byKey.get(f.key).payload,issues=[],source=d.sources.find(s=>s.id==="xanathar-supplied-es"),prep=preps.find(r=>r.payload.definition.id===d.id),primary=prep?.payload.originals.find(o=>o.scope==="ECE"&&o.originalKey===d.id.slice(9));
 if(primary?.raw.payload.index!==p.index||d.origin!=="official"||!d.review.identity||!d.review.editorial||!source.verified||source.rulesEdition!=="2014")issues.push("identity-or-source");
 if(!prep?.payload.originals.some(o=>o.scope==="ECE"&&o.originalKey===f.key&&d.recoverySourceIds.includes(o.id)))issues.push("recovery-not-linked");
 const knownType = typeof p.item_type === "string" && /^(wondrous item|staff|wand|armor|weapon|ammunition|shield)(?:\s*\([^)]*\))?$/i.test(p.item_type);
 const unknownPaths=unknown(p).filter(path=>!["/page","/source"].includes(path)&&!(path==="/item_type"&&knownType));
 if(unknownPaths.length)issues.push("unaccounted-import-fields");
 if(!/xanathar/i.test(p.source??""))issues.push("unverified-English-source");
 if(p.cost&&(p.cost.quantity!==target.payload.cost.quantity||p.cost.unit!==target.payload.cost.unit))issues.push("price-review");
 if(p.weight!==undefined&&Math.abs(p.weight-target.payload.unitWeight)>1e-7)issues.push("weight-review");
 const matches=sections.filter(s=>norm(s.name)===norm(d.name));
 let page=null,blocks=0;
 if(matches.length!==1)issues.push("primary-section-review");else{
  const s=matches[0],lines=[...s.lines];let metadata=lines.shift()?.text??"";while(metadata.includes("(")&&!metadata.includes(")")&&lines.length)metadata+=" "+lines.shift().text;
  const body=fp(d.description.filter(b=>b.sourceIds.includes(source.id)).map(b=>b.type==="paragraph"?b.text:b.type==="list"?b.items.join(" "):[...b.columns,...b.rows.flat()].join(" ")).join(" "));
  if(body!==fp(lines.map(l=>l.text).join(" "))||fp(d.requirements.explanation)!==fp(metadata)||!source.locator?.endsWith("página PDF "+s.page))issues.push("incomplete-primary-transcription");
  page=s.page;blocks=lines.length;
 }
 findings.push({key:f.key,name:f.name,targetKeys:[target.content_key],issues,evidence:{index:p.index,page,sourceLines:blocks,spanishSource:"Manual de Xanathar aportado por el GM",translationAccreditation:"Transcripción revisada del documento aportado; no se afirma acreditación editorial oficial independiente."},decision:"La sección del manual de Xanathar aportado está transcrita íntegramente en español, incluida su línea de requisitos, y conserva los datos económicos existentes. Se aplica la preferencia del GM por las reglas de la fuente de 2014 compatible y su autorización para traducción revisada; la acreditación editorial pendiente permanece explícita. Los efectos asistidos y automatizaciones pendientes no se ocultan por retirar el duplicado inglés."});
}
mkdirSync(base+"/xanathar",{recursive:true});writeFileSync(`${root}/xanathar-audit.json`,JSON.stringify(findings,null,2));
const keys=[...new Set(findings.filter(f=>!f.issues.length).flatMap(f=>f.targetKeys))];
writeFileSync(`${root}/xanathar-destinations-select.sql`,`select to_jsonb(t) as row,md5(to_jsonb(t)::text) as md5 from public.campaign_content_entries t where campaign_id='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd' and kind='equipment' and content_key in(${keys.map(k=>"'"+k+"'").join(",")}) order by content_key;`);
console.log(JSON.stringify({examined:findings.length,safe:findings.filter(f=>!f.issues.length).length,blocked:findings.filter(f=>f.issues.length).map(f=>({name:f.name,issues:f.issues}))}));
