import { describe, expect, it } from "vitest";
import { campaignMarkdownToPlainText, renderCampaignMarkdown } from "../../src/ui/campaign-markdown";

describe("campaign Markdown renderer", () => {
  it("renders campaign headings and common inline formatting", () => {
    const rendered = renderCampaignMarkdown("## Capítulo uno\n\n### Un encuentro\n\nAdler conoce a **Delerion** y *desconfía*.\n\n- Una pista\n- Otra pista");
    expect(rendered.headings).toEqual([
      { level: 2, text: "Capítulo uno", id: "capitulo-uno" },
      { level: 3, text: "Un encuentro", id: "un-encuentro" },
    ]);
    expect(rendered.html).toContain('<h2 id="capitulo-uno">Capítulo uno</h2>');
    expect(rendered.html).toContain("<strong>Delerion</strong>");
    expect(rendered.html).toContain("<em>desconfía</em>");
    expect(rendered.html).toContain("<ul>\n<li>Una pista</li>");
  });

  it("escapes embedded HTML and rejects unsafe link protocols", () => {
    const rendered = renderCampaignMarkdown('<script>alert("x")</script> [abrir](javascript:alert(1))');
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain('href="javascript:');
  });

  it("creates concise plain-text excerpts", () => {
    expect(campaignMarkdownToPlainText("### Hallazgo\n\n**Adler** encuentra [una pista](https://example.com)."))
      .toBe("Hallazgo Adler encuentra una pista.");
  });
});
