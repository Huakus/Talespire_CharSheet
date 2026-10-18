import{readFileSync,writeFileSync}from"node:fs";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import { equipmentRetirementCatalog } from "./equipment-retirement-catalog.mjs";
const batch=process.argv[2];assert.match(batch,/^[a-z-]+$/);
const root="tmp/equipment-definitions",read=p=>JSON.parse(readFileSync(p,"utf8"));
const source=equipmentRetirementCatalog(),fresh=read(`${root}/${batch}-destinations-fresh.json`);
const stable=v=>Array.isArray(v)?`[${v.map(stable).join(",")}]`:v&&typeof v==="object"?
 `{${Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")}}`:JSON.stringify(v);
const hashes=fresh.map(f=>{
 const expected=source.find(s=>s.content_key===f.row.content_key);
 assert.ok(expected);assert.equal(stable(f.row),stable(expected),`Destination changed since source audit: ${f.row.content_key}`);
 return{key:f.row.content_key,md5:f.md5,auditedSha256:createHash("sha256").update(stable(expected)).digest("hex")};
});
assert.equal(new Set(hashes.map(h=>h.key)).size,hashes.length);
writeFileSync(`${root}/${batch}-destination-hashes.json`,JSON.stringify(hashes));
console.log(JSON.stringify({comparedCompleteDestinations:hashes.length}));
