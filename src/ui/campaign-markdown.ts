export interface CampaignMarkdownHeading {
  level: number;
  text: string;
  id: string;
}

export interface RenderedCampaignMarkdown {
  html: string;
  headings: CampaignMarkdownHeading[];
}

export function escapeCampaignHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function slug(value: string): string {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "seccion";
}

function safeLink(value: string): string | null {
  const candidate = value.trim();
  if (candidate.startsWith("#")) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? candidate : null;
  } catch {
    return null;
  }
}

function inlineMarkdown(value: string): string {
  const tokens: string[] = [];
  const stash = (html: string): string => `\u0000${tokens.push(html) - 1}\u0000`;
  let source = value.replace(/\u0000/g, "");
  source = source.replace(/`([^`]+)`/g, (_match, code: string) => stash(`<code>${escapeCampaignHtml(code)}</code>`));
  source = source.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    const safe = safeLink(href);
    return safe ? stash(`<a href="${escapeCampaignHtml(safe)}" target="_blank" rel="noreferrer">${escapeCampaignHtml(label)}</a>`) : label;
  });
  let html = escapeCampaignHtml(source);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
  return html.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => tokens[Number(index)] ?? "");
}

export function campaignMarkdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function renderCampaignMarkdown(markdown: string): RenderedCampaignMarkdown {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  const headings: CampaignMarkdownHeading[] = [];
  const usedIds = new Map<string, number>();
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let quote: string[] = [];

  const flushParagraph = (): void => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = (): void => {
    if (!list) return;
    output.push(`</${list}>`);
    list = null;
  };
  const flushQuote = (): void => {
    if (!quote.length) return;
    output.push(`<blockquote><p>${inlineMarkdown(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };
  const flushBlocks = (): void => { flushParagraph(); closeList(); flushQuote(); };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) { flushBlocks(); continue; }
    const heading = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (heading) {
      flushBlocks();
      const level = heading[1]!.length;
      const text = campaignMarkdownToPlainText(heading[2]!);
      const baseId = slug(text);
      const count = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, count + 1);
      const id = count ? `${baseId}-${count + 1}` : baseId;
      headings.push({ level, text, id });
      output.push(`<h${level} id="${id}">${inlineMarkdown(heading[2]!)}</h${level}>`);
      continue;
    }
    if (/^([-*_])\1{2,}$/.test(line.trim())) { flushBlocks(); output.push("<hr>"); continue; }
    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph(); flushQuote();
      const wanted = unordered ? "ul" : "ol";
      if (list !== wanted) { closeList(); list = wanted; output.push(`<${list}>`); }
      output.push(`<li>${inlineMarkdown((unordered ?? ordered)![1]!)}</li>`);
      continue;
    }
    const blockquote = /^\s*>\s?(.*)$/.exec(line);
    if (blockquote) { flushParagraph(); closeList(); quote.push(blockquote[1]!); continue; }
    closeList(); flushQuote(); paragraph.push(line.trim());
  }
  flushBlocks();
  return { html: output.join("\n"), headings };
}
