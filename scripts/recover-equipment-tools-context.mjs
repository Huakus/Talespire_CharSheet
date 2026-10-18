/** Recover normative context that was absent from several table-only tool records. */
import{readFileSync,writeFileSync}from"node:fs";
import assert from"node:assert/strict";
const root="tmp/equipment-definitions",read=p=>JSON.parse(readFileSync(p,"utf8")),pages=read("tmp/pdfs/srd-equipment-lines.json").filter(p=>[72,73].includes(p.page));
const contexts={};let current=null;
const headings={"Herramientas de artesano":"artisan","Herramientas de ladrón":"thieves","Herramientas de navegante":"navigator","Instrumentos musicales":"instrument","Juegos":"gaming","Útiles de envenenador":"poisoner","Útiles de herborista":"herbalism","Útiles para disfrazarse":"disguise","Útiles para falsificar":"forgery"};
for(const page of pages)for(const line of page.lines){
 if(line.size>=14){current=line.text.trim()==="Herramientas"?"general":null;if(current)contexts[current]={page:page.page,lines:[]};continue;}
 if(current==="general"&&line.text.trim()==="Herramientas"){current=null;continue;}
 if(line.size<9.5)continue;
 const h=Object.keys(headings).find(h=>line.text.trim().startsWith(h+"."));
 if(h){current=headings[h];contexts[current]={page:page.page,lines:[]};}
 if(current)contexts[current].lines.push(line.text);
}
for(const [key,c]of Object.entries(contexts)){
 c.text=c.lines.join(" ").replace(/\s+/g," ").replace(/([\p{L}])-\s+([\p{L}])/gu,"$1$2").trim();
 assert.ok(c.text.length>100,key);
}
assert.equal(Object.keys(contexts).length,10);
assert.ok(contexts.artisan.text.endsWith("competencia independiente."));
assert.ok(contexts.forgery.text.includes("bonificador por competencia"));
const rows=[0,1,2,3].flatMap(n=>read(`${root}/cleanup-live-${n}.json`)),prep=read(`${root}/latest-preparation-baseline.json`).records,changes=[];
for(const row of rows.filter(r=>r.payload.rules?.definition.origin==="official")){
 const d=structuredClone(row.payload.rules.definition),p=prep.find(p=>p.payload.definition.id===d.id)?.payload.originals.find(o=>o.scope==="ECE"&&o.originalKey===d.id.slice(9))?.raw.payload;
 if(!p)continue;
 const group=({"Artisan's Tools":"artisan","Musical Instrument":"instrument","Gaming Sets":"gaming"})[p.tool_category]??
  ({"thieves-tools":"thieves","navigators-tools":"navigator","poisoners-kit":"poisoner","herbalism-kit":"herbalism","disguise-kit":"disguise","forgery-kit":"forgery"})[p.index];
 if(!group)continue;
 const sourceId="srd-5.1-es-tools-context";
 d.sources=d.sources.filter(s=>s.id!==sourceId);
 d.sources.push({id:sourceId,kind:"srd",title:"SRD 5.1 · herramientas, instrumentos y juegos · español oficial",language:"es",rulesEdition:"2014",locator:"https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf · páginas PDF 72–73 · CC BY 4.0",verified:true});
 d.category="tool";
 const rename=({"cooks-utensils":"Útiles de cocinero",shawm:"Chirimía"})[p.index];
 if(rename&&d.name!==rename){d.aliases=[...new Set([...d.aliases,d.name])];d.name=rename;}
 for(const key of ["general",group]){
  const c=contexts[key];
  if(!d.description.some(b=>b.type==="paragraph"&&b.text===c.text))d.description.push({id:"tools-context-"+key,type:"paragraph",section:"rules",provenance:"official-spanish",sourceIds:[sourceId],text:c.text});
 }
 d.revision+=1;
 changes.push({key:row.content_key,index:p.index,group,definition:d});
}
assert.equal(changes.length,37);
writeFileSync(`${root}/tools-context-reviews.json`,JSON.stringify(changes));
writeFileSync("docs/v2/equipment-retirement-2026-10-18/tools-context-definitions.json",JSON.stringify(changes.map(c=>c.definition)));
writeFileSync("docs/v2/equipment-retirement-2026-10-18/tools-context-source.json",JSON.stringify({contexts,items:changes.map(({key,index,group,definition})=>({key,index,group,name:definition.name}))},null,2));
console.log(JSON.stringify({definitions:changes.length,contexts:Object.keys(contexts)}));
