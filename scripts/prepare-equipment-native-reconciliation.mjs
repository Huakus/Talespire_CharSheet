import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{groups}from'./equipment-functional-review-decisions.mjs';
const root='docs/v2/equipment-native-reconciliation-2026-11-01/';mkdirSync(root,{recursive:true});
const scope=JSON.parse(readFileSync('docs/v2/equipment-functional-audit-2026-11-01/scope.json','utf8'));
const keys=[...groups.verified,...groups.table].map(n=>scope.items[n-1].key);
keys.push('gm:equipment:1b428562-bbef-4bec-8445-a76f7e16f854','official:equipment:es:ef95f23bd99224f3cdf64a7d');
const books={
 'official:equipment:es:69d561ca2c3a56764e71cebd':'constitution',
 'official:equipment:es:669dbf2489ed293bb38d8a17':'dexterity',
 'official:equipment:es:f04899b83f054b78715736ed':'strength',
 'official:equipment:es:6f6157682bba7d1b46c44ff2':'wisdom',
 'official:equipment:es:e6fb55a58513814680574185':'charisma',
 'official:equipment:es:6f505d7deed241155c4e0b85':'intelligence',
};keys.push(...Object.keys(books));
const q=s=>`'${s.replaceAll("'","''")}'`,cid='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd';
const selection=`campaign_id=${q(cid)} and kind='equipment' and deleted_at is null and (content_key in(${keys.map(q).join(',')}) or payload#>>'{rules,definition,category}'='tool' or exists(select 1 from jsonb_array_elements(payload#>'{rules,definition,capabilities}')cap where cap->>'id' in('vicious-natural-20','flaming-hit')))`;
const all=`with selected as(select content_key from public.campaign_content_entries where ${selection}), data as(select 'ece'::text as scope,content_key as key,name,revision,md5(to_jsonb(t)::text) as hash,payload#>'{rules,definition}' as definition,payload->'features' as features,payload->'charges' as charges from public.campaign_content_entries t where campaign_id=${q(cid)} and kind='equipment' and content_key in(select content_key from selected) union all select 'shared',content_key,name,null,md5(to_jsonb(t)::text),payload#>'{rules,definition}',payload->'features',payload->'charges' from public.official_content_entries t where kind='equipment' and content_key in(select content_key from selected))`;
writeFileSync(root+'count.sql',all+' select count(*)as count from data;');
for(let i=0;i<12;i++)writeFileSync(root+'select-'+String(i).padStart(2,'0')+'.sql',all+` select jsonb_agg(to_jsonb(s))as entries from(select * from data order by scope,key limit 25 offset ${i*25})s;`);
writeFileSync(root+'reviewed-keys.json',JSON.stringify({books,narrative:groups.table.map(n=>scope.items[n-1].key),verified:groups.verified.map(n=>scope.items[n-1].key)}));
console.log('Native reconciliation selection prepared.');
