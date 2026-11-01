import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root='docs/v2/equipment-copy-text-2026-11-01/',before=JSON.parse(readFileSync(root+'before.json','utf8'));
const english=new Map([
 ['inv_287ad8a6f407e5a55c1a734ca4ae1247',{start:'A component pouch is a small, watertight leather belt pouch',coverage:['Saquito de componentes.','No incluye los componentes que tengan un coste específico']}],
 ['inv_3291b2c39524476b818bd6c416a3aba7',{start:'A holy symbol is a representation of a god or pantheon.',coverage:['Símbolo sagrado.','El apéndice MJ-B','Un clérigo o un paladín','sostener el símbolo en la mano']}],
 ['inv_abcec5552b1d22eca585a6948f9a5fce',{start:'An arcane focus is a special item--an orb, a crystal, a rod,',coverage:['Canalizador arcano.','orbe, un cristal, un cetro','Los brujos, hechiceros y magos']}],
]);
const changes=before.map(r=>{
 const note=r.payload.rules.personalDescription,eng=english.get(r.id),text=r.payload.rules.definition.description.filter(b=>b.type==='paragraph').map(b=>b.text).join('\n');
 if(eng){assert.ok(note.startsWith(eng.start));for(const phrase of eng.coverage)assert.ok(text.includes(phrase),phrase);}
 else assert.equal(note,'Entrada oficial reutilizada del catálogo de campaña.');
 return{owner:r.owner,id:r.id,hash:r.hash,name:r.payload.name,reason:eng?'El texto auxiliar inglés está íntegramente cubierto por la regla oficial española.':'Nota interna sin contenido de juego.',before:note,after:''};
});
assert.equal(changes.length,24);assert.equal(changes.filter(c=>english.has(c.id)).length,3);
writeFileSync(root+'plan.json',JSON.stringify({baselineRevision:1757,changes},null,2));
const q=s=>`'${String(s).replaceAll("'","''")}'`,cid='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd',owners=[...new Set(changes.map(c=>c.owner))];
const body=changes.map(c=>{
 const where=`campaign_id=${q(cid)} and fragment_kind='character-inventory' and parent_id=${q(c.owner)} and entity_id=${q(c.id)}`;
 return `if not exists(select 1 from public.campaign_state_fragments t where ${where} and md5(to_jsonb(t)::text)=${q(c.hash)})then raise exception 'COPY_TEXT_CHANGED:${c.id}';end if;update public.campaign_state_fragments set payload=jsonb_set(payload,'{rules,personalDescription}','""'::jsonb,true),revision=revision+1,updated_at=statement_timestamp() where ${where};`;
}).join('\n');
writeFileSync(root+'publish.sql',`begin;lock table public.campaigns,public.campaign_state_fragments,public.campaign_character_versions in share row exclusive mode;do $copytext$ begin if(select state_revision from public.campaigns where id=${q(cid)})<>1757 then raise exception 'COPY_TEXT_CAMPAIGN_CHANGED';end if;${body}\nupdate public.campaign_character_versions set revision=revision+1,updated_at=statement_timestamp() where campaign_id=${q(cid)} and character_id in(${owners.map(q).join(',')});update public.campaigns set state_revision=state_revision+1,state_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(cid)};end $copytext$;select 24 as cleaned,(select state_revision from public.campaigns where id=${q(cid)})as revision;commit;`);
console.log(JSON.stringify({copies:24,boilerplate:21,englishCoveredInSpanish:3,characters:owners.length}));
