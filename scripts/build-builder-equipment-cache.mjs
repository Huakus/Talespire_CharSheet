import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {equipmentRetirementCatalog} from './equipment-retirement-catalog.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),audit=read('tmp/equipment-definitions/builder-equipment-bindings-audit.json'),active=new Set(read('tmp/equipment-definitions/new-builder-equipment-audit.json').catalogNames.map(r=>r.key)),catalog=equipmentRetirementCatalog().filter(r=>active.has(r.content_key));
const overrides={cart:'Carreta',carriage:'Carruaje'};
const entries=audit.map(r=>{const matches=overrides[r.index]?r.matches.filter(m=>m.name===overrides[r.index]):r.matches;assert.equal(matches.length,1,r.index);const source=catalog.find(c=>c.content_key===matches[0].key);assert.ok(source);const d=source.payload.rules.definition;assert.equal(d.language,'es');assert.equal(d.origin,'official');assert.equal(d.magical,false);
 return {index:r.index,definition:d,catalog:{contentKey:source.content_key,origin:'official',tags:['es','reglas_2014'],revision:source.revision}};});
writeFileSync('src/domain/equipment/builder-equipment-cache.json',JSON.stringify(entries));
writeFileSync('docs/v2/equipment-completion-2026-10-19/builder-equipment-bindings.json',JSON.stringify(entries.map(e=>({index:e.index,key:e.catalog.contentKey,name:e.definition.name})),null,2));
console.log(JSON.stringify({localizedTemplates:entries.length,uniqueDefinitions:new Set(entries.map(e=>e.catalog.contentKey)).size}));
