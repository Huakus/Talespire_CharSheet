import type {
  CampaignLoreReader,
  LoreDocument,
  LoreEntryType,
  LoreIndex,
  LoreIndexEntry,
  LoreSearchResult,
} from "../application/ports/campaign-lore-reader";
import { campaignMarkdownToPlainText, escapeCampaignHtml, renderCampaignMarkdown } from "./campaign-markdown";

const TYPE_LABELS: Record<LoreEntryType, { singular: string; plural: string }> = {
  chapter: { singular: "Capítulo", plural: "Capítulos" },
  character: { singular: "Personaje", plural: "Personajes" },
  location: { singular: "Lugar", plural: "Lugares" },
  event: { singular: "Evento", plural: "Eventos" },
};
const BROWSE_TYPES = Object.keys(TYPE_LABELS) as LoreEntryType[];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sourceLabel(path: string | null): string | null {
  if (!path) return null;
  return path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? null;
}

function entrySort(left: LoreIndexEntry, right: LoreIndexEntry): number {
  if (left.type === "chapter" && right.type === "chapter") return (left.chapterNumber ?? 0) - (right.chapterNumber ?? 0);
  if (left.type === "event" && right.type === "event") return (left.sourceOrder ?? Number.MAX_SAFE_INTEGER) - (right.sourceOrder ?? Number.MAX_SAFE_INTEGER);
  return left.title.localeCompare(right.title, "es", { numeric: true, sensitivity: "base" });
}

function resultContext(result: LoreSearchResult): string {
  const chapter = result.chapterNumber === null ? "" : ` · capítulo ${result.chapterNumber}`;
  return `${TYPE_LABELS[result.type].singular}${chapter}`;
}

export class CampaignLoreBrowser {
  private index: LoreIndex | null = null;
  private loadingIndex = false;
  private browseType: LoreEntryType = "chapter";
  private indexFilter = "";
  private query = "";
  private results: LoreSearchResult[] | null = null;
  private searching = false;
  private selected: { type: LoreEntryType; id: number } | null = null;
  private document: LoreDocument | null = null;
  private loadingDocument = false;
  private error: string | null = null;

  constructor(
    private readonly reader: CampaignLoreReader,
    private readonly onChange: () => void,
  ) {}

  async load(): Promise<void> {
    if (this.index || this.loadingIndex) return;
    this.loadingIndex = true;
    this.error = null;
    this.onChange();
    try {
      this.index = await this.reader.loadIndex();
      const first = this.index.entries.filter((entry) => entry.type === "chapter").sort(entrySort)[0];
      if (first) await this.open(first.type, first.id, false);
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.loadingIndex = false;
      this.onChange();
    }
  }

  render(): string {
    if (this.loadingIndex && !this.index) return '<section class="lore-loading"><strong>Abriendo la biblioteca…</strong><p>Cargando los índices de campaña desde Supabase.</p></section>';
    if (this.error && !this.index) return `<section class="sheet-empty lore-error"><strong>No se pudo abrir la biblioteca</strong><p>${escapeCampaignHtml(this.error)}</p><button type="button" data-lore-retry>Reintentar</button></section>`;
    const index = this.index ?? { entries: [] };
    return `<section class="lore-browser" aria-label="Biblioteca de campaña">
      <header class="lore-search-header">
        <div><p class="eyebrow">Biblioteca compartida · solo lectura</p><h2>Lore de campaña</h2></div>
        <details class="lore-help"><summary>Cómo buscar</summary>${this.renderHelp()}</details>
      </header>
      <form class="lore-search-form" data-lore-search-form>
        <label><span>Buscar en toda la campaña</span><input name="query" type="search" value="${escapeCampaignHtml(this.query)}" placeholder='Palabras, "frase exacta", OR, -excluir' autocomplete="off"></label>
        <button type="submit" ${this.searching ? "disabled" : ""}>${this.searching ? "Buscando…" : "Buscar"}</button>
        ${this.results === null ? "" : '<button type="button" class="secondary-button" data-lore-clear-search>Limpiar</button>'}
      </form>
      ${this.error ? `<p class="lore-inline-error" role="alert">${escapeCampaignHtml(this.error)}</p>` : ""}
      <div class="lore-layout">
        <aside class="lore-index">${this.renderIndex(index)}</aside>
        <main class="lore-main">${this.results === null ? this.renderDocument() : this.renderResults()}</main>
      </div>
    </section>`;
  }

  bind(root: ParentNode): void {
    root.querySelector<HTMLButtonElement>("[data-lore-retry]")?.addEventListener("click", () => void this.load());
    root.querySelector<HTMLFormElement>("[data-lore-search-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      void this.search(String(new FormData(form).get("query") ?? ""));
    });
    root.querySelector<HTMLButtonElement>("[data-lore-clear-search]")?.addEventListener("click", () => {
      this.query = ""; this.results = null; this.error = null; this.onChange();
    });
    root.querySelectorAll<HTMLButtonElement>("[data-lore-type]").forEach((button) => button.addEventListener("click", () => {
      const type = button.dataset.loreType;
      if (!BROWSE_TYPES.includes(type as LoreEntryType)) return;
      this.browseType = type as LoreEntryType;
      this.results = null;
      this.onChange();
    }));
    const filter = root.querySelector<HTMLInputElement>("[data-lore-index-filter]");
    filter?.addEventListener("input", () => {
      this.indexFilter = filter.value;
      const needle = normalize(filter.value);
      root.querySelectorAll<HTMLElement>("[data-lore-index-entry]").forEach((entry) => {
        entry.hidden = !!needle && !normalize(entry.dataset.loreIndexEntry ?? "").includes(needle);
      });
    });
    root.querySelectorAll<HTMLButtonElement>("[data-lore-open]").forEach((button) => button.addEventListener("click", () => {
      const [type, rawId] = (button.dataset.loreOpen ?? "").split(":");
      const id = Number(rawId);
      if (!BROWSE_TYPES.includes(type as LoreEntryType) || !Number.isSafeInteger(id)) return;
      void this.open(type as LoreEntryType, id);
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-lore-example]").forEach((button) => button.addEventListener("click", () => {
      const example = button.dataset.loreExample ?? "";
      const input = root.querySelector<HTMLInputElement>('[data-lore-search-form] input[name="query"]');
      if (input) input.value = example;
      void this.search(example);
    }));
  }

  private renderHelp(): string {
    return `<div class="lore-help-panel">
      <p>La búsqueda usa sintaxis web y devuelve capítulos, eventos, personajes y lugares ordenados por relevancia.</p>
      <dl><div><dt>Varias palabras</dt><dd><code>Valverde gobernador</code> exige ambas.</dd></div><div><dt>Frase exacta</dt><dd><code>"Círculo Eterno"</code></dd></div><div><dt>Alternativas</dt><dd><code>Adler OR Delerion</code></dd></div><div><dt>Excluir</dt><dd><code>mercenarios -Valerio</code></dd></div></dl>
      <div class="lore-search-examples"><button type="button" data-lore-example='"Círculo Eterno"'>Probar frase</button><button type="button" data-lore-example="Adler OR Delerion">Probar OR</button></div>
    </div>`;
  }

  private renderIndex(index: LoreIndex): string {
    const counts = Object.fromEntries(BROWSE_TYPES.map((type) => [type, index.entries.filter((entry) => entry.type === type).length])) as Record<LoreEntryType, number>;
    const entries = index.entries.filter((entry) => entry.type === this.browseType).sort(entrySort);
    const needle = normalize(this.indexFilter);
    return `<nav class="lore-type-tabs" aria-label="Índices de campaña">${BROWSE_TYPES.map((type) => `<button type="button" data-lore-type="${type}" class="${this.browseType === type ? "active" : ""}"><span>${TYPE_LABELS[type].plural}</span><strong>${counts[type]}</strong></button>`).join("")}</nav>
      <label class="lore-index-filter"><span>Filtrar este índice</span><input type="search" data-lore-index-filter value="${escapeCampaignHtml(this.indexFilter)}" placeholder="Nombre o alias"></label>
      <div class="lore-index-list">${entries.map((entry) => {
        const searchText = [entry.title, ...entry.aliases].join(" ");
        const hidden = needle && !normalize(searchText).includes(needle);
        const prefix = entry.chapterNumber === null ? "" : `<small>${String(entry.chapterNumber).padStart(2, "0")}</small>`;
        return `<button type="button" data-lore-open="${entry.type}:${entry.id}" data-lore-index-entry="${escapeCampaignHtml(searchText)}" class="${this.selected?.type === entry.type && this.selected.id === entry.id ? "active" : ""}" ${hidden ? "hidden" : ""}>${prefix}<span>${escapeCampaignHtml(entry.title)}</span></button>`;
      }).join("") || '<p class="muted">Este índice está vacío.</p>'}</div>`;
  }

  private renderResults(): string {
    if (this.searching) return '<section class="lore-loading"><strong>Buscando…</strong><p>Consultando los índices de texto de la campaña.</p></section>';
    const results = this.results ?? [];
    if (!results.length) return `<section class="sheet-empty"><strong>Sin coincidencias</strong><p>No encontramos resultados para “${escapeCampaignHtml(this.query)}”. Probá menos palabras o revisá la sintaxis.</p></section>`;
    return `<section class="lore-results"><header><div><p class="eyebrow">Resultados</p><h3>${results.length} coincidencia${results.length === 1 ? "" : "s"}</h3></div><span>Ordenadas por relevancia</span></header><div>${results.map((result) => {
      const excerpt = campaignMarkdownToPlainText(result.excerpt);
      return `<details class="lore-result-card"><summary><span><small>${escapeCampaignHtml(resultContext(result))}</small><strong>${escapeCampaignHtml(result.title)}</strong></span><i>⌄</i></summary><div><p>${escapeCampaignHtml(excerpt)}</p><button type="button" data-lore-open="${result.type}:${result.id}">Abrir en el lector</button></div></details>`;
    }).join("")}</div></section>`;
  }

  private renderDocument(): string {
    if (this.loadingDocument) return '<section class="lore-loading"><strong>Cargando documento…</strong><p>Recuperando el contenido completo desde Supabase.</p></section>';
    const document = this.document;
    if (!document) return '<section class="sheet-empty"><strong>Elegí un documento</strong><p>Usá los índices o el buscador para abrir el lore de la campaña.</p></section>';
    const rendered = renderCampaignMarkdown(document.contentMarkdown);
    const source = sourceLabel(document.sourcePath);
    const facts = [
      document.chapterNumber === null ? null : `Capítulo ${document.chapterNumber}`,
      document.aliases.length ? `Alias: ${document.aliases.join(", ")}` : null,
      source ? `Fuente: ${source}` : null,
    ].filter(Boolean);
    const outline = rendered.headings.filter((heading) => heading.level <= 3);
    return `<article class="lore-document">
      <header><p class="eyebrow">${TYPE_LABELS[document.type].singular}</p><h2>${escapeCampaignHtml(document.title)}</h2>${facts.length ? `<div class="lore-document-facts">${facts.map((fact) => `<span>${escapeCampaignHtml(fact!)}</span>`).join("")}</div>` : ""}</header>
      ${outline.length > 1 ? `<details class="lore-outline"><summary>En este documento · ${outline.length} secciones</summary><nav>${outline.map((heading) => `<a href="#${heading.id}" data-level="${heading.level}">${escapeCampaignHtml(heading.text)}</a>`).join("")}</nav></details>` : ""}
      <div class="lore-rendered-markdown">${rendered.html || '<p class="muted">Este documento no tiene descripción.</p>'}</div>
      ${document.related.length ? `<footer><strong>${document.type === "chapter" ? "Referencias del capítulo" : "Aparece en"}</strong><div class="lore-related">${document.related.map((entry) => `<button type="button" data-lore-open="${entry.type}:${entry.id}">${entry.chapterNumber === null ? "" : `Cap. ${entry.chapterNumber} · `}${escapeCampaignHtml(entry.title)}</button>`).join("")}</div></footer>` : ""}
    </article>`;
  }

  private async search(query: string): Promise<void> {
    this.query = query.trim();
    if (!this.query) { this.results = null; this.error = null; this.onChange(); return; }
    this.searching = true; this.results = []; this.error = null; this.onChange();
    try { this.results = await this.reader.search(this.query, 40); }
    catch (error) { this.error = errorMessage(error); this.results = []; }
    finally { this.searching = false; this.onChange(); }
  }

  private async open(type: LoreEntryType, id: number, notify = true): Promise<void> {
    this.selected = { type, id };
    this.results = null;
    this.loadingDocument = true;
    this.error = null;
    if (notify) this.onChange();
    try {
      this.document = await this.reader.read(type, id);
      if (!this.document) this.error = "El documento no existe o no está disponible para este usuario.";
    } catch (error) {
      this.document = null;
      this.error = errorMessage(error);
    } finally {
      this.loadingDocument = false;
      if (notify) this.onChange();
    }
  }
}
