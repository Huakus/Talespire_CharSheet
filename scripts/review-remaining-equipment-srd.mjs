/** Recover exact Spanish SRD text for unambiguous retained items. No live writes. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root="tmp/equipment-definitions", read=(p)=>JSON.parse(readFileSync(p,"utf8"));
const baseline=read(`${root}/latest-preparation-baseline.json`), owned=new Set(read(`${root}/owned-migration-plan.json`).changes.map((c)=>c.definitionId)), sections=read("tmp/pdfs/srd-magic-items.json");
const token=(s)=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const clean=(s)=>s.replace(/\s+/g," ").trim();
const sourceId="srd-5.1-es-equipment", url="https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf";
const changes=[], blocked=[];
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
try{
 const {EquipmentDefinitionDraftSchema}=await server.ssrLoadModule("/src/domain/equipment/equipment-definition.ts");
 const {withEquipmentAttribution}=await server.ssrLoadModule("/src/domain/equipment/equipment-attribution.ts");
 for(const record of baseline.records){
  const old=record.payload.definition;
  if(owned.has(old.id)||old.review.editorial)continue;
  const matches=sections.filter((s)=>[old.name,...old.aliases].map(token).includes(token(s.name)));
  if(matches.length!==1)continue;
  const section=matches[0];let cursor=0;const metadata=[];
  while(cursor<section.lines.length&&section.lines[cursor].fonts.every((f)=>f.includes("Italic")))metadata.push(section.lines[cursor++].text);
  const meta=clean(metadata.join(" "));
  // Variable variants require selecting a subtype; a generic name is insufficient.
  if(!meta||/rareza variable|muy raro o legendario/i.test(meta)){blocked.push({id:old.id,name:old.name,reason:"La fuente contiene variantes con rarezas y reglas diferentes."});continue;}
  const rarity=/legendari/i.test(meta)?"legendary":/muy rar/i.test(meta)?"very-rare":/infrecuente/i.test(meta)?"uncommon":/\brar[oa]\b/i.test(meta)?"rare":/com[uú]n/i.test(meta)?"common":null;
  const category=/^Anillo/.test(meta)?"ring":/^Varita/.test(meta)?"wand":/^Vara/.test(meta)?"rod":/^Bast[oó]n/.test(meta)?"staff":/^Poci[oó]n/.test(meta)?"potion":/^Arma\s*\(/.test(meta)?"weapon":/^Armadura\s*\(escudo\)/i.test(meta)?"shield":/^Armadura/.test(meta)?"armor":/^Objeto maravilloso/.test(meta)?"wondrous-item":null;
  if(!rarity||!category){blocked.push({id:old.id,name:old.name,reason:`Metadatos no inequívocos: ${meta}`});continue;}
  const lines=section.lines.slice(cursor), containsTable=lines.some((l)=>l.size<9.5);
  // Complex tables remain in preparation until their columns are checked individually.
  if(containsTable){blocked.push({id:old.id,name:old.name,reason:"La tabla oficial requiere cotejo de columnas; se conserva completa en el PDF y los originales."});continue;}
  const paragraphs=[];let text="";
  for(const line of lines){if(/^\s+\S/.test(line.text)&&text){paragraphs.push(clean(text));text="";}text+=" "+line.text;}
  if(text.trim())paragraphs.push(clean(text));
  assert.ok(paragraphs.length);const d=structuredClone(old);
  d.name=section.name;d.aliases=[...new Set([...d.aliases,...(d.name!==old.name?[old.name]:[])])];d.origin="official";d.category=category;d.rarity=rarity;d.magical=true;
  d.consumable=category==="potion"||/^(Disolvente universal|Pegamento soberano|Polvo |Canica de fuerza|Gema elemental)/i.test(d.name);
  d.requirements={attunement:/requiere sintonizaci[oó]n/i.test(meta),presence:["ring","wondrous-item","armor","shield"].includes(category)?"worn":"held",bearer:[],explanation:meta};
  const classes=Object.entries({wizard:/mago/,warlock:/brujo/,sorcerer:/hechicero/,cleric:/cl[eé]rigo/,druid:/druida/,bard:/bardo/,paladin:/palad[ií]n/}).filter(([,p])=>p.test(meta)).map(([k])=>k);
  if(classes.length)d.requirements.bearer.push({kind:"class",keys:classes,explanation:meta});
  if(/lanzador de conjuros/.test(meta))d.requirements.bearer.push({kind:"spellcaster",keys:[],explanation:meta});
  if(/alineamiento|criatura/.test(meta)&&!classes.length)d.requirements.bearer.push({kind:"other",keys:[],explanation:meta});
  d.sources=d.sources.filter((s)=>s.id!==sourceId);d.sources.push({id:sourceId,kind:"srd",title:"Documento de referencia del sistema 5.1 · edición oficial española",language:"es",rulesEdition:"2014",locator:`${url} · página PDF ${section.page} · CC BY 4.0`,verified:true});
  d.description=paragraphs.map((text,i)=>({id:`official-rule-${i}`,type:"paragraph",section:"rules",provenance:"official-spanish",sourceIds:[sourceId],text}));
  // Exact text is playable with an explicit assisted procedure. It never implies a spell grant or free resource.
  d.capabilities=[{id:"official-assisted-rule",name:"Reglas del objeto",activation:"other",trigger:"",requirements:structuredClone(d.requirements),target:"Según la regla oficial.",range:"",duration:"Según la regla oficial.",concentration:"spell-dependent",costs:[],consumeQuantity:0,effects:[{id:"assisted-rule",kind:"unmodeled",condition:"",explanation:paragraphs.join("\n\n"),original:{source:sourceId,page:section.page,metadata:meta}}],execution:{mode:"assisted",handler:"equipment-text-assistance",explanation:"Consultar la regla oficial y resolver los efectos descritos en la mesa; no concede activaciones ni recuperaciones automáticas.",pendingAutomation:["Conectar los costes, objetivos, duración y efectos particulares de esta regla antes de habilitar su uso automático."]},textBlockIds:d.description.map((b)=>b.id)}];
  d.review={identity:true,information:false,editorial:true,mechanics:false,unresolved:["La descripción oficial española está recuperada íntegramente; faltan adaptar y validar las mecánicas particulares y cerrar la cobertura de todos los campos originales."]};
  d.revision+=1;
  const checked=EquipmentDefinitionDraftSchema.parse(d);
  changes.push({id:d.id,name:d.name,key:d.id.slice(9),before:old,definition:checked,page:section.page});
 }
}finally{await server.close();}
writeFileSync(`${root}/remaining-srd-text-reviews.json`,JSON.stringify(changes));
writeFileSync("docs/v2/equipment-preparation-2026-10-17/remaining-srd-text-reviews.json",JSON.stringify({sources:[url],count:changes.length,items:changes.map(({id,name,page})=>({id,name,page})),blocked},null,2));
console.log(JSON.stringify({recovered:changes.length,blocked:blocked.length}));
