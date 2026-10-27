import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "vite";

const [input, reference, output] = process.argv.slice(2);
if (!input || !reference || !output) throw new Error("Uso: node scripts/audit-monsters.mjs campaña.json originales.json informe.json");
const rows = JSON.parse(await readFile(input, "utf8")), originals = new Map(JSON.parse(await readFile(reference, "utf8")).map(r => [r.content_key, r.payload]));
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { auditMonsterDefinition } = await server.ssrLoadModule("/src/domain/monsters/monster-audit.ts");
  const report = rows.map(row => {
    const issues = auditMonsterDefinition(row.payload), original = originals.get(row.content_key);
    const matchesPreservedCatalog = !!original && JSON.stringify(original) === JSON.stringify(row.payload);
    return { contentKey: row.content_key, name: row.name, revision: row.revision, origin: row.origin,
      sourceHash: createHash("sha256").update(JSON.stringify(row.payload)).digest("hex"),
      status: issues.length ? "requires-review" : matchesPreservedCatalog ? "matches-preserved-catalog" : "requires-source-review",
      evidence: matchesPreservedCatalog ? "Coincide con el catálogo original conservado; no equivale a un cotejo editorial de las reglas." : row.payload.legacyData ? "Conserva legacyData; revisar diferencias y personalizaciones." : "Texto actual conservado; no hay un original independiente en esta captura.",
      issues };
  });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ capturedAt: new Date().toISOString(), total: rows.length, summary: report.reduce((s,r) => ({...s,[r.status]:(s[r.status]??0)+1}),{}), monsters: report }, null, 2));
  console.log(JSON.stringify({ total: report.length, flagged: report.filter(r=>r.issues.length).length, output }));
} finally { await server.close(); }
