/** Source-based retirement: retain complete Spanish rules, not obsolete imported statistics. */
import{readFileSync,writeFileSync,mkdirSync}from"node:fs";
import{createHash}from"node:crypto";
import{createServer}from"vite";
import{srdEquipmentTextBlocks}from"./srd-equipment-text-blocks.mjs";
import{equipmentRetirementCatalog}from"./equipment-retirement-catalog.mjs";
const root="tmp/equipment-definitions",base="docs/v2/equipment-retirement-2026-10-18",read=p=>JSON.parse(readFileSync(p,"utf8")),batch=process.argv[2]??"final-source";
const removed=new Set(["","/bilingual","/physical","/authoritative","/tools-physical","/xanathar",...(batch!=="final-source"?["/final-source"]:[]),...(batch==="final-corrections"?["/usage-retirement","/campaign-duplicates"]:[])].flatMap(s=>read(base+s+"/manifest.json").rows.map(r=>r.key)));
const rows=equipmentRetirementCatalog(),byKey=new Map(rows.map(r=>[r.content_key,r])),pending=read(base+"/pending.json").rows.filter(r=>!removed.has(r.key));
const preps=read(root+"/latest-preparation-baseline.json").records,magic=read("tmp/pdfs/srd-magic-items.json"),prose=read("tmp/pdfs/srd-mundane-prose.json");
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});let fp,unknown;
try{({equipmentRuleTextFingerprint:fp,unaccountedLegacyEquipmentPaths:unknown}=await server.ssrLoadModule("/src/domain/equipment/equipment-retirement-evidence.ts"));}finally{await server.close();}
const text=b=>b.type==="paragraph"?b.text:b.type==="list"?b.items.join(" "):[...b.columns,...b.rows.flat()].join(" ");
const parsed=magic.map(s=>{try{return{...s,...srdEquipmentTextBlocks(s,"srd-5.1-es-equipment")}}catch{return null}}).filter(Boolean);
const norm=s=>String(s??"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,"");
const findings=[];
for(const f of pending){
 const old=byKey.get(f.key),p=old.payload,issues=[],evidence=[],targetKeys=[];
 const misnamedManyThings=f.key==="official:equipment:eng:e1607b2afc65354c0ce1c49d"&&/ivory or vellum/.test(JSON.stringify(p.desc??p.description))&&/thirteen cards/.test(JSON.stringify(p.desc??p.description))&&/twenty-two/.test(JSON.stringify(p.desc??p.description));
 const candidates=f.candidates.map(c=>byKey.get(c.key)).filter(t=>f.candidates.length===1||norm(t.name)===norm(({"Deck of Illusions":misnamedManyThings?"Baraja de múltiples cosas":"Baraja de ilusiones","Ring of Jumping":"Anillo de salto","Ring of Protection":"Anillo de protección","Ring of Water Walking":"Anillo de caminar sobre las aguas","Adamantine Chain Mail":"Cota de malla de adamantina"})[f.name]));
 // Multiple verified copies of the same official identity may be equivalent. The Spanish deduplication is separate.
 for(const target of candidates.slice(0,1)){
  const d=target.payload.rules.definition,check=[];
  if(d.origin!=="official"||!d.review.identity||!d.review.editorial){issues.push("identity-editorial");continue;}
  const prep=preps.find(r=>r.payload.definition.id===d.id),primary=prep?.payload.originals.find(o=>o.scope==="ECE"&&o.originalKey===d.id.slice(9));
  if(!primary||norm(primary.raw.payload.index)!==norm(p.index)&&!misnamedManyThings)check.push("original-index");
  if(!prep?.payload.originals.some(o=>o.scope==="ECE"&&o.originalKey===f.key&&d.recoverySourceIds.includes(o.id)))check.push("unlinked-original");
  const unaccounted=unknown(p).filter(path=>!/^\/(contents\/\d+\/item\/(index|name|url)|contents\/\d+\/quantity|capacity|speed(\/(quantity|unit))?|vehicle_category|page|source|item_type|rarity\/url)$/.test(path)&&!(p.index==="ioun-stone-mastery"&&path==="/bonus/0/stat"&&p.bonus?.[0]?.stat==="proficiency_bonus"&&p.bonus?.[0]?.value===1));
  if(unaccounted.length)check.push("unaccounted:"+unaccounted.join(","));
  const cp=price=>price?price.quantity*({cp:1,sp:10,ep:50,gp:100,pp:1000})[price.unit]:NaN;
  const packet=d.description.find(b=>b.type==="table"&&b.columns.includes("Unidades por paquete")),packetQuantity=packet?Number(packet.rows[0]?.[packet.columns.indexOf("Unidades por paquete")]):1;
  const samePrice=!p.cost||cp(p.cost)===cp(target.payload.cost)||packetQuantity>1&&cp(p.cost)/packetQuantity===cp(target.payload.cost);
  const knownPriceCorrection=p.index==="barding-ring-mail"&&p.cost?.quantity===12&&p.cost.unit==="gp"&&d.economy.basePrice?.quantity===120&&d.economy.basePrice.unit==="gp"||p.index==="caltrops"&&cp(p.cost)===5&&cp(d.economy.basePrice)===100;
  if(!samePrice&&!knownPriceCorrection)check.push("campaign-price");
  if(!samePrice&&knownPriceCorrection)evidence.push({kind:"official-price-correction",legacy:p.cost,canonical:target.payload.cost,base:d.economy.basePrice});
  const allWitnesses=d.sources.filter(s=>s.verified&&s.rulesEdition==="2014"&&(s.kind==="srd"||p.index==="bell"&&s.kind==="book")),witnesses=allWitnesses.filter(s=>s.language==="es");
  if(f.name==="Deck of Illusions"&&!misnamedManyThings&&!/\b34\b/.test(JSON.stringify(p.description??p.desc)))check.push("deck-identity-text");
  if(misnamedManyThings)evidence.push({kind:"misnamed-legacy-identity",actual:"Baraja de múltiples cosas",basis:"Texto de cartas de marfil o vitela, trece o veintidós cartas; identidad cotejada con el texto oficial completo."});
  const actual=fp(d.description.filter(b=>b.sourceIds.some(id=>witnesses.some(s=>s.id===id))).map(text).join(" "));
  const sourcePage=s=>witnesses.some(w=>[...(w.locator??"").matchAll(/p[aá]ginas?(?: PDF)?\s+(\d+)/gi)].some(m=>Number(m[1])===s.page));
  const whole=parsed.filter(s=>sourcePage(s)&&s.blocks.every(b=>actual.includes(fp(text(b)))));
  let verified=false;
  if(p.index==='cloak-of-many-fashions'){
   const s=read('tmp/pdfs/xge-magic-items.json').find(s=>s.name==='Capa de Muchos Estilos');
   verified=!!s&&d.sources.some(s=>s.id==='xge-provided-cloak'&&s.verified&&s.rulesEdition==='2014')&&d.description.some(b=>b.type==='paragraph'&&fp(b.text)===fp(s.lines.slice(1).map(l=>l.text).join(' ')));
   if(verified)evidence.push({kind:'complete-supplied-xanathar-section',page:s.page,translation:'Transcripción del documento aportado; no se acredita editorial externa.'});
  }
  if(['amulet-of-the-devout-1',"rhythm-maker's-drum-1"].includes(p.index)){
   const t=read(base+'/final-context-translations.json').find(t=>t.legacyKey===f.key&&t.key===target.content_key);
   verified=!!t&&t.englishSha256===createHash('sha256').update(JSON.stringify(p.description)).digest('hex')&&t.texts.length===d.description.length&&t.texts.every((text,i)=>d.description[i].type==='paragraph'&&d.description[i].text===text&&d.description[i].provenance==='reviewed-translation')&&d.sources.some(s=>s.id==='tasha-official-identification'&&s.verified);
   if(verified)evidence.push({kind:'complete-reviewed-own-translation',legacySha256:t.englishSha256,limitation:t.sourceLimitation});
  }
  if(whole.length===1){verified=true;evidence.push({source:whole[0].name,page:whole[0].page,kind:"complete-magic-section"});}
  if(!verified&&p.index?.startsWith("ioun-stone-")){
   const s=parsed.find(s=>s.name==="Piedra Ioun"),label=({agility:"Agilidad",intellect:"Intelecto",leadership:"Liderazgo",insight:"Perspicacia",fortitude:"Fortaleza",protection:"Protección",mastery:"Maestría",awareness:"Consciencia",absorption:"Absorción","greater-absorption":"Absorción mayor"})[p.index.slice(11)];
   const start=s?.blocks.findIndex(b=>b.type==="paragraph"&&b.text.startsWith(label+" ("))??-1;
   if(s&&label&&start>=3){let end=start+1;while(end<s.blocks.length&&!(s.blocks[end].type==="paragraph"&&/^[^.(]+\([^)]*rar|^[^.(]+\(legendari/.test(s.blocks[end].text)))end++;
    const expected=[...s.blocks.slice(0,3),...s.blocks.slice(start,end)];verified=sourcePage(s)&&expected.every(b=>actual.includes(fp(text(b))));if(verified)evidence.push({source:s.name,variant:label,page:s.page,kind:"complete-variant"});}
  }
  if(!verified&&["potion-of-healing","potion-of-greater-healing","potion-of-superior-healing","potion-of-supreme-healing"].includes(p.index)){
   const s=parsed.find(s=>s.name==="Poción de curación"),rowLabel=({"potion-of-healing":"Curación","potion-of-greater-healing":"Curación mayor","potion-of-superior-healing":"Curación superior","potion-of-supreme-healing":"Curación suprema"})[p.index];
   const expected=s?.blocks.flatMap(b=>b.type==="table"?b.rows.filter(r=>r[0]===rowLabel).map(row=>({ ...b,rows:[row]})):[b])??[];
   verified=!!s&&sourcePage(s)&&expected.length>1&&expected.every(b=>b.type==="table"?actual.includes(fp(b.columns.join(" ")))&&b.rows.every(row=>actual.includes(fp(row.join(" ")))):actual.includes(fp(text(b).replace(/ Pociones de curación$/,""))));if(verified)evidence.push({source:s.name,variant:rowLabel,page:s.page,kind:"complete-variant",caption:"El título de la tabla no es una condición adicional del párrafo."});
  }
  if(!verified&&p.index==="crystal-ball"){
   const s=parsed.find(s=>s.name==="Bola de cristal");verified=!!s&&sourcePage(s)&&d.rarity==="very-rare"&&actual.includes(fp(text(s.blocks[0])));if(verified)evidence.push({source:s.name,variant:"Básica, muy rara",page:s.page,kind:"complete-variant"});
  }
  const mundane=d.magical===false&&allWitnesses.length>0;
  if(!verified&&mundane){
   const actualBlocks=d.description.filter(b=>b.section!=="gm-notes");
   const matches=prose.filter(s=>actualBlocks.some(b=>b.type==="paragraph"&&fp(b.text)===fp(s.lines.map(l=>l.text).join(" "))));
   const hasTable=actualBlocks.some(b=>b.type==="table"&&b.rows.length&&b.columns.length>=3);
   const proseRequired=typeof p.desc==="string"?p.desc.length>50:Array.isArray(p.desc)&&p.desc.join(" ").length>50;
   verified=(hasTable&&!proseRequired||matches.length>0);
   if(!verified&&["string-10-feet","block-of-incense","censer","alms-box","bell"].includes(p.index)){
    const literal=d.description.find(b=>b.type==="paragraph"&&b.id==="source-text");
    const quoted=literal?.type==="paragraph"&&prose.some(s=>fp(s.lines.map(l=>l.text).join(" ")).includes(fp(literal.text)));
    verified=!!quoted&&d.sources.some(s=>s.verified&&s.language==="es"&&s.rulesEdition==="2014");
    if(verified)evidence.push({kind:"individually-quoted-pack-component",quote:literal.text});
   }
   if(verified)evidence.push({kind:matches.length?"complete-mundane-context":"official-equipment-table",sources:allWitnesses.map(s=>s.locator),contexts:matches.map(s=>s.name)});
  }
  if(!verified)check.push("primary-context-review");
  if(p.weight!==undefined&&Math.abs(p.weight-target.payload.unitWeight)>1e-7){
   const physical=d.weapon||d.armor,ammoUnit=d.category==="ammunition"&&p.quantity>1;
   const packetUnit=packetQuantity>1&&Math.abs(p.weight/packetQuantity-target.payload.unitWeight)<1e-7;
   const knownWeightCorrection=p.index==="efficient-quiver"&&actual.includes(fp("sin pesar nunca más de 1 kg"))&&d.weight?.unit==="kg"&&d.weight.value===1||p.index==="saddle-exotic"&&p.weight===50&&d.weight?.unit==="lb"&&d.weight.value===40;
   if(!physical&&!ammoUnit&&!packetUnit&&!knownWeightCorrection&&!d.subtypes.includes("barding"))check.push("legacy-weight-review");else evidence.push({kind:"official-physical-weight-correction",legacy:p.weight,canonical:target.payload.unitWeight});
  }
  if(check.length)issues.push(...check);else targetKeys.push(target.content_key);
 }
 if(!targetKeys.length)issues.push("no-complete-destination");
 findings.push({key:f.key,name:f.name,targetKeys,issues:[...new Set(issues)],evidence,decision:"Versión española cotejada con la sección primaria completa, la variante concreta o el contexto y tabla mundanos de la fuente de 2014. Se aplica la preferencia del GM por reglas oficiales frente a estadísticas importadas contradictorias. El texto y metadatos antiguos quedan archivados íntegramente, sin modificar copias de inventario ni precios de campaña."});
}
mkdirSync(base+"/"+batch,{recursive:true});writeFileSync(root+`/${batch}-audit.json`,JSON.stringify(findings,null,2));
const keys=[...new Set(findings.filter(f=>!f.issues.length).flatMap(f=>f.targetKeys))];writeFileSync(root+`/${batch}-destinations-select.sql`,`select to_jsonb(t) as row,md5(to_jsonb(t)::text) as md5 from public.campaign_content_entries t where campaign_id='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd' and kind='equipment' and content_key in(${keys.map(k=>"'"+k+"'").join(",")}) order by content_key;`);
console.log(JSON.stringify({examined:findings.length,safe:findings.filter(f=>!f.issues.length).length,blocked:findings.filter(f=>f.issues.length).map(f=>({name:f.name,issues:f.issues}))}));
