/** Apply the GM's explicit official-2014 preference to conflicting official imports. */
import{readFileSync,writeFileSync,mkdirSync}from"node:fs";
import{createServer}from"vite";
import{srdEquipmentTextBlocks}from"./srd-equipment-text-blocks.mjs";
const root="tmp/equipment-definitions",read=p=>JSON.parse(readFileSync(p,"utf8")),base="docs/v2/equipment-retirement-2026-10-18";
const rows=[0,1,2,3].flatMap(n=>read(`${root}/cleanup-live-${n}.json`)),byKey=new Map(rows.map(r=>[r.content_key,r]));
const removed=new Set(["","/bilingual","/physical"].flatMap(s=>read(base+s+"/manifest.json").rows.map(r=>r.key)));
const pending=read(`${root}/cleanup-analysis.json`).filter(f=>!removed.has(f.key)),preps=read(`${root}/latest-preparation-baseline.json`).records;
const sections=read("tmp/pdfs/srd-magic-items.json");
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
let fp,unknown;
try{({equipmentRuleTextFingerprint:fp,unaccountedLegacyEquipmentPaths:unknown}=await server.ssrLoadModule("/src/domain/equipment/equipment-retirement-evidence.ts"));}finally{await server.close();}
const blockText=b=>b.type==="paragraph"?b.text:b.type==="list"?b.items.join(" "):[...b.columns,...b.rows.flat()].join(" ");
const parsed=sections.map(s=>{try{return{...s,expected:srdEquipmentTextBlocks(s,"srd-5.1-es-equipment").blocks.map(blockText)}}catch{return null;}}).filter(Boolean);
const norm=s=>String(s??"").toLowerCase().replace(/[^a-z0-9]/g,"");
const findings=[];
for(const f of pending){
 const old=byKey.get(f.key),p=old.payload,issues=[],targetKeys=[],evidence=[];
 if(f.candidates.length!==1)issues.push("destination-review");
 if(unknown(p).length)issues.push("unaccounted-import-fields");
 for(const c of f.candidates.length===1?f.candidates:[]){
  const target=byKey.get(c.key),d=target.payload.rules.definition;
  if(d.origin!=="official"||!d.review.identity||!d.review.editorial) {issues.push("identity-or-editorial");continue;}
  const prep=preps.find(r=>r.payload.definition.id===d.id),original=prep?.payload.originals.find(s=>s.scope==="ECE"&&s.originalKey===d.id.slice(9));
  if(!original||norm(original.raw.payload.index)!==norm(p.index)){issues.push("identity-index");continue;}
  if(!prep.payload.originals.some(s=>s.scope==="ECE"&&s.originalKey===old.content_key&&d.recoverySourceIds.includes(s.id))){issues.push("source-not-linked");continue;}
  if(p.cost&&(p.cost.quantity!==target.payload.cost.quantity||p.cost.unit!==target.payload.cost.unit))issues.push("legacy-price-review");
  if(p.weight!==undefined&&(typeof target.payload.unitWeight!=="number"||Math.abs(p.weight-target.payload.unitWeight)>1e-7))issues.push("legacy-weight-review");
  const witnesses=d.sources.filter(s=>s.verified&&s.kind==="srd"&&s.rulesEdition==="2014"&&s.language==="es"&&s.locator?.includes("SRD_CC_v5.1_ES.pdf"));
  const text=fp(d.description.filter(b=>b.sourceIds.some(id=>witnesses.some(s=>s.id===id))).map(blockText).join(" "));
  const matches=parsed.filter(s=>witnesses.some(w=>Number(w.locator.match(/p[aá]gina(?: PDF)?\s+(\d+)/i)?.[1])===s.page)&&s.expected.every(t=>text.includes(fp(t))));
  if(matches.length===1){
    targetKeys.push(target.content_key);evidence.push({spanishPrimarySection:matches[0].name,page:matches[0].page,completeSourceBlocks:matches[0].expected.length});
  }else if(/^vicious-(?!net)/.test(p.index)&&d.category==="weapon"&&d.capabilities.some(c=>c.id==="vicious-natural-20"&&c.effects.some(e=>e.kind==="damage"&&e.expression==="7"&&e.timing==="critical"))&&
    d.sources.some(s=>s.verified&&s.id==="dmg-2014-vicious")&&
    fp(p.description??"")===fp("When you roll a 20 on your attack roll with this magic weapon, the target takes an extra 7 damage of the weapon’s type.")){
    targetKeys.push(target.content_key);evidence.push({spanishPrimarySection:"Arma feroz, regla del manual de 2014",fixedDamage:7,trigger:"natural-20",source:"dmg-2014-vicious"});
  }else issues.push("full-Spanish-primary-source-review");
 }
 if(!targetKeys.length)issues.push("no-complete-official-destination");
 findings.push({key:f.key,name:f.name,targetKeys,issues:[...new Set(issues)],evidence,
  decision:"Aplicada la instrucción del GM: cuando existe versión oficial, usar las reglas originales de 2014. Se conserva íntegra la sección primaria española (o la regla de arma feroz ya cotejada con el manual de 2014); el texto y los campos normativos de la importación inglesa se sustituyen por esa fuente aunque difieran. Los precios y pesos de catálogo se conservan, sin modificar inventarios."});
}
mkdirSync(base+"/authoritative",{recursive:true});
writeFileSync(`${root}/authoritative-audit.json`,JSON.stringify(findings,null,2));
const counts={};for(const f of findings)for(const i of f.issues)counts[i]=(counts[i]??0)+1;
console.log(JSON.stringify({examined:findings.length,safe:findings.filter(f=>!f.issues.length).length,counts}));
