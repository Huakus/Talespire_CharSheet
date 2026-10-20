import { readFileSync, writeFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const root = "tmp/equipment-definitions";
const read = name => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const batch=process.argv[2]??"tools-context";assert.match(batch,/^[a-z-]+$/);
const before = read(`${batch}-before.json`), after = read(`${batch}-after.json`), plan = read(`${batch}-publication.json`);
assert.equal(after.revision, before.revision + 1);
assert.deepEqual(after.guards, before.guards);
for (const [entries, expected, key] of [[after.entries, plan.definitions, "content_key"], [after.inventories, plan.fragments, "entity_id"], [after.merchants, plan.merchants, "content_key"]]) {
  assert.equal(entries.length, expected.length);
  for (const change of expected) {
    const old = change.before, next = entries.find(row => row[key] === old[key] && row.parent_id === old.parent_id);
    assert.ok(next, old[key]);
    assert.deepEqual(next.payload, change.payload, old[key]);
    assert.equal(next.revision, old.revision + 1);
    for (const field of Object.keys(old).filter(k => !["payload", "revision", "updated_at", "name"].includes(k))) assert.deepEqual(next[field], old[field], field);
    assert.equal(next.name, change.name ?? old.name);
  }
}
for (const old of before.versions) assert.equal(after.versions.find(v => v.character_id === old.character_id).revision, old.revision + 1);
const result = { revision: after.revision, catalog: after.entries.length, characterCopies: after.inventories.length, characters: after.versions.length, merchants: after.merchants.length, merchantCopies: before.merchants.reduce((n, m) => n + m.payload.inventory.filter(i => plan.definitions.some(d => d.key === i.catalog?.contentKey)).length, 0), instanceStatePreserved: true, protectedHashesEqual: true, hashes: after.guards };
const evidenceDirectory = process.argv[3] ?? "docs/v2/equipment-retirement-2026-10-18";
assert.match(evidenceDirectory, /^docs\/v2\/equipment-(?:retirement|completion)-\d{4}-\d{2}-\d{2}$/);
writeFileSync(`${evidenceDirectory}/${batch}-verified.json`, JSON.stringify(result, null, 2));
// Subsequent audits can overlay these current canonical rows on the immutable historical snapshot.
const patches=existsSync(`${root}/retirement-catalog-patches.json`)?read("retirement-catalog-patches.json"):[];
writeFileSync(`${root}/retirement-catalog-patches.json`, JSON.stringify([...new Map([...patches,...after.entries].map(row=>[row.content_key,row])).values()]));
console.log(JSON.stringify(result));
