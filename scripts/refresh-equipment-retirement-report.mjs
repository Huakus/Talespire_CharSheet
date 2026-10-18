import {readFileSync,writeFileSync,readdirSync,existsSync} from "node:fs";
import assert from "node:assert/strict";
import {equipmentRetirementCatalog} from "./equipment-retirement-catalog.mjs";
const base="docs/v2/equipment-retirement-2026-10-18",root="tmp/equipment-definitions",read=p=>JSON.parse(readFileSync(p,"utf8"));
const stages=['',...readdirSync(base,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='shared'&&existsSync(base+'/'+d.name+'/manifest.json')&&existsSync(base+'/'+d.name+'/verified.json')).map(d=>'/'+d.name)].sort((a,b)=>read(base+a+'/verified.json').revision-read(base+b+'/verified.json').revision),manifests=stages.map(s=>read(base+s+"/manifest.json")),removed=new Set(manifests.flatMap(m=>m.rows.map(r=>r.key)));
const preparations=manifests.flatMap(m=>m.preparationKeys),rows=equipmentRetirementCatalog(),byKey=new Map(rows.map(r=>[r.content_key,r]));
const oldAudit=read(`${root}/authoritative-audit.json`),metadata=read(`${root}/equipment-release-last-retirement.json`);
const pending=read(`${root}/cleanup-analysis.json`).filter(r=>!removed.has(r.key)).map(r=>({key:r.key,name:r.name,candidates:r.candidates.map(c=>({key:c.key,name:byKey.get(c.key).name})),checks:oldAudit.find(a=>a.key===r.key)?.issues??["Cotejar recuperación de información antes de retirar."]}));
const counts=read(root+'/equipment-release-current-counts.json');assert.equal(metadata.revision,counts.revision);assert.equal(pending.length,counts.english);
const report={revision:metadata.revision,englishPending:pending.length,allHaveSpanishCandidates:pending.every(r=>r.candidates.length),candidatesStillRequireReview:pending.length>0,countsOverlap:true,rows:pending};
writeFileSync(base+"/pending.json",JSON.stringify(report,null,2));
const reseed=read(base+'/reseed-verified.json');
writeFileSync(base+"/current-status.json",JSON.stringify({revision:metadata.revision,normalized:counts.spanish,englishPending:pending.length,preparationsRemaining:counts.preparations,definitionsRetired:removed.size,preparationsRetired:preparations.length,registry:removed.size+preparations.length,allRetiredKeysReseedCheckPassed:reseed.registryCount===removed.size+preparations.length&&reseed.revision===metadata.revision,characters:16,characterItems:241,merchantItems:24,toolDefinitionsCompleted:37,toolCharacterCopiesRefreshed:13,toolMerchantCopiesRefreshed:1,fullAutomationComplete:false,allLegacyRetired:counts.english===0&&counts.preparations===0,stages:stages.map((stage,i)=>({stage:stage||"/initial",definitions:manifests[i].rows.length,preparations:manifests[i].preparationKeys.length}))},null,2));
console.log(JSON.stringify({revision:metadata.revision,definitionsRetired:removed.size,englishPending:pending.length}));
if(existsSync(base+'/shared/verified.json')){
 const status=read(base+'/current-status.json'),shared=read(base+'/shared/verified.json');
 status.shared={normalized:shared.sharedSpanishDefinitions,englishRemaining:shared.sharedEnglishRemaining,rowsRetired:shared.sharedRowsRetired,allExistingCampaignDataPreserved:shared.allExistingCampaignDataPreserved};
 if(existsSync(base+'/mechanics-backlog.json'))status.mechanicsBacklog=read(base+'/mechanics-backlog.json').counts;
 writeFileSync(base+'/current-status.json',JSON.stringify(status,null,2));
}
