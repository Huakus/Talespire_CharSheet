/** Source transcription of the supplied Xanathar manual, with explicit resource rules. */
import {readFileSync,writeFileSync} from "node:fs";
import {createServer} from "vite";
import assert from "node:assert/strict";
const root="tmp/equipment-definitions",read=(p)=>JSON.parse(readFileSync(p,"utf8"));
const baseline=read(`${root}/latest-preparation-baseline.json`),work=read(`${root}/remaining-unreviewed-worklist.json`),sections=read("tmp/pdfs/xge-magic-items.json");
const token=(s)=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const resources={"staff-of-birdcalls":[10,"dawn","1d6+4"],"staff-of-flowers":[10,"dawn","1d6+4"],"hewards-handy-spice-pouch":[10,"dawn","1d6+4"],"horn-of-silent-alarm":[4,"dawn","1d4"],"instrument-of-scribing":[3,"dawn",null],"hat-of-vermin":[3,"dawn",null],"wand-of-conducting":[3,"dawn",null],"wand-of-pyrotechnics":[7,"dawn","1d6+1"],"wand-of-scowls":[3,"dawn",null],"wand-of-smiles":[3,"dawn",null],"clockwork-amulet":[1,"dawn",null],"dark-shard-amulet":[1,"long-rest",null],"hat-of-wizardry":[1,"long-rest",null]};
const singleUse=new Set(["bead-of-nourishment","bead-of-refreshment","perfume-of-bewitching"]);
const changes=[],skipped=[];
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
try{const {EquipmentDefinitionDraftSchema}=await server.ssrLoadModule("/src/domain/equipment/equipment-definition.ts");
 for(const item of work){
  const matches=sections.filter((s)=>token(s.name)===token(item.name));if(matches.length!==1)continue;
  const s=matches[0],lines=[...s.lines];let meta=lines.shift()?.text??"";
  while(meta.includes("(")&&!meta.includes(")")&&lines.length)meta+=" "+lines.shift().text;
  if(!/com[uú]n/i.test(meta)){skipped.push({name:item.name,meta});continue;}
  const record=baseline.records.find((r)=>r.payload.definition.id===item.id),d=structuredClone(record.payload.definition),source="xanathar-supplied-es";
  d.name=s.name;d.aliases=[...new Set([...d.aliases,...(item.name!==s.name?[item.name]:[])])];d.origin="official";d.magical=true;d.rarity="common";
  d.category=/^Armadura/.test(meta)?"armor":/^Arma\s*\(/.test(meta)?"weapon":/^Munici[oó]n/.test(meta)?"ammunition":/^Bast[oó]n/.test(meta)?"staff":/^Varita/.test(meta)?"wand":"wondrous-item";
  d.consumable=singleUse.has(item.index);
  d.requirements={attunement:/sintonizaci[oó]n/i.test(meta),presence:["staff","wand","weapon","ammunition"].includes(d.category)?"held":"worn",bearer:[],explanation:meta};
  if(/de un [Bb]rujo/.test(meta))d.requirements.bearer.push({kind:"class",keys:["warlock"],explanation:meta});
  if(/de un mago/.test(meta))d.requirements.bearer.push({kind:"class",keys:["wizard"],explanation:meta});
  if(/lanzador de conjuros/.test(meta))d.requirements.bearer.push({kind:"spellcaster",keys:[],explanation:meta});
  d.sources=d.sources.filter((x)=>x.id!==source);d.sources.push({id:source,kind:"book",title:"Guía de Xanathar para todo · documento español aportado por el GM",language:"es",rulesEdition:"2014",locator:`C:/Users/joaqu/Downloads/Guia de Xanathar para todo (1).pdf · página PDF ${s.page}`,verified:true});
  const paragraphs=[];let current="";
  for(const l of lines){const start=l.bbox[0]>(l.bbox[0]>300?325:53);if(start&&current){paragraphs.push(current.trim());current="";}current+=" "+l.text;}
  if(current.trim())paragraphs.push(current.trim());assert.ok(paragraphs.length);
  // Transcribe verbatim. The supplied edition's translation is not independently accredited.
  d.description=paragraphs.map((text,i)=>({id:`xanathar-text-${i}`,type:"paragraph",section:"rules",provenance:"reviewed-translation",sourceIds:[source],text}));
  d.resources=[];const r=resources[item.index];
  if(r)d.resources.push({id:"item-uses",name:r[0]===1?"Uso de la propiedad":"Cargas",kind:r[0]===1?"uses":"charges",maximum:r[0],unit:r[0]===1?"usos":"cargas",recovery:{kind:"event",event:r[1],explanation:r[1]==="dawn"?"Recupera al amanecer, no con un descanso.":"Recupera al finalizar un descanso largo.",amount:r[2]?{kind:"roll",expression:r[2]}:{kind:"full"}},exhaustion:/última carga/.test(paragraphs.join(" "))?"Al gastar la última carga, resolver la tirada y consecuencia indicadas en la descripción; no destruir ni transformar automáticamente.":"No puede activarse sin un uso disponible."});
  const narrative=!["armor","weapon","ammunition"].includes(d.category)&&!/[Cc]D \d|tirada de salvaci|prueba de |truco|ventaja|desventaja/.test(paragraphs.join(" "));
  const costs=r?[{resourceId:"item-uses",amount:1}]:[];
  d.capabilities=[{id:"xanathar-property",name:r?"Activar propiedad":"Propiedad del objeto",activation:r||d.consumable?"action":"passive",trigger:"",requirements:structuredClone(d.requirements),target:"Según la descripción del objeto.",range:"",duration:"Según la descripción del objeto.",concentration:false,costs,consumeQuantity:d.consumable?1:0,effects:[narrative?{id:"xanathar-narrative",kind:"narrative",condition:"",instructions:"Resolver el efecto descrito en la mesa. La interfaz registra sus costes y su recuperación cuando corresponda."}:{id:"xanathar-conditional",kind:"unmodeled",condition:"",explanation:"Resolver la prueba, condición o elección indicada en la descripción; no concede conjuros a la lista de clase.",original:{index:item.index,metadata:meta}}],execution:{mode:costs.length||d.consumable||!narrative?"assisted":"narrative",handler:costs.length||d.consumable||!narrative?"equipment-text-assistance":null,explanation:"Texto transcrito del manual aportado; los costes y la recuperación configurados se registran en la copia. Las elecciones y efectos externos se resuelven según el texto.",pendingAutomation:costs.length||d.consumable||!narrative?["Aplicar las pruebas, elecciones, objetivos y efectos externos que especifica la descripción.",...(/última carga/.test(paragraphs.join(" "))?["Resolver la tirada por la última carga y su destrucción o transformación."]:[])]:[]},textBlockIds:d.description.map((b)=>b.id)}];
  if(item.index==="clockwork-amulet"){d.capabilities[0].activation="trigger";d.capabilities[0].trigger="Al hacer una tirada de ataque, antes de tirar el d20.";}
  d.review={identity:true,information:false,editorial:true,mechanics:narrative,unresolved:["Transcripción fiel del documento aportado; acreditar o sustituir por la traducción editorial oficial si se obtiene.","Conservar originales y cerrar su cobertura antes de eliminar versiones.",...(["armor","weapon","ammunition"].includes(d.category)?["La propiedad genérica necesita elegir un tipo físico de arma, armadura o munición antes de dar por completa una variante concreta."]:[])]};d.revision+=1;
  changes.push({key:d.id.slice(9),definition:EquipmentDefinitionDraftSchema.parse(d),page:s.page,index:item.index});
 }
}finally{await server.close();}
writeFileSync(`${root}/remaining-xanathar-reviews.json`,JSON.stringify(changes));
writeFileSync("docs/v2/equipment-preparation-2026-10-17/remaining-xanathar-source-review.json",JSON.stringify({reviewed:changes.length,items:changes.map(({key,page,index,definition})=>({key,page,index,name:definition.name})),skipped},null,2));
console.log(JSON.stringify({reviewed:changes.length,withResources:changes.filter((x)=>x.definition.resources.length).length,consumables:changes.filter((x)=>x.definition.consumable).length,skipped}));
