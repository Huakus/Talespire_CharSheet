/** Compare legacy English text to the primary SRD and its complete Spanish section. */
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {srdEquipmentTextBlocks} from "./srd-equipment-text-blocks.mjs";
import {createServer} from "vite";
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
let fingerprint,unaccountedLegacyEquipmentPaths;
try{({equipmentRuleTextFingerprint:fingerprint,unaccountedLegacyEquipmentPaths}=await server.ssrLoadModule("/src/domain/equipment/equipment-retirement-evidence.ts"));}
finally{await server.close();}
const root="tmp/equipment-definitions",read=p=>JSON.parse(readFileSync(p,"utf8"));
const rows=[0,1,2,3].flatMap(n=>read(`${root}/cleanup-live-${n}.json`));
const retired=new Set(read("docs/v2/equipment-retirement-2026-10-18/manifest.json").rows.map(r=>r.key));
const analysis=read(`${root}/cleanup-analysis.json`).filter(r=>!retired.has(r.key)),byKey=new Map(rows.map(r=>[r.content_key,r]));
const prep=read(`${root}/latest-preparation-baseline.json`).records;
const english=read("tmp/pdfs/srd-retirement-en-sections.json"),spanish=read("tmp/pdfs/srd-magic-items.json");
const norm=s=>String(s??"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,"");
const plain=s=>String(s).replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&");
const blockText=b=>b.type==="paragraph"?b.text:b.type==="list"?b.items.join(" "):[...b.columns,...b.rows.flat()].join(" ");
const allowed=new Set(["cost","name","bonus","index","rarity","weight","hasCharges","properties","description","gear_category","chargesOptions","equipment_category","requires_attunement","url","range","damage","weapon_range","category_range","weapon_category","two_handed_damage","gearCategory","toHitBonus","damageBonus","desc","attunement","armor_class","str_minimum","armor_category","stealth_disadvantage","throw_range","quantity","special"]);
const findings=[];
for(const a of analysis){
 const row=byKey.get(a.key),p=row.payload,issues=[],targets=a.candidates.map(c=>byKey.get(c.key));
 if(targets.length!==1)issues.push("ambiguous-destination");
 const target=targets[0],d=target?.payload.rules.definition;
 const en=english.filter(s=>norm(s.name)===norm(row.name)),es=d?spanish.filter(s=>norm(s.name)===norm(d.name)):[];
 if(en.length!==1)issues.push("no-exact-English-primary-section");
 if(es.length!==1)issues.push("no-exact-Spanish-primary-section");
 if(!d?.review.identity||!d?.review.editorial||d?.origin!=="official")issues.push("identity-or-editorial");
 if(!d?.sources.some(s=>s.verified&&s.kind==="srd"&&s.language==="es"&&s.rulesEdition==="2014"))issues.push("no-verified-Spanish-SRD");
 const primary=prep.find(r=>r.payload.definition.id===d?.id)?.payload.originals.filter(o=>o.scope==="ECE"&&o.originalKey===d?.id.slice(9))??[];
 if(primary.length!==1||norm(primary[0].raw.payload.index)!==norm(p.index))issues.push("index-or-original-identity");
 if(Object.keys(p).some(k=>!allowed.has(k))||unaccountedLegacyEquipmentPaths(p).length)issues.push("unaccounted-fields");
 if(p.weight!==undefined&&(typeof target?.payload.unitWeight!=="number"||Math.abs(target.payload.unitWeight-p.weight)>0.0000001))issues.push("legacy-weight-not-retained");
 if(p.cost&&(p.cost.quantity!==target?.payload.cost.quantity||p.cost.unit!==target?.payload.cost.unit))issues.push("legacy-price-not-retained");
 const raw=[];
 for(const k of ["desc","description"]){const text=p[k];if(text!==undefined){if(typeof text==="string")raw.push(text);else if(Array.isArray(text)&&text.every(s=>typeof s==="string"))raw.push(...text);else issues.push("unrecognized-text-shape");}}
 for(const bonus of p.bonus??[])if(bonus.description)raw.push(bonus.description);
 if(p.special){if(typeof p.special==="string")raw.push(p.special);else if(Array.isArray(p.special)&&p.special.every(s=>typeof s==="string"))raw.push(...p.special);else issues.push("unrecognized-special-shape");}
 const officialEn=en.length===1?fingerprint(en[0].lines.map(l=>l.text).join(" ")):"";
 const missingEn=raw.filter(t=>fingerprint(plain(t))&&!officialEn.includes(fingerprint(plain(t))));
 if(missingEn.length)issues.push("English-text-outside-primary-section");
 let expected=[],actual=[],missingEs=[];
 if(es.length===1){
  try{expected=srdEquipmentTextBlocks(es[0],"srd-5.1-es-equipment").blocks;
   actual=d.description.filter(b=>b.sourceIds.includes("srd-5.1-es-equipment"));
   const complete=fingerprint(actual.map(blockText).join(" "));
   missingEs=expected.filter(b=>!complete.includes(fingerprint(blockText(b))));
   if(missingEs.length)issues.push("Spanish-primary-text-not-complete");
  }catch{issues.push("Spanish-table-reconstruction-required");}
 }
 findings.push({key:a.key,name:a.name,targetKey:target?.content_key,targetName:d?.name,issues,
  evidence:{englishPage:en[0]?.page,spanishPage:es[0]?.page,legacyTextParts:raw.length,SpanishBlocks:expected.length},
  missingEn,missingEs:missingEs.map(blockText)});
}
mkdirSync("docs/v2/equipment-retirement-2026-10-18/bilingual",{recursive:true});
writeFileSync(`${root}/bilingual-audit.json`,JSON.stringify(findings,null,2));
const counts={};for(const f of findings)for(const issue of f.issues)counts[issue]=(counts[issue]??0)+1;
console.log(JSON.stringify({total:findings.length,safe:findings.filter(f=>!f.issues.length).length,counts,safeNames:findings.filter(f=>!f.issues.length).map(f=>f.name)}));
