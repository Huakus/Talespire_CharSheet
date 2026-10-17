/** Writes guarded apply/rollback scripts from reviewed, local backups. Executes no SQL. */
import { readFileSync,writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const root="tmp/spell-cleanup";
const read=(name)=>JSON.parse(readFileSync(`${root}/${name}.json`,"utf8"));
const plan=read("plan"),guards=read("guards"),beforeOfficial=read("official-spells-before"),beforeEce=read("ece-spells-before"),beforeUses=read("ece-used-spells-before");
if(plan.campaignId!=="9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd")throw new Error("Unexpected campaign");
const quote=(s)=>`'${String(s).replaceAll("'","''")}'`;
function data(value){const json=JSON.stringify(value);let marker=`spell_${createHash("sha256").update(json).digest("hex").slice(0,16)}`;while(json.includes(`$${marker}$`))marker+="x";return `$${marker}$${json}$${marker}$::jsonb`;}
const hash=(table,where,order)=>`(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by ${order}),'')) from (select * from public.${table} where ${where}) t)`;
const officialHash=hash("official_content_entries","kind='spell'","content_key");
const eceHash=hash("campaign_content_entries",`kind='spell' and campaign_id=${quote(plan.campaignId)}`,"content_key");
const usedHash=hash("campaign_state_fragments",`fragment_kind='character-spell' and campaign_id=${quote(plan.campaignId)}`,"parent_id,entity_id");
const baseLock=`begin;\nlock table public.official_content_entries in share row exclusive mode;\nlock table public.campaign_content_entries in share row exclusive mode;\nlock table public.campaign_state_fragments in share mode;\n`;
const guard=(expression,expected,label)=>`if ${expression} <> ${quote(expected)} then raise exception ${quote(`SPELL_CLEANUP_CONFLICT:${label}`)}; end if;`;
const insertOfficial=(values)=>`insert into public.official_content_entries select * from jsonb_populate_recordset(null::public.official_content_entries,${data(values)});`;
const keepKeys=plan.customs.map((r)=>quote(r.content_key)).join(",");
const officialInsert=insertOfficial(plan.official);
const oldValues=plan.old.map(({usedBy:_usedBy,...row})=>row);
const eceInsert=(values)=>`insert into public.campaign_content_entries (campaign_id,kind,content_key,name,origin,tags,payload,created_by,updated_by)\nselect ${quote(plan.campaignId)}::uuid,entry.kind,entry.content_key,entry.name,entry.origin,entry.tags,entry.payload,c.owner_user_id,c.owner_user_id\nfrom jsonb_populate_recordset(null::public.official_content_entries,${data(values)}) entry cross join public.campaigns c where c.id=${quote(plan.campaignId)}::uuid;`;
let sql=baseLock+`do $cleanup$ begin\n${guard(officialHash,guards.official,"official") }\n${guard(eceHash,guards.ece,"ECE")}\n${guard(usedHash,guards.used,"learned-spells")}\n`;
sql+=`delete from public.campaign_content_entries where kind='spell' and campaign_id=${quote(plan.campaignId)}::uuid and content_key not in (${keepKeys});\n`;
sql+=`delete from public.official_content_entries where kind='spell';\n${officialInsert}\n`;
for(const custom of plan.customs)sql+=`update public.campaign_content_entries set tags=array['custom'],payload=${data(custom.payload)},revision=revision+1,updated_at=statement_timestamp() where campaign_id=${quote(plan.campaignId)}::uuid and kind='spell' and content_key=${quote(custom.content_key)};\n`;
sql+=eceInsert([...plan.official,...oldValues])+"\n";
sql+=`if (select count(*) from public.official_content_entries where kind='spell') <> 456 then raise exception 'SPELL_CLEANUP_BAD_OFFICIAL_COUNT'; end if;\n`;
sql+=`if (select count(*) from public.campaign_content_entries where kind='spell' and campaign_id=${quote(plan.campaignId)}::uuid and deleted_at is null) <> ${456+2+oldValues.length} then raise exception 'SPELL_CLEANUP_BAD_ECE_COUNT'; end if;\n`;
sql+=guard(usedHash,guards.used,"character-definitions-were-changed")+"\nend $cleanup$;\ncommit;\n";
sql+=`select 'shared' as scope,tags,count(*) as rows from public.official_content_entries where kind='spell' group by tags union all select 'ECE',tags,count(*) from public.campaign_content_entries where kind='spell' and campaign_id=${quote(plan.campaignId)}::uuid and deleted_at is null group by tags order by scope,tags;\n`;
writeFileSync(`${root}/apply.sql`,sql);
// Rollback remains deliberately blocked until its expected post-apply checksums exist.
let rollback=baseLock+"do $rollback$ begin\n";
try{const after=read("guards-after");rollback+=guard(officialHash,after.official,"rollback-official")+"\n"+guard(eceHash,after.ece,"rollback-ECE")+"\n";}catch{rollback+="raise exception 'ROLLBACK_NOT_READY: capture guards-after before recovery';\n";}
rollback+=`delete from public.campaign_content_entries where kind='spell' and campaign_id=${quote(plan.campaignId)}::uuid;\ndelete from public.official_content_entries where kind='spell';\n`;
rollback+=insertOfficial(beforeOfficial)+`\ninsert into public.campaign_content_entries select * from jsonb_populate_recordset(null::public.campaign_content_entries,${data(beforeEce)});\nend $rollback$;\ncommit;\n`;
writeFileSync(`${root}/rollback.sql`,rollback);
const backup={ schemaVersion:1,campaignId:plan.campaignId,official:beforeOfficial,campaignContent:beforeEce,characterSpells:beforeUses,unaffectedCampaignChecksums:read("unaffected-before"),guards };
writeFileSync(`${root}/backup-before.json.gz`,gzipSync(JSON.stringify(backup)));
const files=["official-spells-before.json","ece-spells-before.json","ece-used-spells-before.json","plan.json","apply.sql","rollback.sql","backup-before.json.gz"];
writeFileSync(`${root}/checksums.json`,JSON.stringify(Object.fromEntries(files.map((name)=>[name,createHash("sha256").update(readFileSync(`${root}/${name}`)).digest("hex")])),null,2));
console.log(JSON.stringify({ applyCharacters:sql.length,official:plan.official.length,old:oldValues.length,custom:plan.customs.length,backup:"tmp/spell-cleanup/backup-before.json.gz",executed:false }));
