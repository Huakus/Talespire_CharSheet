import assert from "node:assert/strict";
const clean=(s)=>s.replace(/\s+/g," ").trim();
const relativeX=(l)=>l.bbox[0]-(l.bbox[0]>=300?270.96:0);
/** Keep tables as columns/rows, including wrapped cells and continuation pages. */
export function srdEquipmentTextBlocks(section,sourceId){
 const lines=[...section.lines],meta=[];while(lines[0]?.fonts.every((f)=>f.includes("Italic")))meta.push(lines.shift());
 const blocks=[],tableChecks=[],repeatedHeaders=[];let paragraph="",paragraphInput=[];
 const addParagraph=()=>{if(paragraph.trim()){blocks.push({id:`official-block-${blocks.length}`,type:"paragraph",section:"rules",provenance:"official-spanish",sourceIds:[sourceId],text:clean(paragraph)});paragraph="";paragraphInput=[];}};
 for(let i=0;i<lines.length;){
  const line=lines[i];
  if(line.size>=9.5){if(/^\s+\S/.test(line.text)&&paragraph)addParagraph();paragraph+=" "+line.text;paragraphInput.push(line);i++;continue;}
  addParagraph();const run=[];while(i<lines.length&&lines[i].size<9.5)run.push(lines[i++]);
  const rows=[];for(const l of run){const key=`${l.page}:${l.bbox[0]>=300}:${Math.round(l.baseline)}`;if(rows.at(-1)?.key===key)rows.at(-1).lines.push(l);else rows.push({key,lines:[l]});}
  const firstData=rows.findIndex((r)=>/^\d/.test(clean(r.lines[0].text)));
  const headerRows=firstData>0&&firstData<5?rows.slice(0,firstData):rows.slice(0,1);
  const header=headerRows.flatMap((r)=>r.lines).sort((a,b)=>relativeX(a)-relativeX(b));
  if(!header||header.length<2){blocks.push({id:`official-block-${blocks.length}`,type:"paragraph",section:"rules",provenance:"official-spanish",sourceIds:[sourceId],text:clean(run.map((l)=>l.text).join(" "))});continue;}
  const starts=[];for(const l of header)if(!starts.some((x)=>Math.abs(x-relativeX(l))<3))starts.push(relativeX(l));
  const columns=starts.map((x)=>headerRows.flatMap((r)=>r.lines).filter((l)=>Math.abs(relativeX(l)-x)<3).map((l)=>clean(l.text)).join(" ")),values=[],notes=[],omitted=[];
  for(const row of rows.slice(headerRows.length)){
   const cells=columns.map(()=>"");
   for(const l of row.lines){const x=relativeX(l);let column=0;for(let n=1;n<starts.length;n++)if(x>=starts[n]-2)column=n;cells[column]=clean(`${cells[column]} ${l.text}`);}
   if(JSON.stringify(cells)===JSON.stringify(columns)){omitted.push(...cells);continue;}
   if(cells[0].startsWith("*")&&cells.slice(1).every((s)=>!s)){notes.push(cells[0]);continue;}
   if(cells[0]||!values.length)values.push(cells);else for(let n=0;n<cells.length;n++)if(cells[n])values.at(-1)[n]=clean(`${values.at(-1)[n]} ${cells[n]}`);
  }
  assert.ok(values.length,section.name);assert.ok(values.every((r)=>r.length===columns.length));
  const original=clean(run.map((l)=>l.text).join(" ")).split(" ").sort();
  const recovered=clean([...columns,...values.flat(),...notes,...omitted].join(" ")).split(" ").sort();
  assert.deepEqual(recovered,original,`Every table word must survive: ${section.name}`);
  repeatedHeaders.push(...omitted);tableChecks.push({columns,rows:values.length});blocks.push({id:`official-block-${blocks.length}`,type:"table",section:"rules",provenance:"official-spanish",sourceIds:[sourceId],columns,rows:values});
  for(const text of notes)blocks.push({id:`official-block-${blocks.length}`,type:"paragraph",section:"rules",provenance:"official-spanish",sourceIds:[sourceId],text});
 }
 addParagraph();assert.ok(blocks.length,section.name);
 const originalWords=clean(lines.map((l)=>l.text).join(" ")).split(" ").sort();
 const recoveredWords=clean([...blocks.flatMap((b)=>b.type==="paragraph"?[b.text]:[...b.columns,...b.rows.flat()]),...repeatedHeaders].join(" ")).split(" ").sort();
 assert.deepEqual(recoveredWords,originalWords,`Every source word must survive: ${section.name}`);
 return {metadata:clean(meta.map((l)=>l.text).join(" ")),blocks,tableChecks};
}
