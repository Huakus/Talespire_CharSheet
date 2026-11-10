import { describe, expect, it } from "vitest";
import { build, parseSync, type ESTree } from "vite";

function walk(node: ESTree.Node, visit: (node: ESTree.Node) => void): void {
  visit(node);
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object" && typeof child.type === "string") walk(child as ESTree.Node, visit);
    }
  }
}

function staticString(node: ESTree.Node): string | null {
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis.map(part => part.value.cooked ?? part.value.raw).join("");
  return null;
}

/** Part of the default V2 checks: mocking import() misses production CSS preloads. */
describe("production interface styles", () => {
  it("preloads each presentation's own CSS, including Nueva", async () => {
    // Keep production minification enabled: the original ternary worked without
    // minification, but its CSS preload branches were merged in the real build.
    const result = await build({ logLevel: "silent", build: { write: false, emptyOutDir: false } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one in-memory production bundle");
    const entry = result.output.find(output => output.type === "chunk" && output.isEntry);
    if (!entry || entry.type !== "chunk") throw new Error("Application entry not emitted");
    const source = parseSync("entry.js", entry.code).program;
    let dependencyMap: string[] = [];
    walk(source, node => {
      if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.id.name === "__vite__mapDeps") {
        walk(node, child => {
          if (child.type === "ArrayExpression") {
            const values = child.elements.flatMap(value => value?.type === "Literal" && typeof value.value === "string" ? [value.value] : []);
            if (values.some(value => value.endsWith(".css"))) dependencyMap = values;
          }
        });
      }
    });
    const preloads = new Map<string, string[]>();
    walk(source, node => {
      if (node.type === "CallExpression" && node.arguments.length >= 2) {
        const imported: string[] = [];
        walk(node.arguments[0]!, child => {
          if (child.type === "ImportExpression") {
            const path = staticString(child.source);
            if (path !== null) imported.push(path);
          }
        });
        const dependencies = node.arguments[1]!;
        if (imported.length && dependencies.type === "CallExpression" && dependencies.arguments[0]?.type === "ArrayExpression") {
          const paths = dependencies.arguments[0].elements.map(index => index?.type === "Literal" && typeof index.value === "number" ? dependencyMap[index.value] : undefined)
            .filter((path): path is string => path !== undefined);
          for (const path of imported) preloads.set(path, paths);
        }
      }
    });
    const css = (paths: string[]): string => paths.filter(path => path.endsWith(".css")).map(path => {
      const fileName = new URL(path, `https://bundle.invalid/${entry.fileName}`).pathname.slice(1);
      const asset = result.output.find(output => output.fileName === fileName);
      if (!asset || asset.type !== "asset") throw new Error(`Missing preloaded stylesheet: ${path}`);
      return typeof asset.source === "string" ? asset.source : new TextDecoder().decode(asset.source);
    }).join("\n");
    const next = [...preloads].find(([path]) => path.includes("next-views"));
    const classic = [...preloads].find(([path]) => path.includes("classic-views"));
    expect(next, "Nueva must have its own preload branch").toBeDefined();
    expect(classic, "Actual must have its own preload branch").toBeDefined();
    expect(css(next![1]).includes(".next-interface"), "Nueva must preload its own styles").toBe(true);
    expect(css(next![1]).includes(".sheet-hero"), "Nueva must not preload Actual's styles").toBe(false);
    expect(css(classic![1]).includes(".sheet-hero"), "Actual must preload its own styles").toBe(true);
    expect(css(classic![1]).includes(".next-interface"), "Actual must not preload Nueva's styles").toBe(false);
  }, 30_000);
});
