import type { CharacterV2 } from "../domain/character/character-v2";
import { projectCharacterProgression,type CharacterProgression,type ProgressionLevel,type ProgressionTrait } from "../domain/character/character-progression";
import type { ProgressionChoice } from "../domain/character/progression-choices";
const html = (s: string|number) => String(s).replace(/[&<>"']/g,(c) => ({ "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;" })[c]!);
const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase();
const entries = (items: ProgressionChoice[]) => `<dl class="progression-values">${items.map((i) => `<div><dt>${html(i.label)}</dt><dd>${html(i.value)}${i.description ? `<p>${html(i.description)}</p>` : ""}</dd></div>`).join("")}</dl>`;
const trait = (t: ProgressionTrait) => `<details class="progression-trait"><summary><span>${html(t.name)}</span><small>${t.updated ? "Mejorado" : "Obtenido"} · ${html(t.group)}</small></summary><p>${html(t.description)}</p>${t.uses ? `<p class="progression-resource">${html(t.uses)}</p>` : ""}</details>`;
function levelCard(level: ProgressionLevel,open: boolean) {
  const important = level.decisions.filter((d) => !d.label.startsWith("PG del nivel")),preview = important.slice(0,2).map((d) => `${d.label}: ${d.value}`).join(" · ") || level.traits.slice(0,2).map((t) => t.name).join(" · ") || "Aumento de PG y progresión de clase";
  return `<details class="progression-level" data-progression-level="${level.level}" ${open ? "open" : ""}><summary><span class="progression-level-number">${level.level}</span><span class="progression-level-heading"><strong>Nivel ${level.level} · ${html(level.className)}</strong><span>${html(preview)}</span></span><span class="progression-level-hp">${level.hpMaximum} PG<small>+${level.hpIncrease} este nivel</small></span></summary><div class="progression-level-content">
    ${level.subclass ? `<p class="progression-subclass">${html(level.subclass)}</p>` : ""}
    <section><h3>Decisiones tomadas</h3>${level.decisions.length ? entries(level.decisions) : "<p>Este nivel no requería elecciones adicionales.</p>"}</section>
    ${level.replacements.length ? `<section class="progression-replacements"><h3>Sustituciones</h3><ul>${level.replacements.map((r) => `<li><strong>${html(r.label)}</strong><span>${html(r.before)} <span aria-label="se sustituye por">→</span> ${html(r.after)}</span></li>`).join("")}</ul></section>` : ""}
    <section><h3>Beneficios del nivel</h3>${entries(level.benefits)}<p class="progression-hint">Totales otorgados por el tutorial. El aumento de PG incluye los ajustes retroactivos de Constitución y dotes cuando corresponden.</p></section>
    ${level.traits.length ? `<section><h3>Rasgos obtenidos o mejorados <small>${level.traits.length}</small></h3><p class="progression-hint">Incluye los rasgos automáticos y los derivados de tus decisiones. Abrí cada rasgo para leer sus reglas.</p>${level.traits.map(trait).join("")}</section>` : ""}
    ${level.retiredTraits.length ? `<section><h3>Rasgos que dejaron de aplicarse</h3>${level.retiredTraits.map((t) => `<details class="progression-trait"><summary>${html(t.name)}</summary><p>${html(t.description)}</p></details>`).join("")}</section>` : ""}
    ${level.spells.length ? `<section><h3>Magia incorporada <small>${level.spells.length}</small></h3><p class="progression-hint">«Disponible para preparar» amplía la lista de preparación; no significa que todos estén preparados.</p><ul class="progression-spells">${level.spells.map((s) => `<li><span>${html(s.name)}</span><small>${html(s.kind)}${s.level ? ` · nivel ${s.level}` : ""}</small></li>`).join("")}</ul></section>` : ""}
    ${level.studies.length ? `<section><h3>Aprendizaje fuera del tutorial</h3>${entries(level.studies)}</section>` : ""}
    </div></details>`;
}

/** In-memory view cache; neither history nor view controls save campaign data. */
export class CharacterProgressionPanel {
  private key = "";
  private result: CharacterProgression|null = null;
  private pending = false;
  private failure = "";
  private openLevels = new Set<number>();
  private search = "";
  constructor(private readonly refresh: () => void) {}
  render(c: CharacterV2): string {
    if (!c.builder) return '<section class="character-progression"><h2>Progresión del personaje</h2><p>Esta ficha no tiene un historial de creación con tutorial. No hay decisiones por nivel registradas para mostrar.</p><p>Los rasgos actuales siguen disponibles en Rasgos.</p></section>';
    const key = JSON.stringify([c.id,c.builder,c.spellcasting.wizard?.copied,c.metadata.createdAt,c.identity.level,c.abilities,c.combat.hitPoints.maximum]);
    if (this.key !== key) {
      this.key = key;this.result = null;this.failure = "";this.pending = true;this.search = "";this.openLevels = new Set([c.builder.levels.length+1]);
      void projectCharacterProgression(c).then((result) => { if (this.key === key) { this.result = result;this.pending = false;this.refresh(); } }).catch((error) => { if (this.key === key) { this.failure = error instanceof Error ? error.message : "No se pudo reconstruir el historial.";this.pending = false;this.refresh(); } });
    }
    if (this.pending) return '<section class="character-progression" aria-busy="true"><h2>Progresión del personaje</h2><p role="status">Cargando el recorrido de niveles…</p></section>';
    if (this.failure) return `<section class="character-progression"><h2>Progresión del personaje</h2><p role="alert">No se pudo reconstruir la progresión: ${html(this.failure)}</p><button type="button" data-progression-retry>Volver a intentar</button></section>`;
    const result = this.result!;
    return `<section class="character-progression" data-progression><header><div><p class="builder-eyebrow">${html(result.className)} · ${result.levels.length} niveles registrados</p><h2>Progresión del personaje</h2></div><div class="progression-tools"><button type="button" data-progression-expand>Abrir todos</button><button type="button" data-progression-collapse>Cerrar todos</button></div></header>
      <p>Tu recorrido de decisiones, beneficios y sustituciones, nivel por nivel. Esta vista es de consulta.</p><p class="progression-hint">Muestra el historial del tutorial y las copias al libro de Mago que tienen nivel registrado. La preparación diaria, cambios de equipo y recursos gastados durante el juego se consultan en la ficha actual.</p>
      ${result.initialLevel > 1 ? `<p class="progression-hint">Creado inicialmente a nivel ${result.initialLevel}; se muestran también todas las decisiones de los niveles anteriores.</p>` : ""}${result.notices.map((n) => `<p class="progression-notice">${html(n)}</p>`).join("")}
      <div class="progression-navigation"><label>Buscar decisiones o rasgos<input type="search" data-progression-search value="${html(this.search)}" placeholder="Arquería, Constitución, conjuro…"></label><label>Ir al nivel<select data-progression-jump aria-label="Ir al nivel"><option value="">Elegí un nivel</option>${result.levels.map((l) => `<option value="${l.level}">Nivel ${l.level}</option>`).join("")}</select></label></div>
      <p class="progression-hint" data-progression-count role="status"></p><div class="progression-timeline">${result.levels.map((l) => levelCard(l,this.openLevels.has(l.level))).join("")}</div><p data-progression-empty hidden>No hay niveles que coincidan con la búsqueda.</p></section>`;
  }
  bind(root: HTMLElement) {
    root.querySelector("[data-progression-retry]")?.addEventListener("click",() => { this.key = "";this.refresh(); });
    const panel = root.querySelector<HTMLElement>("[data-progression]");if (!panel) return;
    const levels = [...panel.querySelectorAll<HTMLDetailsElement>("[data-progression-level]")],search = panel.querySelector<HTMLInputElement>("[data-progression-search]")!;
    const filter = () => {
      this.search = search.value;const q = normalized(search.value.trim());let count = 0;
      levels.forEach((l) => { l.hidden = !!q && !normalized(l.textContent ?? "").includes(q);if (!l.hidden) { count++;if (q) { l.open = true;this.openLevels.add(Number(l.dataset.progressionLevel)); } } });
      panel.querySelector<HTMLElement>("[data-progression-count]")!.textContent = `${count} de ${levels.length} niveles visibles`;
      panel.querySelector<HTMLElement>("[data-progression-empty]")!.hidden = count > 0;
    };
    levels.forEach((l) => l.addEventListener("toggle",() => { const n = Number(l.dataset.progressionLevel);if (l.open) this.openLevels.add(n);else this.openLevels.delete(n); }));
    search.addEventListener("input",filter);filter();
    for (const [selector,open] of [["[data-progression-expand]",true],["[data-progression-collapse]",false]] as const) panel.querySelector(selector)!.addEventListener("click",() => levels.filter((l) => !l.hidden).forEach((l) => { l.open = open;const n = Number(l.dataset.progressionLevel);if (open) this.openLevels.add(n);else this.openLevels.delete(n); }));
    panel.querySelector<HTMLSelectElement>("[data-progression-jump]")!.addEventListener("change",(e) => { const value = (e.target as HTMLSelectElement).value,target = levels.find((l) => l.dataset.progressionLevel === value);if (!target) return;search.value = "";filter();target.open = true;this.openLevels.add(Number(value));target.scrollIntoView?.({ behavior: "smooth",block: "start" });target.querySelector("summary")!.focus(); });
  }
}
