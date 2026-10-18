/** Recover the remaining source context without changing owned-instance mechanics. */
import{readFileSync,writeFileSync}from'node:fs';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{equipmentRetirementCatalog}from'./equipment-retirement-catalog.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),root='tmp/equipment-definitions',rows=equipmentRetirementCatalog();
const boatPage=read('tmp/pdfs/srd-equipment-lines.json').find(p=>p.page===74);assert.ok(boatPage);
const start=boatPage.lines.findIndex(l=>l.text.trim().startsWith('Barcos de remos.'));
const end=boatPage.lines.findIndex((l,i)=>i>start&&l.text.trim()==='Monturas y otros animales');assert.ok(start>=0&&end>start);
const boat={name:'Barcos de remos',page:74,lines:boatPage.lines.slice(start,end)};
const prose=read('tmp/pdfs/srd-mundane-prose.json');if(!prose.some(p=>p.name===boat.name))prose.push(boat);
writeFileSync('tmp/pdfs/srd-mundane-prose.json',JSON.stringify(prose));
const cloak=read('tmp/pdfs/xge-magic-items.json').find(p=>p.name==='Capa de Muchos Estilos');assert.ok(cloak);
const changes=[],translations=[];
for(const row of rows){
 const d=structuredClone(row.payload.rules?.definition);if(!d)continue;
 const index=({'official:equipment:es:3b131c6fcc80d1ebd51cc521':'cloak','official:equipment:es:ada2351ae3c3ff654d40cb56':'keelboat','official:equipment:es:198cf5e385f3109703e813d3':'rowboat','official:equipment:es:b2ccc2c141497ce32fa56712':'amulet-of-the-devout-1','official:equipment:es:8c306d2c8891ec0be3ed4ecf':"rhythm-maker's-drum-1"})[row.content_key];if(!index)continue;
 if(index==='cloak'){
  const source=d.sources.find(s=>s.id==='xge-provided-cloak');assert.ok(source);source.verified=true;source.locator='C:/Users/joaqu/Downloads/Guia de Xanathar para todo (1).pdf · página PDF 141';
  d.description.find(b=>b.id==='cloak-rules').text=cloak.lines.slice(1).map(l=>l.text).join(' ').replace(/\s+/g,' ').trim();
  d.review.editorial=true;d.review.unresolved=d.review.unresolved.filter(s=>!s.includes('Texto cotejado'));
 }else if(index==='keelboat'||index==='rowboat'){
  const sid='srd-5.1-es-waterborne-context';
  d.sources.push({id:sid,kind:'srd',title:'SRD 5.1 · edición oficial española · barcos de remos',language:'es',rulesEdition:'2014',locator:'https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf · página PDF 74 · CC BY 4.0',verified:true});
  d.description.push({id:'official-waterborne-context',type:'paragraph',section:'rules',provenance:'official-spanish',sourceIds:[sid],text:boat.lines.map(l=>l.text).join(' ').replace(/\s+/g,' ').trim()});
 }else{
  const legacy=rows.find(r=>r.payload.index===index&&!r.payload.rules&&r.content_key.includes(':eng:'));assert.ok(legacy);
  const sid='reviewed-own-translation';
  d.sources.push({id:sid,kind:'legacy',title:'Traducción propia revisada del texto inglés conservado; identidad y beneficios corroborados por D&D Beyond',language:'es',rulesEdition:'2014',locator:legacy.content_key,verified:false});
  const texts=index==='amulet-of-the-devout-1'?[
   'Este amuleto lleva el símbolo de una deidad incrustado con piedras o metales preciosos. Mientras llevas puesto el símbolo sagrado, obtienes un bonificador de +1 a las tiradas de ataque de conjuros y a las CD de las tiradas de salvación de tus conjuros.',
   'Mientras llevas puesto este amuleto, puedes usar tu rasgo Canalizar divinidad sin gastar uno de sus usos. Una vez usada esta propiedad, no puede volver a usarse hasta el siguiente amanecer.',
   'Requiere sintonización por un clérigo o paladín.'
  ]:[
   'Mientras sostienes este tambor, obtienes un bonificador de +1 a las tiradas de ataque de conjuros y a las CD de las tiradas de salvación de tus conjuros de bardo.',
   'Como acción, puedes tocar el tambor para recuperar un uso de tu rasgo Inspiración bárdica. Esta propiedad del tambor no puede volver a usarse hasta el siguiente amanecer.',
   'Requiere sintonización por un bardo.'
  ];
  d.description=d.description.map((b,i)=>({...b,text:texts[i],provenance:'reviewed-translation',sourceIds:[sid,'tasha-official-identification']}));
  d.review.editorial=true;d.review.information=true;
  d.review.unresolved=d.review.unresolved.filter(s=>!s.includes('Falta cotejar')&&!s.startsWith('Conservar originales'));
  d.review.unresolved.push('Traducción propia revisada; sustituir por la traducción editorial oficial si se obtiene. El artículo oficial corrobora identidad y beneficios, no acredita el texto íntegro del libro.');
  translations.push({key:row.content_key,index,legacyKey:legacy.content_key,englishSha256:createHash('sha256').update(JSON.stringify(legacy.payload.description)).digest('hex'),texts,sourceLimitation:'Texto inglés existente en la base y resumen oficial público. No se atribuye la traducción a la editorial ni se afirma haber accedido al texto completo de pago.'});
 }
 d.revision++;changes.push({key:row.content_key,index,definition:d});
}
assert.equal(changes.length,5);
writeFileSync(root+'/final-context-reviews.json',JSON.stringify(changes));
writeFileSync('docs/v2/equipment-retirement-2026-10-18/final-context-translations.json',JSON.stringify(translations,null,2));
writeFileSync('docs/v2/equipment-retirement-2026-10-18/final-context-definitions.json',JSON.stringify(changes.map(c=>c.definition)));
console.log(JSON.stringify({definitions:changes.length,ownTranslations:translations.length}));
