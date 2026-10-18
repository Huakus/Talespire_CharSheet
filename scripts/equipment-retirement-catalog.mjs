import { readFileSync, existsSync } from "node:fs";
/** Historical imports stay immutable; only verified current catalog rows overlay them. */
export function equipmentRetirementCatalog() {
  const root = "tmp/equipment-definitions", read = path => JSON.parse(readFileSync(path, "utf8"));
  const rows = [0, 1, 2, 3].flatMap(n => read(`${root}/cleanup-live-${n}.json`));
  const patches = `${root}/retirement-catalog-patches.json`;
  if (!existsSync(patches)) return rows;
  const current = new Map(read(patches).map(row => [row.content_key, row]));
  return rows.map(row => current.get(row.content_key) ?? row);
}
