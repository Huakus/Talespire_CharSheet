import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";

const projectRoot = import.meta.dirname;
function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(projectRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}
const sourceDigest = createHash('sha256');
for (const path of [...sourceFiles('src'), 'vite.config.ts', 'package-lock.json', 'manifest.json'].sort()) {
  sourceDigest.update(path).update('\0').update(readFileSync(resolve(projectRoot, path))).update('\0');
}
const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify({ version: manifest.version, sourceHash: sourceDigest.digest('hex'), builtAt: new Date().toISOString() }) },
  base: "./",
  build: {
    outDir: "dist-v2",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "v2.html"),
    },
  },
});
