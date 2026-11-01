import{readFileSync}from'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
for(const path of ['docs/v2/equipment-editorial-cleanup-2026-11-01/inventory-before.json','docs/v2/equipment-completion-2026-10-19/builder-equipment-relink-archive.json','docs/v2/equipment-status-2026-11-01/usage.json']){
 const value=read(path),found=[];
 function walk(v,context={}){if(!v||typeof v!=='object')return;if(Array.isArray(v)){for(const x of v)walk(x,context);return;}
  const name=v.name??v.item_name??v.characterName??'';
  if((typeof name==='string'&&/bast[oó]n|staff|delerion/i.test(name))&&JSON.stringify(v).length<45000)found.push({name,id:v.id??v.key??v.item_id,parent:v.parentId??v.parent_id??v.owner_id,owner:v.owner??v.characterName,catalogKey:v.catalogKey??v.catalog?.contentKey,description:v.description,charges:v.charges,keys:Object.keys(v)});
  for(const[k,x]of Object.entries(v))if(!['original','originals','definition','builder','features','blocks','sources'].includes(k))walk(x,context);
 }walk(value);console.log(JSON.stringify({path,found},null,2));
}
