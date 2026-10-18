/** Apply the GM's campaign identities and consolidate the two Wand of Annoyance versions. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (name) => JSON.parse(readFileSync(`${root}/${name}`,"utf8"));
const snapshot = read("campaign-equipment-resolution-before.json"), baseline = read("latest-preparation-baseline.json");
assert.equal(snapshot.entries.length,8);
const original = (index) => snapshot.entries.find((r) => r.payload.index === index);
const draft = (row) => structuredClone(baseline.records.find((r) => r.payload.definition.id === `recovery:${row.content_key}`).payload.definition);
const source = { id: "ece-gm-campaign-resolution", kind: "campaign", title: "ECE · identificación y consolidación autorizadas por el GM", language: "es", rulesEdition: "2014", locator: "Conversación del 18 de octubre de 2026: Cristal Carmesí y Núcleo Luciente son de campaña; unificar las varitas si corresponden y definir sus mecánicas; retirar los otros cuatro objetos.", verified: true };
const paragraph = (id,text,section="rules") => ({ id,type:"paragraph",section,provenance:"campaign",sourceIds:[source.id],text });
const blocks = (text) => text.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<[^>]+>/g,"").split(/\n+/).map((s)=>s.trim()).filter(Boolean).map((text,i)=>paragraph(`campaign-text-${i}`,text));
const initialize = (row) => {
 const d=draft(row);d.revision++;d.origin="campaign";d.sources=[...d.sources,source];d.weapon=null;d.armor=null;d.properties=[];d.magical=true;d.consumable=false;
 d.review={identity:true,information:false,editorial:true,mechanics:true,unresolved:["Conservar originales y cerrar su cobertura antes de eliminar versiones."]};
 return d;
};
const capability = (d,id,name,activation,effects,options={}) => ({id,name,activation,trigger:"",requirements:structuredClone(d.requirements),target:"Según la descripción.",range:"",duration:"",concentration:false,costs:[],consumeQuantity:0,effects,execution:{mode:"narrative",handler:null,explanation:"Resolver el contenido narrativo en la mesa.",pendingAutomation:[]},textBlockIds:d.description.map((b)=>b.id),...options});
const definitions=[];

const crystal=original("cristal-carmesi"), c=initialize(crystal);
c.name="Cristal Carmesí";c.aliases=[...new Set([...c.aliases,"Cristal Carmsí","Crimson Crystal"])];c.category="wondrous-item";c.rarity="very-rare";c.resources=[];
c.description=blocks(crystal.payload.description);for(const b of c.description)b.section="flavor";
c.description.push(paragraph("narrative-interpretation","Su descripción establece una reliquia narrativa de campaña. No define bonos, daño, cargas, consumo, salvaciones ni una condición mecánica; los sueños, sensaciones y alteraciones del entorno se resuelven por el GM."));
c.requirements={attunement:false,presence:"possessed",bearer:[],explanation:"El texto no define sintonización ni una activación mecánica."};
c.capabilities=[capability(c,"campaign-relic","Reliquia del Corazón","passive",[{id:"narrative-relic",kind:"narrative",condition:"",instructions:"Conservar el trasfondo de la reliquia sin inventar penalizaciones, poderes ni consumo."}],{textBlockIds:["narrative-interpretation"]})];
definitions.push({key:crystal.content_key,before:crystal,origin:"gm",tags:["es","custom","revisado"],definition:c});

const core=original("núcleo-luciente"), n=initialize(core);
const parsed=JSON.parse(core.payload.description.join("\n")), adapted=Object.values(parsed)[0];assert.equal(adapted.index,"nucleo-luciente-adaptado");
const english=baseline.records.find((r)=>r.payload.definition.id===n.id).payload.originals.find((o)=>o.raw.payload?.name==="Lucent Core").raw.payload.description.join(" ");
assert.match(english,/long rest if a Lucent Crystal fragment is inserted/);
n.name="Núcleo Luciente Adaptado";n.aliases=[...new Set([...n.aliases,"Núcleo Luciente","Lucent Core"])];n.category="wondrous-item";n.rarity="uncommon";n.weight={value:adapted.weight,unit:"lb"};n.subtypes=["ece-lucent-core-adapted"];
n.description=blocks(adapted.description);
n.description.push(paragraph("source-resolution","Esta ficha aplica la versión Adaptada que describe el objeto modificado por Draven: peso 3 lb y rareza poco común. El descanso largo con Cristal Luciente está confirmado en ambos idiomas; se corrige el campo antiguo de descanso corto. La vinculación usa la sintonización ya indicada en la ficha y exige competencia con herramientas de hojalatero (tinker-tools); «herramientas de artífice» es el alias empleado en la descripción de campaña."));
n.description.push(paragraph("operational-clarification","Las resonancias se activan con una acción y una carga; solo se mantiene un efecto de resonancia del núcleo a la vez. Reconfigurar sigue siendo una acción con prueba de Inteligencia y herramientas CD 12, sin coste de carga. No se descuenta automáticamente un cristal insertado para recargar: el texto exige insertarlo, pero no declara que se consuma. El GM confirma los materiales utilizados en una reparación."));
n.requirements={attunement:true,presence:"held",bearer:[{kind:"proficiency",keys:["tinker-tools"],explanation:"Requiere competencia con herramientas de hojalatero/manitas (herramientas de artífice de esta campaña)."}],explanation:"Sintonización y competencia con las herramientas indicadas por el objeto."};
n.resources=[{id:"core-charges",name:"Cargas del núcleo",kind:"charges",maximum:3,unit:"cargas",recovery:{kind:"event",event:"other",explanation:"Completar un descanso largo con un fragmento de Cristal Luciente insertado. Sin cristal no recupera cargas. Usar el control específico de recarga condicionada.",amount:{kind:"full"}},exhaustion:"Al gastar tres cargas antes de un descanso largo, resolver un d20. Con 1, queda inestable y no puede utilizar Revelación hasta repararse."}];
const modes=[
 ["green","Resonancia del Recuerdo (verde)","10 minutos",{id:"aelorian-investigation",kind:"defense",defense:"advantage",target:"aelorian-investigation",condition:"Investigación de tecnología aeloriana o búsqueda de inscripciones, mecanismos o rastros mágicos ocultos."}],
 ["blue","Resonancia del Umbral (azul)","1 minuto",{id:"cold-resistance",kind:"defense",defense:"resistance",target:"cold",condition:"Mientras dure la resonancia activa."}],
 ["violet","Resonancia de la Revelación (violeta)","1 minuto",{id:"aelorian-mechanisms",kind:"narrative",instructions:"Interactuar con mecanismos aelorianos, activar dispositivos resonantes y abrir cerraduras que respondan a frecuencias lucientes.",condition:"No puede utilizarse mientras el núcleo esté inestable."}],
];
n.capabilities=modes.map(([key,name,duration,effect])=>capability(n,`resonance-${key}`,name,"action",[effect,...(key==="blue"?[{id:"extreme-weather",kind:"defense",defense:"advantage",target:"extreme-weather",condition:"Solo tiradas para resistir condiciones climáticas extremas durante la resonancia."}]:[])],{duration,costs:[{resourceId:"core-charges",amount:1}],execution:{mode:"assisted",handler:"equipment-lucent-core",explanation:"Configura la resonancia mediante prueba CD 12; registra gasto, duración, desgaste, inestabilidad y recarga condicionada por copia. La duración avanza con los controles de tiempo de juego. La resistencia al frío se aplica cuando se registra daño tipificado, no a un daño ya calculado.",pendingAutomation:key==="blue"?["Identificar las tiradas que corresponden a clima extremo y aplicarles ventaja; no aplicar ventaja a todas las salvaciones de Constitución."]:key==="violet"?["El GM resuelve qué mecanismos responden al dispositivo y sus resultados en el tablero."]:["El usuario identifica cuándo la Investigación corresponde al ámbito de la resonancia; la tirada con ventaja está disponible en el control del núcleo."]}}));
definitions.push({key:core.content_key,before:core,origin:"gm",tags:["es","custom","revisado"],definition:n});
for (const cap of n.capabilities) {
 const block=n.description.find((b)=>b.type==="paragraph"&&b.text.startsWith(cap.name.split(" (")[0]));
 assert.ok(block,cap.name);cap.textBlockIds=[block.id];
}

const wand=original("varita-de-molestar"), secondWand=original("wand-of-annoyance"), w=initialize(wand);
const wandSources=baseline.records.find((r)=>r.payload.definition.id===w.id).payload.originals;
assert.ok(wandSources.some((o)=>o.raw.payload?.index==="wand-of-annoyance"&&o.raw.payload?.name==="Wand of Annoyance"));
assert.equal(secondWand.payload.index,"wand-of-annoyance");
w.name="Varita del fastidio";w.aliases=[...new Set([...w.aliases,"Varita de molestar","Wand of Annoyance"])];w.category="wand";w.rarity="uncommon";w.weight={value:0.2,unit:"lb"};
w.requirements={attunement:true,presence:"held",bearer:[],explanation:"Empuñarla y estar sintonizado con ella. El sentido del humor es ambientación, no un requisito de personaje."};
w.description=[paragraph("wand-flavor","Esta varita corta y ligeramente torcida tiene símbolos irregulares que parecen moverse cuando no se los observa. Al sostenerla emite un zumbido tenue, como un insecto atrapado en una linterna.","flavor"),paragraph("wand-rule","Como acción, gasta 1 carga y elige una criatura que puedas ver a 30 pies o menos. Debe superar una salvación de Sabiduría CD 14. Si falla, queda fastidiada hasta el comienzo de tu siguiente turno y tiene desventaja en la primera salvación de Constitución que realice para mantener la concentración durante ese intervalo. Después de esa salvación termina la desventaja. Si no realiza ninguna, el efecto expira al comienzo de tu siguiente turno. Una salvación exitosa evita el efecto."),paragraph("wand-limits","La varita no inflige daño ni rompe automáticamente la concentración, no impide acciones ni reacciones y no penaliza otras salvaciones, pruebas o ataques. El fastidio se manifiesta como suspiros, quejas o irritación; no es un estado oficial de 5e."),paragraph("wand-charges","Tiene 3 cargas y recupera todas las cargas gastadas al amanecer. No recupera cargas por un descanso. No puede activarse sin cargas."),paragraph("wand-durability","No puede destruirse por medios ordinarios. Su destrucción mediante magia o acontecimientos especiales se resuelve por el GM."),paragraph("wand-consolidation","Regla custom consolidada por autorización del GM. Las versiones antiguas discrepaban en CD, cargas, sintonización y rareza. Se mantienen acción, alcance y salvación de Sabiduría de la descripción detallada, y CD 14 y tres cargas al amanecer de la versión de campaña. La penalización concreta de concentración, rareza poco común y duración hasta el siguiente turno del usuario se definen en esta consolidación; no se atribuyen a un manual oficial.")];
w.resources=[{id:"annoyance-charges",name:"Cargas",kind:"charges",maximum:3,unit:"cargas",recovery:{kind:"event",event:"dawn",explanation:"Recupera las tres cargas al amanecer.",amount:{kind:"full"}},exhaustion:"No puede activarse sin una carga disponible."}];
w.capabilities=[capability(w,"annoyance","Provocar fastidio","action",[{id:"concentration-disadvantage",kind:"defense",defense:"disadvantage",target:"next-concentration-save",condition:"Solo si falla Sabiduría CD 14; una salvación de Constitución para mantener concentración, antes del siguiente turno del usuario."}],{range:"30 pies; criatura visible",duration:"Hasta el comienzo de tu siguiente turno; la desventaja termina al aplicarse una vez.",costs:[{resourceId:"annoyance-charges",amount:1}],execution:{mode:"assisted",handler:"equipment-text-assistance",explanation:"El botón gasta una carga. El objetivo realiza su salvación y aplica, si corresponde, la desventaja al único chequeo de concentración indicado.",pendingAutomation:["Seleccionar el objetivo, resolver su salvación de Sabiduría y registrar o retirar en su ficha la desventaja a una sola salvación de concentración."]}})];
definitions.push({key:wand.content_key,before:wand,origin:"gm",tags:["es","custom","revisado"],definition:w,mergedOriginal:secondWand});
w.capabilities[0].textBlockIds=["wand-rule","wand-limits","wand-charges"];

const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
try {const {EquipmentDefinitionDraftSchema}=await server.ssrLoadModule("/src/domain/equipment/equipment-definition.ts");for(const row of definitions)row.definition=EquipmentDefinitionDraftSchema.parse(row.definition);}finally{await server.close();}
const retired=snapshot.entries.filter((r)=>!definitions.some((d)=>d.key===r.content_key));assert.equal(retired.length,5);
const plan={revision:snapshot.revision,definitions,retired,remaining:[]};
writeFileSync(`${root}/campaign-resolution-plan.json`,JSON.stringify(plan));
writeFileSync(`${root}/campaign-resolution-before.json`,JSON.stringify(snapshot));
writeFileSync("docs/v2/equipment-preparation-2026-10-17/campaign-resolution-definitions.json",JSON.stringify(definitions.map((r)=>r.definition),null,2));
console.log(JSON.stringify({updated:definitions.map((r)=>r.definition.name),retired:retired.map((r)=>r.name),remaining:0}));
