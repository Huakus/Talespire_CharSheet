import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
const root='tmp/equipment-definitions',read=n=>JSON.parse(readFileSync(root+'/'+n,'utf8')),m=read('equipment-release-current-metadata.json'),usage=read('usage-context-after.json'),final=read('final-context-after.json'),relink=read('spanish-duplicate-relink-after.json'),plan=read('spanish-duplicate-relink-plan.json');
assert.deepEqual(relink.copy.payload,plan.after);assert.equal(relink.version.revision,plan.before.version.revision+1);
const rows=[...new Map([...usage.inventories,...final.inventories,relink.copy].map(r=>[r.parent_id+':'+r.entity_id,r])).values()];
writeFileSync(root+'/equipment-release-usage-patch.json',JSON.stringify({...m,campaignUpdatedAt:new Date(m.campaignUpdatedAt).toISOString(),rows}));
writeFileSync(root+'/equipment-release-last-retirement.json',JSON.stringify({revision:m.revision,campaignUpdatedAt:m.campaignUpdatedAt}));
console.log(JSON.stringify({revision:m.revision,updatedCopies:rows.length}));
