import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Regenerate only the canonical review HTML. No app dependency or build change.
// Supply an extracted lucide-static@0.468.0 package (npm pack --ignore-scripts).
const project = fileURLToPath(new URL('../', import.meta.url));
const assets = resolve(process.argv[2] ?? join(project, '.tmp/package'));
const target = join(project, 'docs/v2/ui-redesign/compact-icon-sheet.html');
const start = '<!-- BEGIN LOCAL ICON SPRITE -->';
const end = '<!-- END LOCAL ICON SPRITE -->';
const html = await readFile(target, 'utf8');
const before = html.slice(0, html.indexOf(start));
const after = html.slice(html.indexOf(end) + end.length);
if (!html.includes(start) || !html.includes(end)) throw new Error('Missing sprite markers');
const source = before + after;
const names = [...new Set([...source.matchAll(/['"]([a-z][a-z0-9-]*)['"]/g)].map(match => match[1]))].sort();
const symbols = [];
for (const name of names) {
  const path = join(assets, 'icons', name + '.svg');
  try { await access(path); } catch { continue; }
  const svg = await readFile(path, 'utf8');
  const body = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1];
  if (!body || /<(?:script|foreignObject)|\bon\w+=|href=/i.test(body)) throw new Error('Unexpected SVG '+name);
  symbols.push(`    <symbol id="ts-icon-${name}" viewBox="0 0 24 24">${body.trim()}</symbol>`);
}
const license = (await readFile(join(assets, 'LICENSE'), 'utf8')).trim();
const attribution = `Lucide static 0.468.0. Official SVG assets; no runtime library/network required.
Source: https://www.npmjs.com/package/lucide-static/v/0.468.0
Regenerate: node scripts/update-ui-prototype-icons.mjs <extracted-package-directory>

${license}

MIT License for Feather-derived icons:
Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const sprite = `${start}
  <!-- ${attribution} -->
  <svg xmlns="http://www.w3.org/2000/svg" class="ic-icon-sprite" aria-hidden="true" width="0" height="0"><defs>
${symbols.join('\n')}
  </defs></svg>
  ${end}`;
await writeFile(target, before + sprite + after, 'utf8');
console.log(JSON.stringify({icons:symbols.length, file:'docs/v2/ui-redesign/compact-icon-sheet.html'}));
