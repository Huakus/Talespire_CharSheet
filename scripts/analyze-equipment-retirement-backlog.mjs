import { readFileSync,writeFileSync } from "node:fs";
import { createServer } from "vite";
const root="tmp/equipment-definitions",out="docs/v2/equipment-retirement-2026-10-18";
const read=n=>JSON.parse(readFileSync(`${root}/${n}`,"utf8"));
const rows=[0,1,2,3].flatMap(n=>read(`cleanup-live-${n}.json`)),byKey=new Map(rows.map(r=>[r.content_key,r]));
const retired=new Set(JSON.parse(readFileSync(`${out}/manifest.json`,"utf8")).rows.map(r=>r.key));
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:"custom"});
try{
 const {simpleEquipmentReplacementIssues}=await server.ssrLoadModule("/src/domain/equipment/equipment-retirement.ts");
 const pending=read("cleanup-analysis.json").filter(r=>!retired.has(r.key)).map(r=>{
   const candidates=r.candidates.map(c=>byKey.get(c.key));
   return {key:r.key,name:r.name,candidates:candidates.map(c=>({key:c.content_key,name:c.name})),
     checks:candidates.length===1?simpleEquipmentReplacementIssues(byKey.get(r.key).payload,candidates[0].payload.rules.definition):["Comparar candidatos: la relación por nombre o índice no certifica equivalencia."]};
 });
 const checks={};
 for(const row of pending)for(const check of new Set(row.checks))checks[check]=(checks[check]??0)+1;
 const report={revision:1288,englishPending:pending.length,allHaveSpanishCandidates:pending.every(r=>r.candidates.length),
   candidatesStillRequireReview:true,countsOverlap:true,checkCounts:checks,rows:pending};
 writeFileSync(`${out}/pending.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({englishPending:report.englishPending,allHaveSpanishCandidates:report.allHaveSpanishCandidates,countsOverlap:true,checkCounts:checks}));
}finally{await server.close();}
