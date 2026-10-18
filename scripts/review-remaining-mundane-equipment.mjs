/** Compare retained mundane items with official 2014 rows; do not infer missing weights. */
import {readFileSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
import {createServer} from "vite";
const root="tmp/equipment-definitions",read=(p)=>JSON.parse(readFileSync(p,"utf8"));
const baseline=read(`${root}/latest-preparation-baseline.json`),pending=read(process.argv[2]??`${root}/remaining-unreviewed-worklist.json`),bases=read("src/domain/character/phb-srd-equipment.json"),pages=read("tmp/pdfs/srd-en-equipment-rows.json"),prose=read("tmp/pdfs/srd-mundane-prose.json"),prefix=process.argv[3]??"remaining-mundane";
assert.match(prefix,/^[a-z-]+$/);
const token=(s)=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const clean=(s)=>s.replace(/\s+/g," ").trim();
const price=(s)=>{const m=clean(s).match(/^([\d,]+(?:\.\d+)?) (cp|sp|ep|gp|pp)$/);return m?{quantity:Number(m[1].replaceAll(",","")),unit:m[2]}:null;};
const names={"lantern-bullseye":"Linterna de ojo de buey","lantern-hooded":"Linterna sorda","healers-kit":"Útiles de sanador","navigators-tools":"Herramientas de navegante","horse-riding":"Caballo de monta",cart:"Carreta",carriage:"Carruaje",chariot:"Carro de guerra",wagon:"Carro",sack:"Saco",lamp:"Lámpara",dulcimer:"Dulcémele","thieves-tools":"Herramientas de ladrón","block-and-tackle":"Polipasto","ball-bearings-bag-of-1000":"Bolas de metal (bolsa de 1000)","pole-10-foot":"Pértiga (10 pies)","jug-or-pitcher":"Jarra","flask-or-tankard":"Frasco o jarra", "ram-portable":"Ariete portátil"};
const proseByIndex={"lantern-bullseye":"Linterna de ojo de buey","lantern-hooded":"Linterna sorda","ram-portable":"Ariete portátil","block-and-tackle":"Polipasto","hunting-trap":"Trampa para cazar","healers-kit":"Útiles de sanador","holy-water-flask":"Agua bendita","poison-basic-vial":"Veneno básico","component-pouch":"Saquito de componentes",lamp:"Lámpara",manacles:"Esposas",lock:"Cerradura",candle:"Vela","ball-bearings-bag-of-1000":"Bolas de metal","chain-10-feet":"Cadena","case-crossbow-bolt":"Estuche para virotes de ballesta","magnifying-glass":"Lupa","fishing-tackle":"Caña de pescar","disguise-kit":"Útiles para disfrazarse","forgery-kit":"Útiles para falsificar","poisoners-kit":"Útiles de envenenador","thieves-tools":"Herramientas de ladrón","navigators-tools":"Herramientas de navegante","burglars-pack":"Paquete de ladrón (16 po)","diplomats-pack":"Paquete de diplomático (39 po)","dungeoneers-pack":"Paquete de explorador de mazmorras (12 po)","entertainers-pack":"Paquete de artista (40 po)"};
const mount=new Set(["camel","donkey","mule","elephant","horse-draft","horse-riding","mastiff","pony","warhorse"]),vehicle=new Set(["cart","carriage","chariot","sled","wagon","galley","keelboat","longship","rowboat","sailing-ship","warship"]),water=new Set(["galley","keelboat","longship","rowboat","sailing-ship","warship"]);
const changes=[],skipped=[];
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
try{const {EquipmentDefinitionDraftSchema}=await server.ssrLoadModule("/src/domain/equipment/equipment-definition.ts");
for(const work of pending){
 const base=bases.find((b)=>b.index===work.index);if(!base||base.weapon_category||base.armor_category)continue;
 const record=baseline.records.find((r)=>r.payload.definition.id===work.id),d=structuredClone(record.payload.definition);
 if(work.index.startsWith("barding-")){
  const suffix=work.index.slice(8),index=({padded:"padded-armor",leather:"leather-armor","studded-leather":"studded-leather-armor",hide:"hide-armor","half-plate":"half-plate-armor",splint:"splint-armor",plate:"plate-armor"})[suffix]??suffix;
  const armor=baseline.records.find((r)=>r.payload.definition.armor&&r.payload.definition.review.editorial&&r.payload.originals.some((o)=>o.originalKey===r.payload.definition.id.slice(9)&&o.raw.payload?.index===index))?.payload.definition;
  const text=prose.find((p)=>p.name==="Barda");
  if(!armor?.economy.basePrice||!armor.weight||!text){skipped.push({...work,reason:"No se encontró una base revisada inequívoca para esta barda."});continue;}
  const verified=armor.sources.filter((s)=>s.verified),sid="srd-5.1-es-barding";
  d.name=`Barda: ${armor.name}`;d.aliases=[...new Set([...d.aliases,...(d.name!==work.name?[work.name]:[])])];d.origin="official";d.category="tack";d.subtypes=["barding",index];d.magical=false;d.rarity="none";d.consumable=false;
  d.weight={value:armor.weight.value*2,unit:armor.weight.unit};d.economy={basePrice:{...armor.economy.basePrice,quantity:armor.economy.basePrice.quantity*4},campaignPrice:null,explanation:"Barda de 2014: cuatro veces el precio y dos veces el peso de la armadura equivalente."};
  d.requirements={attunement:false,bearer:[],presence:"other",explanation:"La lleva la montura; no mejora la CA del jinete."};d.armor=null;d.weapon=null;
  d.sources=[...d.sources,...verified.filter((s)=>!d.sources.some((o)=>o.id===s.id)),{id:sid,kind:"srd",title:"SRD 5.1 · reglas de bardas",language:"es",rulesEdition:"2014",locator:`https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf · página PDF ${text.page} · CC BY 4.0`,verified:true}];
  d.description=[{id:"barding-rule",type:"paragraph",section:"rules",provenance:"official-spanish",sourceIds:[sid],text:clean(text.lines.map((l)=>l.text).join(" "))},{id:"barding-statistics",type:"table",section:"description",provenance:"reviewed-translation",sourceIds:[sid,...verified.map((s)=>s.id)],columns:["Barda","Precio","Peso","CA de la montura"],rows:[[d.name,`${d.economy.basePrice.quantity} ${d.economy.basePrice.unit}`,`${d.weight.value} ${d.weight.unit}`,`${armor.armor.baseArmorClass}${armor.armor.dexterity==="none"?"":" + DES"}${armor.armor.dexterityCap===null?"":` (máx. ${armor.armor.dexterityCap})`}`]]}];
  d.resources=[];d.capabilities=[{id:"mount-armor",name:"Armadura de la montura",activation:"passive",trigger:"",requirements:structuredClone(d.requirements),target:"Montura que lleva la barda.",range:"",duration:"Mientras la montura la lleve puesta.",concentration:false,costs:[],consumeQuantity:0,effects:[{id:"mount-profile",kind:"unmodeled",condition:"Solo para la montura, no para el jinete.",explanation:"Aplicar a la montura la CA, requisitos y desventaja de Sigilo del perfil de armadura correspondiente.",original:{armor:armor.armor}}],execution:{mode:"assisted",handler:"equipment-text-assistance",explanation:"El equipo del jinete no modifica automáticamente las estadísticas de una montura diferente.",pendingAutomation:["Seleccionar la montura receptora y aplicar o retirar su perfil de armadura."]},textBlockIds:["barding-rule","barding-statistics"]}];d.review={identity:true,information:false,editorial:true,mechanics:true,unresolved:["Conservar originales y cerrar su recuperación antes de eliminar versiones."]};d.revision+=1;
  changes.push({key:d.id.slice(9),definition:EquipmentDefinitionDraftSchema.parse(d),page:text.page,index:work.index});continue;
 }
 let aliases=[base.name];if(["mule","donkey"].includes(work.index))aliases=["Donkey or mule"];if(work.index.startsWith("saddle-"))aliases.push(base.name.replace(/^Saddle, /,""));
 if(work.index==="animal-feed-1-day")aliases.push("Feed (per day)");if(work.index==="stabling-1-day")aliases.push("Stabling (per day)");
 const matches=[];
 for(const page of pages)for(const row of page.rows)for(const cells of [row.cells.filter((c)=>c.x<300),row.cells.filter((c)=>c.x>=300)])if(cells.length>=3&&aliases.map(token).includes(token(cells[0].text))&&price(cells[1].text))matches.push({page:page.page,cells});
 const section=prose.find((s)=>s.name===proseByIndex[work.index]);
 if(matches.length!==1){skipped.push({...work,reason:`Filas inequívocas: ${matches.length}; no sustituir por datos de API sin cotejo.`});continue;}
 const row=matches[0],cost=price(row.cells[1].text);assert.ok(cost);
 d.name=work.index==="clothes-costume"?"Ropa de disfraz":names[work.index]??d.name;
 d.aliases=[...new Set([...d.aliases,...(d.name!==work.name?[work.name]:[])])];d.origin="official";d.magical=false;d.rarity="none";d.consumable=false;
 d.category=mount.has(work.index)?"mount":vehicle.has(work.index)?"vehicle":work.index.startsWith("saddle-")||work.index==="bit-and-bridle"?"tack":base.equipment_category.index==="tools"?"tool":base.gear_category?.index==="ammunition"?"ammunition":"adventuring-gear";
 d.requirements={attunement:false,bearer:[],presence:"possessed",explanation:"Equipo mundano; no requiere sintonización."};
 d.economy={basePrice:cost,campaignPrice:null,explanation:"Precio cotejado con la tabla oficial de 2014. Los precios de las copias de personajes y comerciantes se conservan."};
 const noWeight=mount.has(work.index)||water.has(work.index),weightCell=row.cells[2].text;
 const weight=clean(weightCell).match(/^([\d,]+(?:\.\d+)?(?:\/\d+)?) lb\.$/);
 if(!noWeight&&!weight&&!/^[—–-]$/.test(weightCell.trim())){skipped.push({...work,reason:`Peso no inequívoco: ${weightCell}`});continue;}
 const value=weight?weight[1].split("/").map((n)=>Number(n.replaceAll(",",""))):[];
 d.weight=!noWeight&&weight?{value:value.length===2?value[0]/value[1]:value[0],unit:"lb"}:null;
 const en="srd-5.1-en-equipment",es="srd-5.1-es-equipment";
 d.sources=d.sources.filter((s)=>![en,es].includes(s.id));d.sources.push({id:en,kind:"srd",title:"SRD 5.1 · original inglés",language:"en",rulesEdition:"2014",locator:`https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf · página PDF ${row.page} · CC BY 4.0`,verified:true});
 const columns=["Objeto","Precio",...(mount.has(work.index)?["Velocidad","Capacidad de carga"]:water.has(work.index)?["Velocidad"]:["Peso"])];
 const values=[d.name,`${cost.quantity} ${{cp:"pc",sp:"pp",ep:"pe",gp:"po",pp:"ppt"}[cost.unit]}`,...row.cells.slice(2).map((c)=>c.text.replace("ft.","pies").replace("mph","millas/h"))];
 if(columns.length!==values.length){skipped.push({...work,reason:"La fila contiene columnas que requieren revisión adicional."});continue;}
 d.description=[{id:"official-table-row",type:"table",section:"description",provenance:"reviewed-translation",sourceIds:[en],columns,rows:[values]}];
 if(section){d.sources.push({id:es,kind:"srd",title:"SRD 5.1 · edición oficial española",language:"es",rulesEdition:"2014",locator:`https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf · página PDF ${section.page} · CC BY 4.0`,verified:true});d.description.push({id:"official-prose",type:"paragraph",section:"rules",provenance:"official-spanish",sourceIds:[es],text:clean(section.lines.map((l)=>l.text).join(" "))});}
 const needsRules=!!section;
 d.capabilities=needsRules?[{id:"mundane-rule",name:"Uso del equipo",activation:"other",trigger:"",requirements:structuredClone(d.requirements),target:"Según las reglas del objeto.",range:"",duration:"Según la regla.",concentration:false,costs:[],consumeQuantity:0,effects:[{id:"mundane-instructions",kind:"unmodeled",condition:"",explanation:"Resolver las reglas descritas y sus condiciones en la mesa.",original:{index:work.index}}],execution:{mode:"assisted",handler:"equipment-text-assistance",explanation:"El texto oficial se muestra completo; las interacciones con objetivos se resuelven en la mesa.",pendingAutomation:["Automatizar las interacciones particulares, los objetivos y consumos indicados en el texto."]},textBlockIds:["official-prose"]}]:[];
 d.review={identity:true,information:false,editorial:true,mechanics:!needsRules,unresolved:["Conservar los originales y cerrar la recuperación de información antes de eliminar versiones.",...(needsRules?["El uso particular continúa siendo asistido y está explicado en el objeto."]:[])]};d.revision+=1;
 changes.push({key:d.id.slice(9),definition:EquipmentDefinitionDraftSchema.parse(d),page:row.page,index:work.index});
}
}finally{await server.close();}
writeFileSync(`${root}/${prefix}-reviews.json`,JSON.stringify(changes));
writeFileSync(`docs/v2/equipment-preparation-2026-10-17/${prefix}-source-review.json`,JSON.stringify({reviewed:changes.length,items:changes.map(({key,page,index,definition})=>({key,page,index,name:definition.name})),skipped},null,2));
console.log(JSON.stringify({reviewed:changes.length,skipped:skipped.length,reasons:skipped.map((s)=>({name:s.name,reason:s.reason}))}));
