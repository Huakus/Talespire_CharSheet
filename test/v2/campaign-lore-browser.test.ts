import { describe, expect, it } from "vitest";
import type { CampaignLoreReader, LoreSearchResult } from "../../src/application/ports/campaign-lore-reader";
import { CampaignLoreBrowser } from "../../src/ui/campaign-lore-browser";

function fakeReader(searchResults: LoreSearchResult[] = []): CampaignLoreReader {
  return {
    loadIndex: async () => ({ entries: [
      { type: "chapter", id: 1, title: "Valverde del Río", aliases: [], chapterNumber: 1, sourceOrder: null, sourcePath: "Lore/Capitulos/01.md" },
      { type: "character", id: 8, title: "Adler", aliases: ["El escriba"], chapterNumber: null, sourceOrder: null, sourcePath: "Lore/Personajes/Adler.md" },
    ] }),
    search: async () => searchResults,
    read: async (type, id) => type === "chapter" && id === 1 ? {
      type, id, title: "Valverde del Río", contentMarkdown: "## Capítulo 1\n\n### Llegada\n\nAdler llega a la ciudad.", aliases: [], chapterNumber: 1,
      sourceOrder: null, sourcePath: "Lore/Capitulos/01.md", related: [{ type: "character", id: 8, title: "Adler", chapterNumber: null }],
    } : null,
  };
}

describe("campaign lore browser", () => {
  it("loads the index and renders the first chapter as a read-only document", async () => {
    const browser = new CampaignLoreBrowser(fakeReader(), () => undefined);
    await browser.load();
    const html = browser.render();
    expect(html).toContain("Biblioteca compartida · solo lectura");
    expect(html).toContain("Valverde del Río");
    expect(html).toContain('data-lore-open="character:8"');
    expect(html).toContain("Adler llega a la ciudad.");
    expect(html).not.toContain("Guardar");
  });

  it("documents advanced syntax and renders expandable search results", async () => {
    const browser = new CampaignLoreBrowser(fakeReader([{
      type: "event", id: 12, title: "Encuentro secreto", chapterNumber: 2, rank: 0.8, excerpt: "**Adler** descubre un secreto.",
    }]), () => undefined);
    await browser.load();
    await (browser as unknown as { search(query: string): Promise<void> }).search('"encuentro secreto"');
    const html = browser.render();
    expect(html).toContain("Frase exacta");
    expect(html).toContain("Adler OR Delerion");
    expect(html).toContain('<details class="lore-result-card">');
    expect(html).toContain("Evento · capítulo 2");
    expect(html).toContain('data-lore-open="event:12"');
  });
});
