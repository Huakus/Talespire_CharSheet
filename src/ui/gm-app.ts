import { EncounterApplication } from "../application/encounter/encounter-application";
import type { CampaignSnapshot } from "../application/ports/campaign-repository";
import { isBloodied, orderedCombatants } from "../domain/encounter/encounter";
import type { Encounter, EncounterCombatant } from "../domain/encounter/encounter-model";
import type { DiceRoller } from "../application/ports/dice-roller";
import { CHALLENGE_RATINGS, MONSTER_SIZES, MONSTER_TYPES, normalizeMonsterDefinition, type MonsterDefinition } from "../domain/monsters/monster-catalog";
import type { EncounterTransferStatus, ReceivedCharacterSummary, TaleSpireGmPlayer, TaleSpireNativeInitiativeQueue } from "../infrastructure/talespire/talespire-gm-collaboration";
import { projectCharacterStatistics } from "../domain/character/character-projection";
import type { CharacterV2 } from "../domain/character/character-v2";
import { DAMAGE_TYPES } from "../domain/equipment/equipment-catalog";
import type { SpellDefinition } from "../domain/character/character-spell-model";
import type { CatalogMetadata } from "../domain/content/catalog-metadata";
import { GmToolsPanel, type GmContentSection, type GmSection, type GmToolsRuntime } from "./gm-tools-panel";
import type { GmWorkspace } from "../domain/gm/gm-workspace";
import {
  canOpenPersistencePanel,
  openPersistencePanel,
  renderAppConnectionIndicators,
  subscribeAppConnectionStatus,
} from "./app-chrome";
import { bindViewportConstrainedDetails } from "./floating-panel";
import { renderCheckboxGroup } from "./checkbox-group";
import type { CampaignLoreReader } from "../application/ports/campaign-lore-reader";
import { CampaignLoreBrowser } from "./campaign-lore-browser";
import { normalizeUiHexColor, UI_ACCENT_PRESETS, uiAccentStyle } from "./design-system/theme";
import { renderUiEmptyState } from "./design-system/primitives";

export { calculateFloatingPanelPosition } from "./floating-panel";

type GmContentKind = "monster" | GmContentSection;

export interface GmAppRuntime extends GmToolsRuntime {
  diceRoller: DiceRoller;
  subscribeCampaignChanges?: (listener: () => void) => () => void;
  subscribeDiceResults?: (listener: (result: { name: string; total: number }) => void) => () => void;
  monsters: readonly MonsterDefinition[];
  subscribePlayers?: (listener: (players: TaleSpireGmPlayer[]) => void) => () => void;
  subscribeCharacterSummaries?: (listener: (summary: ReceivedCharacterSummary) => void) => () => void;
  subscribeInitiative?: (listener: (clientId: string, initiative: number, characterId: string | null) => void) => () => void;
  subscribeNativeInitiative?: (listener: (queue: TaleSpireNativeInitiativeQueue) => void) => () => void;
  getNativeInitiative?: () => Promise<TaleSpireNativeInitiativeQueue | null>;
  refreshPlayers?: () => Promise<void>;
  requestCharacterSummaries?: () => Promise<void>;
  publishEncounter?: (encounter: Encounter) => Promise<void>;
  selectMiniature?: () => Promise<{ creatureId: string; displayName: string; boardAssetId: string }>;
  subscribeTransferStatus?: (listener: (status: EncounterTransferStatus) => void) => () => void;
  loadCustomMonsters?: () => Promise<MonsterDefinition[]>;
  saveCustomMonster?: (definition: MonsterDefinition, previousKey: string | null) => Promise<void>;
  deleteCustomMonster?: (key: string) => Promise<void>;
  loreReader?: CampaignLoreReader;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function integer(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function gmPreference(key: string, fallback: string): string {
  try { return window.localStorage.getItem(`talespire-5e-toolset:v2:gm:${key}`) ?? fallback; }
  catch { return fallback; }
}

const FAVORITE_TAG = "favorite";

interface GmHistoryState {
  encounters: CampaignSnapshot["campaign"]["encounters"];
  workspace: GmWorkspace;
}

interface ReversibleGmAction {
  id: number;
  label: string;
  before: GmHistoryState;
  after: GmHistoryState;
  occurredAt: string;
}

interface GmLogEntry {
  id: number;
  label: string;
  occurredAt: string;
  kind: "action" | "roll" | "undo" | "redo" | "system";
}

function currentUiThemeMode(): "dark" | "light" {
  return typeof document !== "undefined" && document.documentElement.dataset.v2Theme === "light" ? "light" : "dark";
}

function catalogMetadata(value: { catalog?: CatalogMetadata | null } | null): CatalogMetadata {
  return value?.catalog ?? { origin: "gm", tags: ["gm"], contentKey: "", revision: 0 };
}

function visibleCatalogTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => normalizedSearch(tag) !== FAVORITE_TAG);
}

function isCatalogFavorite(value: { catalog?: CatalogMetadata | null } | null): boolean {
  return catalogMetadata(value).tags.some((tag) => normalizedSearch(tag) === FAVORITE_TAG);
}

function catalogFormMetadata(value: { catalog?: CatalogMetadata | null } | null, data: FormData): CatalogMetadata {
  const current = catalogMetadata(value);
  const tags = String(data.get("catalogTags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  if (current.tags.some((tag) => normalizedSearch(tag) === FAVORITE_TAG)) tags.push(FAVORITE_TAG);
  return { ...current, tags };
}

function normalizedSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

function monsterFilterToken(group: string, value: string): string { return `${group}\u0000${value}`; }
function selectedMonsterFilterValues(filters: ReadonlySet<string>, group: string): string[] {
  const prefix = `${group}\u0000`;
  return [...filters].filter((filter) => filter.startsWith(prefix)).map((filter) => filter.slice(prefix.length));
}
function uniqueFacetValues(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "es", { numeric: true, sensitivity: "base" }));
}
function monsterFacets(monster: MonsterDefinition): Record<string, string[]> {
  const combinedType = normalizedSearch(monster.type);
  const inferredType = MONSTER_TYPES.find((value) => combinedType.includes(normalizedSearch(value))) ?? monster.type.split(/[ ,]/)[0] ?? "";
  const inferredSize = monster.size || MONSTER_SIZES.find((value) => combinedType.includes(normalizedSearch(value))) || "";
  const inferredAlignment = monster.alignment || monster.type.split(",").slice(1).join(",").trim();
  return {
    type: [inferredType], size: [inferredSize], alignment: [inferredAlignment], challenge: [monster.challenge],
    resistance: monster.damageResistances, vulnerability: monster.damageVulnerabilities,
    immunity: monster.damageImmunities, conditionImmunity: monster.conditionImmunities,
    tag: visibleCatalogTags(catalogMetadata(monster).tags),
  };
}
function matchesMonsterFilters(filters: ReadonlySet<string>, monster: MonsterDefinition): boolean {
  const facets = monsterFacets(monster);
  const groups = new Set([...filters].map((filter) => filter.slice(0, filter.indexOf("\u0000"))));
  return [...groups].every((group) => {
    const selected = new Set(selectedMonsterFilterValues(filters, group).map(normalizedSearch));
    return (facets[group] ?? []).some((value) => selected.has(normalizedSearch(value)));
  });
}

export function calculateTaleSpireRoundDelta(
  previous: TaleSpireNativeInitiativeQueue | null,
  current: TaleSpireNativeInitiativeQueue,
): number {
  if (!previous || current.items.length < 2 || previous.items.length !== current.items.length) return 0;
  if (previous.items.some((item, index) => item.id !== current.items[index]?.id)) return 0;
  const count = current.items.length;
  const previousIndex = previous.activeItemIndex;
  const currentIndex = current.activeItemIndex;
  if (previousIndex < 0 || previousIndex >= count || currentIndex < 0 || currentIndex >= count || previousIndex === currentIndex) return 0;
  if ((previousIndex + 1) % count === currentIndex) return currentIndex === 0 ? 1 : 0;
  if ((previousIndex - 1 + count) % count === currentIndex) return previousIndex === 0 ? -1 : 0;
  return 0;
}

export function findPlayerInitiativeCombatant(
  encounter: Pick<Encounter, "combatants">,
  clientId: string,
  characterId: string | null,
  summaryCharacterId: string | null,
): EncounterCombatant | null {
  return encounter.combatants.find((entry) => entry.kind === "player" && (
    entry.taleSpireClientId === clientId
    || characterId !== null && entry.characterId === characterId
    || summaryCharacterId !== null && entry.characterId === summaryCharacterId
  )) ?? null;
}

function fixedOptions(values: readonly string[], selected: string, emptyLabel = "—"): string {
  const all = [...new Set(["", ...values, ...(selected && !values.includes(selected) ? [selected] : [])])];
  return all.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value || emptyLabel)}</option>`).join("");
}

interface GmNotification {
  id: number;
  kind: "success" | "error";
  text: string;
  occurredAt: string;
}

const GM_CONDITIONS = [
  ["blinded", "Cegado"], ["charmed", "Hechizado"], ["deafened", "Ensordecido"],
  ["frightened", "Asustado"], ["grappled", "Agarrado"], ["incapacitated", "Incapacitado"],
  ["invisible", "Invisible"], ["paralyzed", "Paralizado"], ["petrified", "Petrificado"],
  ["poisoned", "Envenenado"], ["prone", "Derribado"], ["restrained", "Apresado"],
  ["stunned", "Aturdido"], ["unconscious", "Inconsciente"], ["concentration", "Concentración"],
  ["bless", "Bendición"], ["bane", "Perdición"], ["guidance", "Guía"],
  ["heroism", "Heroísmo"], ["sanctuary", "Santuario"], ["slow", "Ralentizado"],
  ["recharging", "Recargando"],
] as const;

export class GmApp {
  private snapshot: CampaignSnapshot | null = null;
  private selectedEncounterId: string | null = null;
  private pendingDeleteEncounterId: string | null = null;
  private expandedCombatantId: string | null = null;
  private notifications: GmNotification[] = [];
  private unreadImportantNotifications = 0;
  private nextNotificationId = 1;
  private currentMessage: { kind: "success" | "error"; text: string } | null = null;
  private get message(): { kind: "success" | "error"; text: string } | null { return this.currentMessage; }
  private set message(value: { kind: "success" | "error"; text: string } | null) {
    this.currentMessage = value;
    if (value === null) return;
    this.notifications.push({ id: this.nextNotificationId++, kind: value.kind, text: value.text, occurredAt: new Date().toISOString() });
    if (this.notifications.length > 100) this.notifications.splice(0, this.notifications.length - 100);
    if (value.kind === "error") this.unreadImportantNotifications += 1;
  }
  private players: TaleSpireGmPlayer[] = [];
  private playerSummaries = new Map<string, ReceivedCharacterSummary["summary"]>();
  private transferStatuses = new Map<string, EncounterTransferStatus>();
  private customMonsters: MonsterDefinition[] = [];
  private customSpells: SpellDefinition[] = [];
  private monsterTemplate: MonsterDefinition | null = null;
  private selectedCustomMonsterKey: string | null = null;
  private editingCustomMonsterKey: string | null = null;
  private activeSection: GmSection = "encounter";
  private activeContentKind: GmContentKind = "monster";
  private monsterSearch = "";
  private monsterFilters = new Set<string>();
  private monsterShowAll = true;
  private monsterFavoritesOnly = false;
  private pendingDeleteMonsterKey: string | null = null;
  private openMonsterFilterGroup: string | null = null;
  private showMonsterDescriptions = true;
  private gmColor = normalizeUiHexColor(gmPreference("color", "#c5ad6a")) ?? "#c5ad6a";
  private undoStack: ReversibleGmAction[] = [];
  private redoStack: ReversibleGmAction[] = [];
  private actionLog: GmLogEntry[] = [];
  private nextHistoryId = 1;
  private taleSpireLinkedEncounterId: string | null = null;
  private previousTaleSpireInitiativeQueue: TaleSpireNativeInitiativeQueue | null = null;
  private taleSpireInitiativeSync: Promise<void> = Promise.resolve();
  private readonly toolsPanel: GmToolsPanel;
  private readonly loreBrowser: CampaignLoreBrowser | null;

  constructor(
    private readonly root: HTMLElement,
    private readonly application: EncounterApplication,
    private readonly runtime: GmAppRuntime,
  ) {
    this.loreBrowser = runtime.loreReader ? new CampaignLoreBrowser(runtime.loreReader, () => this.render()) : null;
    const toolsRuntime: GmToolsRuntime = runtime;
    this.toolsPanel = new GmToolsPanel(
      root,
      toolsRuntime,
      (snapshot, label) => this.acceptSnapshot(snapshot, label ?? "Actualizar espacio GM"),
      (message) => { this.message = message; },
      () => this.render(),
      (label, kind) => this.appendActionLog(label, kind),
    );
  }

  async start(): Promise<void> {
    this.root.innerHTML = renderUiEmptyState({ title: "Cargando control GM…", text: "Recuperando campaña y catálogo compartido.", className: "sheet-empty gm-startup-status" });
    subscribeAppConnectionStatus(() => this.refreshConnectionIndicators());
    this.runtime.subscribeCampaignChanges?.(() => { void this.handleExternalChange(); });
    this.runtime.subscribeDiceResults?.((result) => {
      this.appendActionLog(`${result.name}: resultado ${result.total}`, "roll");
      this.render();
    });
    this.runtime.subscribePlayers?.((players) => { this.players = players; this.render(); });
    this.runtime.subscribeCharacterSummaries?.((received) => {
      this.playerSummaries.set(received.clientId, received.summary);
      void this.applyReceivedSummary(received);
    });
    this.runtime.subscribeInitiative?.((clientId, initiative, characterId) => { void this.applyReceivedInitiative(clientId, initiative, characterId); });
    this.runtime.subscribeNativeInitiative?.((queue) => {
      if (this.selectedEncounterId === this.taleSpireLinkedEncounterId) void this.enqueueTaleSpireInitiativeSync(queue);
    });
    this.runtime.subscribeTransferStatus?.((status) => {
      this.transferStatuses.set(status.clientId, status);
      this.render();
    });
    if (this.runtime.loadCustomMonsters) {
      try {
        this.customMonsters = await this.runtime.loadCustomMonsters();
        this.selectedCustomMonsterKey = this.customMonsters[0]?.name ?? null;
      } catch (error) {
        this.message = { kind: "error", text: `No se pudieron cargar los monstruos personalizados: ${this.formatError(error)}` };
      }
    }
    try { await this.toolsPanel.load(); } catch (error) {
      this.message = { kind: "error", text: `No se pudo cargar el contenido GM: ${this.formatError(error)}` };
    }
    if (this.runtime.loadGmContent) {
      try { const content = await this.runtime.loadGmContent(); this.customSpells = content.spells; }
      catch { /* The content panel already reports the actionable load error. */ }
    }
    this.snapshot = await this.application.loadCampaign();
    this.selectAvailableEncounter();
    const selected = this.selectedEncounterId ? this.snapshot?.campaign.encounters[this.selectedEncounterId] : null;
    if (selected?.combatants.some((combatant) => typeof combatant.taleSpireCreatureId === "string") && this.runtime.getNativeInitiative) {
      this.taleSpireLinkedEncounterId = selected.id;
    }
    this.render();
    void this.loreBrowser?.load();
    if (selected && this.taleSpireLinkedEncounterId === selected.id && this.runtime.getNativeInitiative) {
      try {
        const queue = await this.runtime.getNativeInitiative();
        if (queue) {
          await this.enqueueTaleSpireInitiativeSync(queue);
          return;
        }
      } catch (error) {
        this.message = { kind: "error", text: this.formatError(error) };
        this.render();
      }
    }
    if (selected) await this.runtime.publishEncounter?.(selected);
  }

  private async handleExternalChange(): Promise<void> {
    this.undoStack = [];
    this.redoStack = [];
    this.appendActionLog("Historial reversible reiniciado por una actualización remota.", "system");
    try {
      this.snapshot = await this.application.loadCampaign();
      this.message = { kind: "success", text: "Se refrescaron los datos compartidos de la campaña." };
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
    }
    this.selectAvailableEncounter();
    this.render();
  }

  private selectAvailableEncounter(): void {
    if (this.selectedEncounterId && this.snapshot?.campaign.encounters[this.selectedEncounterId]) return;
    this.selectedEncounterId = this.snapshot ? Object.values(this.snapshot.campaign.encounters)[0]?.id ?? null : null;
  }

  private render(): void {
    const encounters = this.snapshot ? Object.values(this.snapshot.campaign.encounters) : [];
    const selected = this.snapshot && this.selectedEncounterId ? this.snapshot.campaign.encounters[this.selectedEncounterId] ?? null : null;
    const sections: readonly GmSection[] = this.loreBrowser
      ? ["encounter", "content", "lore", "notes", "tools"]
      : ["encounter", "content", "notes", "tools"];
    this.root.innerHTML = `
      <section class="gm-shell" style="${uiAccentStyle(this.gmColor, currentUiThemeMode())}">
        <header class="gm-header">
          <strong class="gm-header-title">Control de GM</strong>
          <div class="gm-header-controls">${this.renderActionHistoryControls()}${renderAppConnectionIndicators()}${this.renderNotificationCenter()}<details class="sheet-menu gm-menu"><summary>⋯</summary><div><button type="button" class="secondary-button" data-open-persistence ${canOpenPersistencePanel() ? "" : "disabled"}>Persistencia</button>${this.renderColorPicker()}</div></details></div>
        </header>
        <nav class="sheet-tabs gm-section-nav" style="--gm-section-count:${sections.length}">${sections.map((section) => `<button type="button" data-gm-section="${section}" class="sheet-tab-button ${this.activeSection === section ? "active" : ""}">${section === "encounter" ? "Encuentro" : section === "content" ? "Contenido" : section === "lore" ? "Campaña" : section === "notes" ? "Notas" : "Herramientas"}</button>`).join("")}</nav>
        ${this.activeSection === "encounter" ? `<div class="gm-encounter-management">
          <select data-action="select-encounter" aria-label="Encuentro activo" ${encounters.length ? "" : "disabled"}>
            ${encounters.length ? encounters.map((encounter) => `<option value="${encounter.id}" ${encounter.id === selected?.id ? "selected" : ""}>${escapeHtml(encounter.name)}</option>`).join("") : '<option>Sin encuentros</option>'}
          </select>
          <details class="gm-popover gm-new-encounter"><summary>+ Encuentro</summary><div><form data-action="create-encounter" class="gm-compact-popup-form"><input name="name" required placeholder="Nombre del encuentro" aria-label="Nombre del encuentro"><button type="submit">Crear</button></form></div></details>
          <button type="button" data-action="delete-encounter" class="${selected && this.pendingDeleteEncounterId === selected.id ? "danger-confirm" : ""}" ${selected ? "" : "disabled"}>${selected && this.pendingDeleteEncounterId === selected.id ? "Confirmar eliminación" : "Eliminar"}</button>
          <span class="gm-connected-count">${this.players.length} conectado${this.players.length === 1 ? "" : "s"}</span>
          <button type="button" data-action="refresh-players" ${this.runtime.refreshPlayers ? "" : "disabled"}>Actualizar</button>
          <button type="button" data-action="request-summaries" ${this.players.length && this.runtime.requestCharacterSummaries ? "" : "disabled"}>Pedir estadísticas</button>
        </div>
        ${this.transferStatuses.size ? `<div class="gm-sync-status">${this.players.map((player) => {
          const status = this.transferStatuses.get(player.id);
          return status ? `<span class="${status.status}">${escapeHtml(player.label)}: ${status.status === "confirmed" ? "sincronizado" : status.status === "sending" ? "enviando" : status.status === "retrying" ? `reintentando (${status.attempt})` : "falló"}</span>` : "";
        }).join("")}</div>` : ""}
        ${this.snapshot ? `
          ${selected ? this.renderEncounter(selected) : renderUiEmptyState({ title: "No hay encuentros", text: "Creá uno para comenzar.", className: "sheet-empty" })}
        ` : renderUiEmptyState({ title: "No hay una campaña v2 cargada", text: "Importá o creá la campaña desde la hoja de personaje antes de abrir el control GM.", className: "sheet-empty" })}` : ""}
        ${this.activeSection === "content" ? `<div class="gm-content-source-bar"><span>Catálogo de esta campaña · Supabase</span></div>${this.renderContentNavigation()}${this.activeContentKind === "monster" ? this.renderCustomMonsterManager() : this.toolsPanel.render("content", this.snapshot?.campaign.gm ?? { noteGroups: [], randomTables: [], googleDocsUrl: "" }, this.activeContentKind)}` : ""}
        ${this.activeSection === "lore" ? this.loreBrowser?.render() ?? "" : ""}
        ${this.activeSection === "notes" && this.snapshot ? this.toolsPanel.render("notes", this.snapshot.campaign.gm) : ""}
        ${this.activeSection === "tools" && this.snapshot ? this.toolsPanel.render("tools", this.snapshot.campaign.gm) : ""}
      </section>`;
    this.bindEvents();
    if (this.snapshot) this.toolsPanel.bind(this.activeSection, this.snapshot.campaign.gm, this.snapshot.checksum);
  }

  private renderColorPicker(): string {
    return `<details class="color-picker"><summary title="Cambiar color de la interfaz GM"><span>Color</span><i style="--swatch-color:${this.gmColor}" aria-hidden="true"></i></summary><div class="color-picker-menu"><div class="color-palette" role="group" aria-label="Colores sugeridos">${UI_ACCENT_PRESETS.map((color) => `<button type="button" class="color-swatch ${color === this.gmColor ? "active" : ""}" style="--swatch-color:${color}" data-gm-color-value="${color}" aria-label="Usar color ${color}" aria-pressed="${color === this.gmColor}"></button>`).join("")}</div><div class="color-custom-row"><label><span>Hexadecimal</span><input id="gm-interface-color" value="${this.gmColor}" maxlength="7" spellcheck="false" aria-label="Color hexadecimal"></label><button type="button" id="apply-gm-interface-color">Aplicar</button></div></div></details>`;
  }

  private renderActionHistoryControls(): string {
    const entries = this.actionLog.slice(-30).reverse();
    const latest = this.actionLog.at(-1);
    return `<div class="action-history-controls" aria-label="Historial de acciones del GM"><button type="button" data-gm-history="undo" title="Deshacer última acción GM" ${this.undoStack.length ? "" : "disabled"}>↶</button><button type="button" data-gm-history="redo" title="Rehacer última acción GM" ${this.redoStack.length ? "" : "disabled"}>↷</button><details class="action-log"><summary title="Abrir historial GM"><span>${latest ? escapeHtml(latest.label) : "Sin actividad en esta sesión"}</span></summary><div>${entries.length ? `<ol>${entries.map((entry) => `<li data-log-kind="${entry.kind}"><time>${entry.occurredAt.slice(11, 19)}</time><span>${escapeHtml(entry.label)}</span></li>`).join("")}</ol>` : '<p>Sin acciones registradas en esta sesión.</p>'}</div></details></div>`;
  }

  private refreshConnectionIndicators(): void {
    const current = this.root.querySelector<HTMLElement>(".connection-indicators");
    if (current) current.outerHTML = renderAppConnectionIndicators();
    const button = this.root.querySelector<HTMLButtonElement>("[data-open-persistence]");
    if (button) button.disabled = !canOpenPersistencePanel();
  }

  private renderNotificationCenter(): string {
    const notifications = (this.notifications ?? []).slice().reverse();
    const unread = this.unreadImportantNotifications ?? 0;
    return `<details class="notification-center ${unread ? "has-unread" : ""}"><summary title="Mensajes" aria-label="Mensajes${unread ? `: ${unread} importantes sin leer` : ""}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path></svg>${unread ? `<strong class="notification-badge">${unread}</strong>` : ""}</summary><div><header><strong>Mensajes</strong><small>${notifications.length} en esta sesión</small></header>${notifications.length ? `<ol>${notifications.map((entry) => `<li class="${entry.kind}"><time>${entry.occurredAt.slice(11, 19)}</time><span>${escapeHtml(entry.text)}</span></li>`).join("")}</ol>` : "<p>Sin mensajes en esta sesión.</p>"}</div></details>`;
  }

  private renderContentNavigation(): string {
    const options: [GmContentKind, string, number][] = [
      ["monster", "Monstruos", this.customMonsters.length],
      ["spell", "Conjuros", this.toolsPanel.contentCount("spell")],
      ["equipment", "Equipo", this.toolsPanel.contentCount("equipment")],
      ["shop", "Comerciantes", this.toolsPanel.contentCount("shop")],
    ];
    return `<nav class="filter-bar gm-subsection-nav" aria-label="Tipo de contenido">${options.map(([key, label, count]) => `<button type="button" data-gm-content-kind="${key}" class="${this.activeContentKind === key ? "active" : ""}"><span>${label}</span><strong>${count}</strong></button>`).join("")}</nav>`;
  }

  private renderEncounter(encounter: Encounter): string {
    const combatants = orderedCombatants(encounter);
    const candidates = [
      ...Object.values(this.snapshot?.campaign.characters ?? {}).map((character) => ({ kind: "player", key: `character:${character.id}`, name: character.name, detail: "Personaje de campaña" })),
      ...this.monsterCatalog().map((monster) => ({ kind: "monster", key: `monster:${monster.id}`, name: monster.name, detail: `${monster.type || "Monstruo"} · VD ${monster.challenge || "—"}` })),
    ];
    return `
      <section class="gm-encounter-board">
      <div class="gm-turn-bar">
        <strong>Ronda ${encounter.round}</strong>
        <details class="gm-popover gm-add-combatant-popover"><summary>+ Combatiente</summary><div>
          <form data-action="add-combatant" class="gm-add-combatant">
            <input data-gm-combatant-search type="search" placeholder="Buscar monstruo, personaje o jugador…" autocomplete="off">
            <input name="kind" type="hidden"><input name="name" type="hidden">
            <input name="sourceKey" type="hidden">
            <div class="gm-combatant-search-results">${candidates.map((candidate) => `<button type="button" data-gm-combatant-candidate data-kind="${candidate.kind}" data-key="${escapeHtml(candidate.key)}" data-name="${escapeHtml(candidate.name)}" data-search="${escapeHtml(normalizedSearch(`${candidate.name} ${candidate.detail}`))}"><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.detail)}</small></button>`).join("")}</div>
            <input name="maximumHitPoints" type="hidden" value="1"><input name="armorClass" type="hidden">
            <label>INI opcional<input name="initiative" type="number" step="1" placeholder="—"></label>
            <button type="submit" data-add-selected-combatant disabled>Agregar seleccionado</button>
          </form>
        </div></details>
        <button type="button" data-action="connect-talespire-initiative" class="gm-talespire-link ${this.taleSpireLinkedEncounterId === encounter.id ? "connected" : ""}" title="Vincular este encuentro con la cola de iniciativa nativa de TaleSpire" ${this.runtime.getNativeInitiative ? "" : "disabled"}>${this.taleSpireLinkedEncounterId === encounter.id ? "TS conectado" : "Vincular TS"}</button>
      </div>
      <div class="gm-combatants">
        ${combatants.length ? combatants.map((combatant) => this.renderCombatant(encounter, combatant)).join("") : '<div class="sheet-empty"><strong>Iniciativa vacía</strong><p>Agregá jugadores, monstruos o combatientes personalizados.</p></div>'}
      </div></section>`;
  }

  private renderCombatant(encounter: Encounter, combatant: EncounterCombatant): string {
    const active = encounter.activeCombatantId === combatant.id;
    const monster = combatant.kind === "monster" ? this.findMonster(combatant.monsterDefinitionId) : null;
    const character = combatant.kind === "player" && combatant.characterId ? this.snapshot?.campaign.characters[combatant.characterId] ?? null : null;
    const currentPercent = combatant.hitPoints.maximum > 0 ? Math.min(100, combatant.hitPoints.current / combatant.hitPoints.maximum * 100) : 0;
    const temporaryPercent = combatant.hitPoints.maximum > 0 ? Math.min(100, combatant.hitPoints.temporary / combatant.hitPoints.maximum * 100) : 0;
    const temporaryBottom = Math.min(currentPercent, 100 - temporaryPercent);
    const hitPointHue = Math.round(currentPercent / 100 * 112);
    const conditions = [...combatant.conditions];
    const bloodied = isBloodied(combatant) && !conditions.some((condition) => condition.key === "bloodied");
    const characterStatistics = character ? projectCharacterStatistics(character) : null;
    const identityDetail = character
      ? `${character.identity.className || "Personaje"} · nivel ${character.identity.level}`
      : monster
        ? `${monster.type || "Monstruo"} · VD ${monster.challenge || "—"}`
        : "Combatiente personalizado";
    const tacticalFacts = [
      character?.combat.speed ? `Vel. ${character.combat.speed}` : monster?.speed.length ? `Vel. ${monster.speed.join(", ")}` : "",
      characterStatistics ? `PP ${characterStatistics.passives.perception}` : "",
      character?.combat.exhaustion ? `Agot. ${character.combat.exhaustion}` : "",
      combatant.visibleToPlayers ? "Visible" : "Oculto",
      combatant.taleSpireCreatureId ? "Miniatura TS vinculada" : "Sin miniatura TS",
    ].filter(Boolean);
    const expanded = this.expandedCombatantId === combatant.id;
    return `<details class="gm-combatant ${active ? "active" : ""} ${character ? "linked-character" : ""}" data-combatant-id="${combatant.id}" ${expanded ? "open" : ""}>
      <summary class="gm-combatant-summary">
        <span class="gm-combatant-identity"><strong>${escapeHtml(combatant.name)}</strong><small>${escapeHtml(identityDetail)}</small></span>
        <span><small>INI</small><strong>${combatant.initiative ?? "—"}</strong></span>
        <span><small>CA</small><strong>${combatant.armorClass ?? "—"}</strong></span>
        <div class="hp-readout gm-combatant-hp-readout" style="--hp-level:${Math.round(currentPercent)}%;--hp-temp-level:${Math.round(temporaryPercent)}%;--hp-temp-bottom:${Math.round(temporaryBottom)}%;--hp-tone:hsl(${hitPointHue} 38% 43%)" role="meter" aria-label="Puntos de golpe" aria-valuemin="0" aria-valuemax="${combatant.hitPoints.maximum}" aria-valuenow="${combatant.hitPoints.current}"><span>PG</span><strong>${combatant.hitPoints.current}${combatant.hitPoints.temporary ? `<b> + ${combatant.hitPoints.temporary}</b>` : ""}<small> / ${combatant.hitPoints.maximum}</small></strong><em>${combatant.hitPoints.temporary ? "Temp. en azul" : "Actuales"}</em></div>
        <span class="gm-summary-meta">${active ? '<i class="active">Turno activo</i>' : ""}${tacticalFacts.map((fact) => `<i>${escapeHtml(fact)}</i>`).join("")}<b aria-hidden="true">${expanded ? "▴" : "▾"}</b></span>
        <span class="gm-summary-conditions">${conditions.map((condition) => escapeHtml(condition.label)).join(" · ")}${bloodied ? `${conditions.length ? " · " : ""}Herido` : ""}${!conditions.length && !bloodied ? "Sin condiciones" : ""}</span>
      </summary>
      <div class="gm-combatant-popover">
        <div class="gm-talespire-association"><span>${combatant.taleSpireCreatureId ? "Miniatura de TaleSpire vinculada" : "Sin miniatura asociada"}</span><button type="button" data-action="link-selected-miniature" ${this.runtime.selectMiniature ? "" : "disabled"}>${combatant.taleSpireCreatureId ? "Cambiar por seleccionada" : "Vincular seleccionada"}</button>${combatant.taleSpireCreatureId ? '<button type="button" data-action="unlink-miniature">Desvincular</button>' : ""}</div>
        ${character ? `<p class="gm-linked-character-notice">Estado sincronizado desde la hoja. El GM sólo puede asignar su iniciativa.</p><div class="gm-combatant-control-row gm-character-initiative-control"><label>INI<input data-action="initiative" type="number" step="1" value="${combatant.initiative ?? ""}" placeholder="—"></label><button type="button" data-action="save-initiative">Guardar INI</button></div>` : `<div class="gm-combatant-control-row"><button type="button" data-action="activate-combatant">Hacer activo</button><label>INI<input data-action="initiative" type="number" step="1" value="${combatant.initiative ?? ""}"></label><button type="button" data-action="save-initiative">Guardar INI</button><button type="button" data-action="roll-initiative">Tirar INI</button></div><div class="gm-card-actions"><input data-action="hp-amount" type="number" min="1" step="1" value="1" aria-label="Cantidad de puntos de golpe"><button type="button" data-action="damage">Daño</button><button type="button" data-action="heal">Curar</button><button type="button" data-action="temporary-hit-points">PG temp.</button></div><div class="gm-condition-pills">${conditions.map((condition) => `<button type="button" data-action="remove-condition" data-condition-id="${condition.id}" title="Quitar condición">${escapeHtml(condition.label)} ×</button>`).join("")}${bloodied ? '<span class="bloodied">Herido</span>' : ""}</div><div class="gm-condition-control"><select data-action="condition-select" aria-label="Condición">${GM_CONDITIONS.filter(([key]) => !conditions.some((condition) => condition.key === key)).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select><button type="button" data-action="add-condition" ${GM_CONDITIONS.every(([key]) => conditions.some((condition) => condition.key === key)) ? "disabled" : ""}>Agregar</button></div><div class="gm-card-actions gm-card-danger"><button type="button" data-action="toggle-visibility" class="${combatant.visibleToPlayers ? "visible" : "hidden"}">${combatant.visibleToPlayers ? "Visible" : "Oculto"}</button><button type="button" data-action="remove-combatant">Quitar del encuentro</button></div>`}
        ${monster ? this.renderMonsterDetails(monster) : ""}
        ${character ? this.renderCharacterDetails(character) : ""}
        ${character ? '<div class="gm-card-actions gm-card-danger"><button type="button" data-action="remove-combatant">Quitar del encuentro</button></div>' : ""}
      </div>
    </details>`;
  }

  private renderCharacterDetails(character: CharacterV2): string {
    const statistics = projectCharacterStatistics(character);
    const modifier = (score: number): number => Math.floor((score - 10) / 2);
    const signed = (value: number): string => value >= 0 ? `+${value}` : String(value);
    const abilityLabels: Record<string, string> = { strength: "FUE", dexterity: "DES", constitution: "CON", intelligence: "INT", wisdom: "SAB", charisma: "CAR" };
    const abilities = Object.entries(character.abilities).map(([key, score]) => `<span><small>${abilityLabels[key] ?? key.slice(0, 3).toUpperCase()}</small><strong>${score}</strong><em>${signed(modifier(score))}</em><i>Salv. ${signed(statistics.savingThrows[key as keyof typeof statistics.savingThrows])}</i></span>`).join("");
    const conditions = character.combat.conditions.map((condition) => `<span>${escapeHtml(condition.label)}${condition.level ? ` ${condition.level}` : ""}</span>`).join("") || '<span class="muted">Sin condiciones</span>';
    const hitDice = `${character.combat.hitDice.remaining}/${character.combat.hitDice.maximum} d${character.combat.hitDice.dieSize}`;
    return `<section class="gm-participant-sheet gm-character-overview" style="${uiAccentStyle(character.color, currentUiThemeMode())}">
      <div class="gm-character-state-grid">
        <span><small>Competencia</small><strong>${signed(statistics.proficiencyBonus)}</strong></span><span><small>Dados de golpe</small><strong>${hitDice}</strong></span><span><small>Agotamiento</small><strong>${character.combat.exhaustion}</strong></span><span><small>Inspiración</small><strong>${character.combat.inspiration ? "Sí" : "No"}</strong></span><span><small>Salv. muerte</small><strong>${character.combat.deathSaves.successes}✓ · ${character.combat.deathSaves.failures}✕</strong></span>
      </div>
      <div class="gm-abilities gm-character-ability-strip">${abilities}</div>
      <div class="gm-passive-strip"><span><small>Percepción pasiva</small><strong>${statistics.passives.perception}</strong></span><span><small>Investigación pasiva</small><strong>${statistics.passives.investigation}</strong></span><span><small>Perspicacia pasiva</small><strong>${statistics.passives.insight}</strong></span></div>
      <div class="gm-condition-pills gm-character-conditions">${conditions}</div>
    </section>`;
  }

  private renderMonsterDetails(monster: MonsterDefinition): string {
    const signed = (value: number): string => value >= 0 ? `+${value}` : String(value);
    const abilityButtons = Object.entries(monster.abilities).map(([key, value]) => {
      const modifier = Math.floor((value - 10) / 2);
      return `<button type="button" class="gm-roll" data-roll-name="${escapeHtml(monster.name)} · ${escapeHtml(key.toUpperCase())}" data-roll-expression="1d20${signed(modifier)}"><small>${escapeHtml(key.toUpperCase())}</small><strong>${value}</strong><em>${signed(modifier)}</em></button>`;
    }).join("");
    const spellCatalog = this.customSpells;
    const spells = monster.spells.map((name) => {
      const definition = spellCatalog.find((entry) => normalizedSearch(entry.name) === normalizedSearch(name));
      const diceText = [definition?.damageExpression, definition?.description].filter(Boolean).join(" ");
      return `<p><b>${escapeHtml(name)}</b>${definition ? ` <small>Nivel ${definition.level}${definition.school ? ` · ${escapeHtml(definition.school)}` : ""}</small>` : ""} ${this.renderDiceButtons(name, diceText)}</p>`;
    }).join("");
    const sections = [
      ["Rasgos", monster.traits], ["Acciones", monster.actions],
      ["Reacciones", monster.reactions], ["Acciones legendarias", monster.legendaryActions],
    ] as const;
    return `<details class="gm-monster-details"><summary>${escapeHtml(monster.type || "Estadísticas")} · VD ${escapeHtml(monster.challenge || "—")} · ${escapeHtml(monster.speed.join(", "))}</summary>
      <div class="gm-monster-roll-toolbar"><label>Modo <select data-monster-roll-mode><option value="normal">Normal</option><option value="advantage">Ventaja</option><option value="disadvantage">Desventaja</option></select></label></div>
      <div class="gm-abilities gm-monster-rolls">${abilityButtons}</div>
      ${this.monsterFact("Salvaciones", monster.saves)}${this.monsterFact("Habilidades", monster.skills)}
      ${this.monsterFact("Vulnerabilidades", monster.damageVulnerabilities)}${this.monsterFact("Resistencias", monster.damageResistances)}
      ${this.monsterFact("Inmunidades", monster.damageImmunities)}${this.monsterFact("Inmunidad a condiciones", monster.conditionImmunities)}
      ${this.monsterFact("Sentidos", monster.senses)}${this.monsterFact("Idiomas", monster.languages)}
      ${sections.filter(([, entries]) => entries.length).map(([title, entries]) => `<section><strong>${title}</strong>${entries.map((entry) => `<p><b>${escapeHtml(entry.name)}</b> ${escapeHtml(entry.content)} ${this.renderDiceButtons(entry.name, entry.content)}</p>`).join("")}</section>`).join("")}
      ${spells ? `<section><strong>Conjuros</strong>${spells}</section>` : ""}
    </details>`;
  }

  private renderCustomMonsterManager(): string {
    if (!this.runtime.loadCustomMonsters) return "";
    const selected = this.selectedCustomMonsterKey ? this.customMonsters.find((monster) => monster.name === this.selectedCustomMonsterKey) ?? null : null;
    const editing = selected !== null && this.editingCustomMonsterKey === selected.name;
    if (editing || !selected && this.editingCustomMonsterKey === "__new__") {
      const draft = this.editingCustomMonsterKey === "__new__" ? this.monsterTemplate : selected;
      return `<section class="gm-editor-surface"><div class="gm-edit-heading"><strong>${draft?.name ?? "Nuevo monstruo"}</strong><button type="button" data-action="cancel-custom-monster">Volver</button></div>${this.renderCustomMonsterForm(draft)}</section>`;
    }
    const filterGroups = [
      { key: "type", label: "Tipo", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => monsterFacets(monster).type ?? [])) },
      { key: "size", label: "Tamaño", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => monsterFacets(monster).size ?? [])) },
      { key: "alignment", label: "Alineamiento", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => monsterFacets(monster).alignment ?? [])) },
      { key: "challenge", label: "VD", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => monsterFacets(monster).challenge ?? [])) },
      { key: "resistance", label: "Resistencia", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => monster.damageResistances)) },
      { key: "vulnerability", label: "Vulnerabilidad", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => monster.damageVulnerabilities)) },
      { key: "immunity", label: "Inmunidad", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => monster.damageImmunities)) },
      { key: "conditionImmunity", label: "Inmunidad a condición", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => monster.conditionImmunities)) },
      { key: "tag", label: "Etiquetas", values: uniqueFacetValues(this.customMonsters.flatMap((monster) => visibleCatalogTags(catalogMetadata(monster).tags))) },
    ].filter((group) => group.values.length);
    const query = normalizedSearch(this.monsterSearch);
    const showingAll = !this.monsterSearch.trim() && this.monsterFilters.size === 0 && !this.monsterFavoritesOnly;
    const monsters = this.customMonsters.filter((monster) => { const meta = catalogMetadata(monster); const matchesSearch = !query || normalizedSearch([monster.name, monster.type, monster.challenge, meta.origin, ...visibleCatalogTags(meta.tags), ...monster.traits.flatMap((entry) => [entry.name, entry.content]), ...monster.actions.flatMap((entry) => [entry.name, entry.content])].join(" ")).includes(query); return (!this.monsterFavoritesOnly || isCatalogFavorite(monster)) && matchesMonsterFilters(this.monsterFilters, monster) && matchesSearch; }).sort((left, right) => Number(isCatalogFavorite(right)) - Number(isCatalogFavorite(left)) || left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
    return `<section class="gm-content-catalog"><div class="spell-search-row gm-content-search-row"><label class="spell-search"><span>Buscar</span><input data-gm-monster-search type="search" value="${escapeHtml(this.monsterSearch)}" placeholder="Nombre, tipo, rasgo, acción…"></label><button type="button" class="description-toggle" data-gm-toggle-monster-descriptions>${this.showMonsterDescriptions ? "Ocultar descripciones" : "Mostrar descripciones"}</button><button type="button" data-action="new-custom-monster">+ monstruo</button></div><nav class="filter-bar property-filter gm-content-filter-bar gm-grouped-filters"><button type="button" data-gm-show-all-monsters class="${showingAll ? "active" : ""}" aria-pressed="${showingAll}">Todos</button><button type="button" data-gm-favorite-monsters class="gm-favorites-filter ${this.monsterFavoritesOnly ? "active" : ""}" aria-pressed="${this.monsterFavoritesOnly}">★ Favoritos</button>${filterGroups.map((group) => { const selected = selectedMonsterFilterValues(this.monsterFilters, group.key); return `<details class="gm-filter-group ${selected.length ? "active" : ""}" ${this.openMonsterFilterGroup === group.key ? "open" : ""}><summary>${escapeHtml(group.label)}${selected.length ? `<strong>${selected.length}</strong>` : ""}</summary><div>${group.values.map((value) => { const active = this.monsterFilters.has(monsterFilterToken(group.key, value)); return `<button type="button" data-gm-monster-filter-value="${escapeHtml(value)}" data-gm-monster-filter-group="${escapeHtml(group.key)}" class="${active ? "active" : ""}" aria-pressed="${active}">${escapeHtml(value)}</button>`; }).join("")}</div></details>`; }).join("")}</nav><div class="gm-catalog-grid">${monsters.map((monster) => this.renderCustomMonsterCard(monster)).join("")}</div>${renderUiEmptyState({ title: "Sin resultados", text: "No hay monstruos que coincidan con los filtros.", className: "sheet-empty gm-content-empty", hidden: monsters.length > 0 })}</section>`;
  }

  private renderCustomMonsterCard(monster: MonsterDefinition): string {
    const meta = catalogMetadata(monster);
    const tags = visibleCatalogTags(meta.tags);
    const favorite = isCatalogFavorite(monster);
    const confirming = this.pendingDeleteMonsterKey === monster.name;
    const search = [monster.name, monster.type, monster.challenge, meta.origin, ...tags, ...monster.traits.flatMap((entry) => [entry.name, entry.content]), ...monster.actions.flatMap((entry) => [entry.name, entry.content])].join(" ").toLocaleLowerCase();
    return `<article class="play-card gm-catalog-card gm-monster-card ${favorite ? "favorite" : ""}" data-gm-content-card data-search="${escapeHtml(search)}"><header><div><span class="card-kicker">${escapeHtml(monster.type || "Sin tipo")} · VD ${escapeHtml(monster.challenge || "—")}</span><div class="gm-card-title-row"><h3>${escapeHtml(monster.name)}</h3><button type="button" class="favorite-toggle ${favorite ? "active" : ""}" data-action="favorite-custom-monster" data-monster-key="${escapeHtml(monster.name)}" aria-pressed="${favorite}" title="${favorite ? "Quitar de favoritos" : "Agregar a favoritos"}">${favorite ? "★" : "☆"}</button></div><span class="catalog-origin ${escapeHtml(meta.origin)}">${escapeHtml(meta.origin)}</span></div><div class="gm-content-card-actions"><div><button type="button" data-action="edit-custom-monster" data-monster-key="${escapeHtml(monster.name)}">Editar</button><button type="button" data-action="delete-custom-monster" data-monster-key="${escapeHtml(monster.name)}" class="${confirming ? "danger-confirm" : ""}">${confirming ? "Confirmar eliminación" : "Eliminar"}</button></div><button type="button" data-action="template-custom-monster" data-monster-key="${escapeHtml(monster.name)}" title="Crear una copia editable">Clonar</button></div></header><div class="gm-card-facts"><span><small>CA</small>${monster.armorClass}</span><span><small>PG</small>${monster.hitPoints}</span><span><small>Velocidad</small>${escapeHtml(monster.speed.join(", ") || "—")}</span><span><small>Tamaño</small>${escapeHtml(monster.size || "—")}</span></div>${tags.length ? `<div class="catalog-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}${this.showMonsterDescriptions ? `<div class="gm-card-description">${monster.traits.slice(0, 2).map((entry) => `<p><b>${escapeHtml(entry.name)}.</b> ${escapeHtml(entry.content)}</p>`).join("") || monster.actions.slice(0, 2).map((entry) => `<p><b>${escapeHtml(entry.name)}.</b> ${escapeHtml(entry.content)}</p>`).join("") || "<p>Sin descripción.</p>"}</div>` : ""}</article>`;
  }

  private renderCustomMonsterView(monster: MonsterDefinition): string {
    const facts = [monster.type, monster.challenge ? `VD ${monster.challenge}` : "", monster.speed.join(", ")].filter(Boolean);
    const sections = [["Rasgos", monster.traits], ["Acciones", monster.actions], ["Reacciones", monster.reactions], ["Legendarias", monster.legendaryActions]] as const;
    return `<article class="gm-content-view gm-monster-view"><div class="gm-content-facts"><span>CA <strong>${monster.armorClass}</strong></span><span>PG <strong>${monster.hitPoints}</strong>${monster.hitPointFormula ? ` (${escapeHtml(monster.hitPointFormula)})` : ""}</span>${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div><div class="gm-abilities">${Object.entries(monster.abilities).map(([key, value]) => `<span>${escapeHtml(key.toUpperCase())} <strong>${value}</strong></span>`).join("")}</div>${this.monsterFact("Salvaciones", monster.saves)}${this.monsterFact("Habilidades", monster.skills)}${this.monsterFact("Resistencias", monster.damageResistances)}${this.monsterFact("Inmunidades", monster.damageImmunities)}${sections.filter(([, entries]) => entries.length).map(([title, entries]) => `<section class="gm-monster-view-section"><strong>${title}</strong>${entries.map((entry) => `<p><b>${escapeHtml(entry.name)}.</b> ${escapeHtml(entry.content)}</p>`).join("")}</section>`).join("")}</article>`;
  }

  private renderCustomMonsterForm(monster: MonsterDefinition | null): string {
    const ability = (key: string): number => monster?.abilities[key] ?? monster?.abilities[key.toLocaleLowerCase()] ?? 10;
    const list = (values: string[]): string => escapeHtml(values.join(", "));
    const featureText = (values: MonsterDefinition["traits"]): string => escapeHtml(values.map((entry) => `${entry.name} | ${entry.content}${entry.usage ? ` | ${entry.usage}` : ""}`).join("\n"));
    const spellCatalog = this.customSpells;
    const spellNames = [...new Set(spellCatalog.map((entry) => entry.name))].sort((a, b) => a.localeCompare(b, "es"));
    const meta = catalogMetadata(monster);
    return `<form data-action="save-custom-monster" class="gm-custom-monster-form">
      <div class="catalog-editor-meta"><span class="catalog-origin ${escapeHtml(meta.origin)}">${escapeHtml(meta.origin)}</span><label>Etiquetas de campaña<input name="catalogTags" value="${escapeHtml(visibleCatalogTags(meta.tags).join(", "))}" placeholder="oficial, jefe, no-muerto"></label></div>
      <div class="gm-monster-core-fields">
        <label>Nombre<input name="name" required value="${escapeHtml(monster?.name ?? "")}"></label>
        <label>Tipo<select name="type">${fixedOptions(MONSTER_TYPES, monster?.type ?? "", "Sin tipo")}</select></label>
        <label>Tamaño<select name="size">${fixedOptions(MONSTER_SIZES, monster?.size ?? "", "Sin tamaño")}</select></label>
        <label>Alineamiento<select name="alignment">${fixedOptions(["Legal bueno", "Neutral bueno", "Caótico bueno", "Legal neutral", "Neutral", "Caótico neutral", "Legal malvado", "Neutral malvado", "Caótico malvado", "Sin alineamiento"], monster?.alignment ?? "", "Sin alineamiento")}</select></label>
        <label>VD<select name="challenge">${fixedOptions(CHALLENGE_RATINGS, monster?.challenge ?? "0")}</select></label>
        <label>CA<input name="armorClass" type="number" min="0" step="1" value="${monster?.armorClass ?? 10}"></label>
        <label>PG<input name="hitPoints" type="number" min="0" step="1" value="${monster?.hitPoints ?? 10}"></label>
        <label>Dados de PG<input name="hitPointFormula" value="${escapeHtml(monster?.hitPointFormula ?? "")}" placeholder="2d8+2"></label>
        <label>INI<input name="initiativeModifier" type="number" step="1" value="${monster?.initiativeModifier ?? 0}"></label>
        <label>Velocidad<input name="speed" value="${list(monster?.speed ?? [])}" placeholder="30 pies, volar 60 pies"></label>
        <label class="checkbox"><input name="initiativeAdvantage" type="checkbox" ${monster?.initiativeAdvantage ? "checked" : ""}> Ventaja en iniciativa</label>
      </div>
      <div class="gm-monster-abilities">${[["Str", "FUE"], ["Dex", "DES"], ["Con", "CON"], ["Int", "INT"], ["Wis", "SAB"], ["Cha", "CAR"]].map(([key, label]) => `<label>${label}<input name="ability${key}" type="number" step="1" value="${ability(key!)}"></label>`).join("")}</div>
      <div class="gm-monster-list-fields">
        <label>Salvaciones<input name="saves" value="${list(monster?.saves ?? [])}"></label>
        <label>Habilidades<input name="skills" value="${list(monster?.skills ?? [])}"></label>
        <label>Sentidos<input name="senses" value="${list(monster?.senses ?? [])}"></label>
        <label>Idiomas<input name="languages" value="${list(monster?.languages ?? [])}"></label>
        ${renderCheckboxGroup("Vulnerabilidades", "vulnerabilities", DAMAGE_TYPES, monster?.damageVulnerabilities ?? [])}
        ${renderCheckboxGroup("Resistencias", "resistances", DAMAGE_TYPES, monster?.damageResistances ?? [])}
        ${renderCheckboxGroup("Inmunidades", "immunities", DAMAGE_TYPES, monster?.damageImmunities ?? [])}
        ${renderCheckboxGroup("Inmunidad a condiciones", "conditionImmunities", GM_CONDITIONS.slice(0, 14).map(([value, label]) => ({ value, label })), monster?.conditionImmunities ?? [])}
      </div>
      <p class="gm-editor-help">Una entrada por línea: Nombre | descripción | uso opcional</p>
      <label>Rasgos<textarea name="traits">${featureText(monster?.traits ?? [])}</textarea></label>
      <label>Acciones<textarea name="actions">${featureText(monster?.actions ?? [])}</textarea></label>
      <label>Reacciones<textarea name="reactions">${featureText(monster?.reactions ?? [])}</textarea></label>
      <label>Acciones legendarias<textarea name="legendaryActions">${featureText(monster?.legendaryActions ?? [])}</textarea></label>
      <div class="gm-monster-list-fields">
        ${renderCheckboxGroup("Conjuros", "spells", spellNames, monster?.spells ?? [])}
      </div>
      <div class="gm-custom-form-actions"><button type="submit">${monster ? "Guardar monstruo" : "Crear monstruo"}</button><button type="button" data-action="cancel-custom-monster">Limpiar</button></div>
    </form>`;
  }

  private monsterFact(label: string, values: string[]): string {
    return values.length ? `<p class="gm-monster-fact"><b>${label}:</b> ${escapeHtml(values.join(", "))}</p>` : "";
  }

  private renderDiceButtons(name: string, content: string): string {
    const expressions = [...new Set(content.match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?/gi) ?? [])];
    return expressions.map((expression) => `<button type="button" class="gm-roll" data-roll-name="${escapeHtml(name)}" data-roll-expression="${escapeHtml(expression.replaceAll(" ", ""))}">${escapeHtml(expression)}</button>`).join(" ");
  }

  private bindEvents(): void {
    this.loreBrowser?.bind(this.root);
    bindViewportConstrainedDetails(this.root, ".gm-popover", ":scope > div");
    bindViewportConstrainedDetails(this.root, ".gm-filter-group", ":scope > div");
    this.root.querySelector<HTMLButtonElement>("[data-open-persistence]")?.addEventListener("click", openPersistencePanel);
    this.root.querySelectorAll<HTMLDetailsElement>(".notification-center").forEach((center) => {
      center.addEventListener("toggle", () => {
        if (!center.open) return;
        this.unreadImportantNotifications = 0;
        center.classList.remove("has-unread");
        center.querySelector(".notification-badge")?.remove();
        center.querySelector("summary")?.setAttribute("aria-label", "Mensajes");
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-color-value]").forEach((button) => button.addEventListener("click", () => this.setGmColor(button.dataset.gmColorValue ?? "")));
    this.root.querySelector<HTMLButtonElement>("#apply-gm-interface-color")?.addEventListener("click", () => this.setGmColor(this.root.querySelector<HTMLInputElement>("#gm-interface-color")?.value ?? ""));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-history]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.gmHistory === "undo") void this.undoLastAction();
      if (button.dataset.gmHistory === "redo") void this.redoLastAction();
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-section]").forEach((button) => button.addEventListener("click", () => {
      this.activeSection = button.dataset.gmSection as GmSection;
      this.render();
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-content-kind]").forEach((button) => button.addEventListener("click", () => {
      this.activeContentKind = button.dataset.gmContentKind as GmContentKind;
      this.render();
    }));
    this.root.querySelector('[data-action="new-custom-monster"]')?.addEventListener("click", () => { this.monsterTemplate = null; this.selectedCustomMonsterKey = null; this.editingCustomMonsterKey = "__new__"; this.render(); });
    this.root.querySelectorAll<HTMLElement>('[data-action="template-custom-monster"]').forEach((button) => button.addEventListener("click", () => {
      const source = this.customMonsters.find((monster) => monster.name === button.dataset.monsterKey);
      if (!source) return;
      const copy = { ...structuredClone(source), id: `copy_${source.id}`, name: `COPIA DE ${source.name}` };
      copy.catalog = null;
      this.monsterTemplate = copy;
      this.selectedCustomMonsterKey = null;
      this.editingCustomMonsterKey = "__new__";
      this.render();
    }));
    this.root.querySelectorAll<HTMLElement>('[data-action="edit-custom-monster"]').forEach((button) => button.addEventListener("click", () => {
      this.selectedCustomMonsterKey = button.dataset.monsterKey ?? this.selectedCustomMonsterKey;
      this.editingCustomMonsterKey = this.selectedCustomMonsterKey;
      this.render();
    }));
    this.root.querySelectorAll<HTMLElement>('[data-action="favorite-custom-monster"]').forEach((button) => button.addEventListener("click", () => { void this.toggleMonsterFavorite(button.dataset.monsterKey ?? ""); }));
    this.root.querySelectorAll<HTMLElement>('[data-action="delete-custom-monster"]').forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.monsterKey ?? "";
      if (this.pendingDeleteMonsterKey !== key) {
        this.pendingDeleteMonsterKey = key;
        this.message = { kind: "success", text: `Volvé a presionar para eliminar “${key}”.` };
        this.render();
        return;
      }
      this.pendingDeleteMonsterKey = null;
      this.selectedCustomMonsterKey = key || this.selectedCustomMonsterKey;
      void this.deleteCustomMonster();
    }));
    this.root.querySelector('[data-action="cancel-custom-monster"]')?.addEventListener("click", () => {
      this.monsterTemplate = null;
      this.editingCustomMonsterKey = null;
      this.render();
    });
    this.root.querySelector<HTMLInputElement>("[data-gm-monster-search]")?.addEventListener("input", (event) => {
      this.monsterSearch = (event.currentTarget as HTMLInputElement).value;
      this.monsterShowAll = false;
      this.render();
      const replacement = this.root.querySelector<HTMLInputElement>("[data-gm-monster-search]");
      replacement?.focus();
      replacement?.setSelectionRange(replacement.value.length, replacement.value.length);
    });
    this.root.querySelector("[data-gm-toggle-monster-descriptions]")?.addEventListener("click", () => { this.showMonsterDescriptions = !this.showMonsterDescriptions; this.render(); });
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-monster-filter-value]").forEach((button) => button.addEventListener("click", () => { const group = button.dataset.gmMonsterFilterGroup ?? ""; const filter = monsterFilterToken(group, button.dataset.gmMonsterFilterValue ?? ""); this.openMonsterFilterGroup = group; this.monsterShowAll = false; if (this.monsterFilters.has(filter)) this.monsterFilters.delete(filter); else this.monsterFilters.add(filter); this.render(); }));
    this.root.querySelector("[data-gm-favorite-monsters]")?.addEventListener("click", () => { this.monsterFavoritesOnly = !this.monsterFavoritesOnly; this.monsterShowAll = false; this.render(); });
    this.root.querySelector("[data-gm-show-all-monsters]")?.addEventListener("click", () => { this.monsterShowAll = true; this.monsterFavoritesOnly = false; this.monsterFilters.clear(); this.monsterSearch = ""; this.openMonsterFilterGroup = null; this.render(); });
    this.root.querySelector<HTMLFormElement>('[data-action="save-custom-monster"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.saveCustomMonster(new FormData(event.currentTarget as HTMLFormElement));
    });
    this.root.querySelector<HTMLFormElement>('[data-action="create-encounter"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = String(new FormData(event.currentTarget as HTMLFormElement).get("name") ?? "").trim();
      if (name) void this.execute(async () => {
        const snapshot = await this.application.createEncounter(name, this.requireSnapshot().checksum);
        this.selectedEncounterId = Object.values(snapshot.campaign.encounters).find((encounter) => encounter.name === name)?.id ?? null;
        return snapshot;
      }, "Encuentro creado.");
    });
    this.root.querySelector<HTMLSelectElement>('[data-action="select-encounter"]')?.addEventListener("change", (event) => {
      this.selectedEncounterId = (event.currentTarget as HTMLSelectElement).value;
      this.pendingDeleteEncounterId = null;
      this.expandedCombatantId = null;
      this.render();
      const selected = this.requireEncounter();
      void this.runtime.publishEncounter?.(selected);
    });
    this.root.querySelector('[data-action="refresh-players"]')?.addEventListener("click", () => void this.runtime.refreshPlayers?.());
    this.root.querySelector('[data-action="request-summaries"]')?.addEventListener("click", () => void this.runtime.requestCharacterSummaries?.().catch((error) => {
      this.message = { kind: "error", text: this.formatError(error) };
      this.render();
    }));
    this.root.querySelector<HTMLInputElement>("[data-gm-combatant-search]")?.addEventListener("input", () => {
      const form = this.root.querySelector<HTMLFormElement>('[data-action="add-combatant"]');
      const source = form?.elements.namedItem("sourceKey") as HTMLInputElement | null;
      const submit = form?.querySelector<HTMLButtonElement>("[data-add-selected-combatant]");
      if (source) source.value = "";
      if (submit) submit.disabled = true;
      form?.querySelectorAll("[data-gm-combatant-candidate].selected").forEach((entry) => entry.classList.remove("selected"));
      this.applyCombatantSearch();
    });
    const combatantForm = this.root.querySelector<HTMLFormElement>('[data-action="add-combatant"]');
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-combatant-candidate]").forEach((button) => button.addEventListener("click", () => {
      const form = button.closest<HTMLFormElement>('[data-action="add-combatant"]'); if (!form) return;
      const kind = form.elements.namedItem("kind") as HTMLSelectElement | null;
      const name = form.elements.namedItem("name") as HTMLInputElement | null;
      const sourceKey = form.elements.namedItem("sourceKey") as HTMLInputElement | null;
      if (kind) kind.value = button.dataset.kind ?? "custom"; if (name) name.value = button.dataset.name ?? ""; if (sourceKey) sourceKey.value = button.dataset.key ?? "";
      const monster = button.dataset.kind === "monster" ? this.findMonster((button.dataset.key ?? "").replace(/^monster:/, "")) : null;
      const character = button.dataset.key?.startsWith("character:") ? this.snapshot?.campaign.characters[button.dataset.key.slice("character:".length)] ?? null : null;
      const player = button.dataset.key?.startsWith("client:") ? this.players.find((entry) => entry.id === button.dataset.key?.slice("client:".length)) ?? null : null;
      const summary = player ? this.playerSummaries.get(player.id) ?? null : null;
      const maximum = form.elements.namedItem("maximumHitPoints") as HTMLInputElement | null;
      const armorClass = form.elements.namedItem("armorClass") as HTMLInputElement | null;
      if (maximum) maximum.value = String(monster?.hitPoints ?? character?.combat.hitPoints.maximum ?? summary?.maximumHitPoints ?? 1);
      if (armorClass) armorClass.value = String(monster?.armorClass ?? character?.combat.armorClass ?? summary?.armorClass ?? "");
      const submit = form.querySelector<HTMLButtonElement>("[data-add-selected-combatant]");
      if (submit) submit.disabled = !sourceKey?.value;
      button.parentElement?.querySelectorAll("button").forEach((entry) => entry.classList.toggle("selected", entry === button));
    }));
    this.applyCombatantSearch();
    this.root.querySelector<HTMLButtonElement>('[data-action="delete-encounter"]')?.addEventListener("click", () => {
      const encounter = this.requireEncounter();
      if (this.pendingDeleteEncounterId !== encounter.id) {
        this.pendingDeleteEncounterId = encounter.id;
        this.message = { kind: "success", text: `Volvé a presionar para eliminar “${encounter.name}”.` };
        this.render();
        return;
      }
      this.pendingDeleteEncounterId = null;
      if (this.taleSpireLinkedEncounterId === encounter.id) {
        this.taleSpireLinkedEncounterId = null;
        this.previousTaleSpireInitiativeQueue = null;
      }
      void this.execute(() => this.application.deleteEncounter(encounter.id, this.requireSnapshot().checksum), "Encuentro eliminado.");
    });
    this.root.querySelector<HTMLFormElement>('[data-action="add-combatant"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const encounter = this.requireEncounter();
      const name = String(data.get("name") ?? "").trim();
      const sourceKey = String(data.get("sourceKey") ?? "");
      if (!sourceKey.startsWith("monster:") && !sourceKey.startsWith("character:")) {
        this.message = { kind: "error", text: "Seleccioná un monstruo o personaje existente de la lista." };
        this.render();
        return;
      }
      const maximum = Math.max(0, integer(data.get("maximumHitPoints"), 1));
      const initiativeText = String(data.get("initiative") ?? "").trim();
      const base = {
        name,
        initiative: initiativeText ? integer(initiativeText) : null,
        armorClass: String(data.get("armorClass") ?? "").trim() ? Math.max(0, integer(data.get("armorClass"))) : null,
        hitPoints: { current: maximum, maximum, temporary: 0 },
        conditions: [],
        visibleToPlayers: true,
      };
      const monster = sourceKey.startsWith("monster:") ? this.findMonster(sourceKey.slice("monster:".length)) : null;
      const character = sourceKey.startsWith("character:") ? this.requireSnapshot().campaign.characters[sourceKey.slice("character:".length)] ?? null : null;
      const connectedClientId = character
        ? this.players.find((player) => this.playerSummaries.get(player.id)?.characterId === character.id)?.id ?? null
        : null;
      if (!monster && !character) {
        this.message = { kind: "error", text: "El contenido seleccionado ya no existe. Actualizá la búsqueda." };
        this.render();
        return;
      }
      const combatant = monster
        ? { ...base, name: monster.name, armorClass: monster.armorClass, hitPoints: { current: monster.hitPoints, maximum: monster.hitPoints, temporary: 0 }, kind: "monster" as const, monsterDefinitionId: monster.id }
        : {
                ...base,
                name: character!.name,
                armorClass: character!.combat.armorClass,
                hitPoints: character!.combat.hitPoints,
                initiative: base.initiative,
                kind: "player" as const,
                characterId: character!.id,
                taleSpireClientId: connectedClientId,
              };
      void this.execute(() => this.application.addCombatant({
        encounterId: encounter.id,
        expectedEncounterRevision: encounter.revision,
        expectedCampaignChecksum: this.requireSnapshot().checksum,
        combatant,
      }), "Combatiente agregado.");
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="connect-talespire-initiative"]')?.addEventListener("click", () => {
      void this.connectTaleSpireInitiative();
    });
    this.root.querySelectorAll<HTMLElement>("[data-combatant-id]").forEach((card) => {
      const combatantId = card.dataset.combatantId!;
      card.querySelector<HTMLElement>(".gm-combatant-summary")?.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        this.expandedCombatantId = this.expandedCombatantId === combatantId ? null : combatantId;
        this.render();
      });
      card.querySelector('[data-action="link-selected-miniature"]')?.addEventListener("click", () => { void this.linkSelectedMiniature(combatantId); });
      card.querySelector('[data-action="unlink-miniature"]')?.addEventListener("click", () => { void this.apply({ kind: "set-talespire-creature", combatantId, creatureId: null }); });
      card.querySelector('[data-action="activate-combatant"]')?.addEventListener("click", () => void this.apply({ kind: "set-active-combatant", combatantId }));
      card.querySelector('[data-action="save-initiative"]')?.addEventListener("click", () => {
        const input = card.querySelector<HTMLInputElement>('[data-action="initiative"]');
        if (input) void this.apply({ kind: "set-initiative", combatantId, initiative: input.value === "" ? null : integer(input.value) });
      });
      card.querySelector('[data-action="remove-combatant"]')?.addEventListener("click", () => {
        const combatant = this.requireEncounter().combatants.find((entry) => entry.id === combatantId);
        if (combatant) { if (this.expandedCombatantId === combatantId) this.expandedCombatantId = null; void this.apply({ kind: "remove-combatant", combatantId }); }
      });
      card.querySelector('[data-action="roll-initiative"]')?.addEventListener("click", () => { void this.rollCombatantInitiative(combatantId); });
      for (const kind of ["damage", "heal", "grant-temporary-hit-points"] as const) {
        const action = kind === "grant-temporary-hit-points" ? "temporary-hit-points" : kind;
        card.querySelector(`[data-action="${action}"]`)?.addEventListener("click", () => {
          const amount = integer(card.querySelector<HTMLInputElement>('[data-action="hp-amount"]')?.value ?? null);
          if (amount > 0) void this.apply({ kind, combatantId, amount });
        });
      }
      const hpAmount = card.querySelector<HTMLInputElement>('[data-action="hp-amount"]');
      hpAmount?.addEventListener("input", () => {
        const valid = Number.isSafeInteger(Number(hpAmount.value)) && Number(hpAmount.value) > 0;
        for (const action of ["damage", "heal", "temporary-hit-points"]) {
          const button = card.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
          if (button) button.disabled = !valid;
        }
      });
      card.querySelector('[data-action="toggle-visibility"]')?.addEventListener("click", () => {
        const combatant = this.requireEncounter().combatants.find((entry) => entry.id === combatantId);
        if (combatant) void this.apply({ kind: "set-visibility", combatantId, visibleToPlayers: !combatant.visibleToPlayers });
      });
      card.querySelector('[data-action="add-condition"]')?.addEventListener("click", () => { void this.addCondition(combatantId, card); });
      card.querySelectorAll<HTMLElement>('[data-action="remove-condition"]').forEach((button) => button.addEventListener("click", () => {
        const conditionId = button.dataset.conditionId;
        if (conditionId) void this.apply({ kind: "remove-condition", combatantId, conditionId });
      }));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-roll-expression]").forEach((button) => button.addEventListener("click", () => {
      const expression = button.dataset.rollExpression;
      if (!expression) return;
      const mode = button.closest(".gm-monster-details")?.querySelector<HTMLSelectElement>("[data-monster-roll-mode]")?.value;
      const rollMode = mode === "advantage" || mode === "disadvantage" ? mode : "normal";
      void this.runtime.diceRoller.roll({ name: button.dataset.rollName || "Monstruo", expressions: [expression], mode: rollMode })
        .then((result) => { this.appendActionLog(`${button.dataset.rollName || "Tirada"}: ${result.summary}`, "roll"); this.message = { kind: "success", text: result.summary }; this.render(); })
        .catch((error) => { this.message = { kind: "error", text: this.formatError(error) }; this.render(); });
    }));
    this.applyCombatantSearch();
  }

  private applyCombatantSearch(): void {
    const input = this.root.querySelector<HTMLInputElement>("[data-gm-combatant-search]"); if (!input) return;
    const query = normalizedSearch(input.value); let visible = 0;
    this.root.querySelectorAll<HTMLButtonElement>("[data-gm-combatant-candidate]").forEach((button) => {
      const matches = !query || (button.dataset.search ?? "").includes(query);
      button.hidden = !matches || visible >= 40; if (matches) visible += 1;
    });
  }

  private async linkSelectedMiniature(combatantId: string): Promise<void> {
    if (!this.runtime.selectMiniature) return;
    try {
      const miniature = await this.runtime.selectMiniature();
      await this.apply({ kind: "set-talespire-creature", combatantId, creatureId: miniature.creatureId });
      this.message = { kind: "success", text: `Miniatura “${miniature.displayName}” vinculada al combatiente.` };
      this.render();
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
      this.render();
    }
  }

  private apply(action: Parameters<EncounterApplication["apply"]>[0]["action"]): Promise<void> {
    const encounter = this.requireEncounter();
    return this.execute(async () => (await this.application.apply({
      encounterId: encounter.id,
      expectedEncounterRevision: encounter.revision,
      expectedCampaignChecksum: this.requireSnapshot().checksum,
      action,
    })).snapshot, this.describeEncounterAction(action));
  }

  private async connectTaleSpireInitiative(): Promise<void> {
    if (!this.runtime.getNativeInitiative) return;
    try {
      const queue = await this.runtime.getNativeInitiative();
      if (!queue) throw new Error("TaleSpire no expuso una cola de iniciativa válida.");
      this.taleSpireLinkedEncounterId = this.requireEncounter().id;
      this.previousTaleSpireInitiativeQueue = null;
      await this.enqueueTaleSpireInitiativeSync(queue, "Encuentro conectado con la iniciativa de TaleSpire.");
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
      this.render();
    }
  }

  private enqueueTaleSpireInitiativeSync(queue: TaleSpireNativeInitiativeQueue, success?: string): Promise<void> {
    this.taleSpireInitiativeSync = this.taleSpireInitiativeSync.then(async () => {
      if (!this.snapshot || this.selectedEncounterId !== this.taleSpireLinkedEncounterId) return;
      const encounterId = this.selectedEncounterId;
      if (!encounterId) return;
      const encounter = this.snapshot.campaign.encounters[encounterId];
      if (!encounter) return;
      const roundDelta = calculateTaleSpireRoundDelta(this.previousTaleSpireInitiativeQueue, queue);
      this.previousTaleSpireInitiativeQueue = structuredClone(queue);
      await this.execute(() => this.application.synchronizeTaleSpireInitiative({
        encounterId: encounter.id,
        expectedEncounterRevision: encounter.revision,
        expectedCampaignChecksum: this.requireSnapshot().checksum,
        queue: { ...queue, roundDelta },
      }), success);
    });
    return this.taleSpireInitiativeSync;
  }

  private async execute(operation: () => Promise<CampaignSnapshot>, success?: string): Promise<void> {
    const before = this.snapshot ? this.captureHistoryState(this.snapshot) : null;
    try {
      const snapshot = await operation();
      if (before) this.recordReversibleAction(success ?? "Actualizar encuentro", before, this.captureHistoryState(snapshot));
      this.snapshot = snapshot;
      this.message = success ? { kind: "success", text: success } : null;
      this.selectAvailableEncounter();
      const active = this.selectedEncounterId ? this.snapshot.campaign.encounters[this.selectedEncounterId] : null;
      if (active) await this.runtime.publishEncounter?.(active);
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
      this.snapshot = await this.application.loadCampaign();
    }
    this.selectAvailableEncounter();
    this.render();
  }

  private captureHistoryState(snapshot: CampaignSnapshot): GmHistoryState {
    return { encounters: structuredClone(snapshot.campaign.encounters), workspace: structuredClone(snapshot.campaign.gm) };
  }

  private acceptSnapshot(snapshot: CampaignSnapshot, label: string): void {
    if (this.snapshot) this.recordReversibleAction(label, this.captureHistoryState(this.snapshot), this.captureHistoryState(snapshot));
    this.snapshot = snapshot;
  }

  private recordReversibleAction(label: string, before: GmHistoryState, after: GmHistoryState): void {
    this.undoStack.push({ id: this.nextHistoryId++, label, before, after, occurredAt: new Date().toISOString() });
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
    this.appendActionLog(label);
  }

  private appendActionLog(label: string, kind: GmLogEntry["kind"] = "action"): void {
    this.actionLog.push({ id: this.nextHistoryId++, label, occurredAt: new Date().toISOString(), kind });
    if (this.actionLog.length > 150) this.actionLog.splice(0, this.actionLog.length - 150);
  }

  private async restoreHistoryEntry(entry: ReversibleGmAction, state: "before" | "after"): Promise<CampaignSnapshot> {
    const target = entry[state];
    return this.application.restoreGmControlState({
      expectedCampaignChecksum: this.requireSnapshot().checksum,
      encounters: target.encounters,
      workspace: target.workspace,
    });
  }

  private async undoLastAction(): Promise<void> {
    const entry = this.undoStack.pop();
    if (!entry) return;
    try {
      this.snapshot = await this.restoreHistoryEntry(entry, "before");
      this.redoStack.push(entry);
      this.appendActionLog(`Deshacer: ${entry.label}`, "undo");
      this.message = { kind: "success", text: `Deshecho: ${entry.label}` };
      this.selectAvailableEncounter();
      this.render();
    } catch (error) {
      this.undoStack.push(entry);
      this.message = { kind: "error", text: this.formatError(error) };
      this.snapshot = await this.application.loadCampaign();
      this.render();
    }
  }

  private async redoLastAction(): Promise<void> {
    const entry = this.redoStack.pop();
    if (!entry) return;
    try {
      this.snapshot = await this.restoreHistoryEntry(entry, "after");
      this.undoStack.push(entry);
      this.appendActionLog(`Rehacer: ${entry.label}`, "redo");
      this.message = { kind: "success", text: `Rehecho: ${entry.label}` };
      this.selectAvailableEncounter();
      this.render();
    } catch (error) {
      this.redoStack.push(entry);
      this.message = { kind: "error", text: this.formatError(error) };
      this.snapshot = await this.application.loadCampaign();
      this.render();
    }
  }

  private setGmColor(candidate: string): void {
    const color = normalizeUiHexColor(candidate);
    if (!color) {
      this.message = { kind: "error", text: "Ingresá un color hexadecimal válido, por ejemplo #6f96c4." };
      this.render();
      return;
    }
    this.gmColor = color;
    try { window.localStorage.setItem("talespire-5e-toolset:v2:gm:color", this.gmColor); } catch { /* Persiste durante la sesión. */ }
    this.appendActionLog(`Cambiar color GM a ${this.gmColor}`, "system");
    this.render();
  }

  private describeEncounterAction(action: Parameters<EncounterApplication["apply"]>[0]["action"]): string {
    const labels: Record<string, string> = {
      "advance-turn": "Avanzar turno", "previous-turn": "Retroceder turno", "set-active-combatant": "Cambiar combatiente activo",
      "set-initiative": "Actualizar iniciativa", "remove-combatant": "Quitar combatiente", damage: "Aplicar daño", heal: "Curar combatiente",
      "grant-temporary-hit-points": "Agregar PG temporales", "set-visibility": "Cambiar visibilidad", "add-condition": "Agregar condición", "remove-condition": "Quitar condición",
      "set-talespire-creature": "Cambiar miniatura de TaleSpire",
      "add-combatant": "Agregar combatiente", "update-combatant-stats": "Actualizar estadísticas", "synchronize-talespire-initiative": "Sincronizar iniciativa de TaleSpire",
    };
    return labels[action.kind] ?? "Actualizar encuentro";
  }

  private findMonster(nameOrId: string): MonsterDefinition | null {
    const normalized = nameOrId.trim().toLocaleLowerCase();
    return this.monsterCatalog().find((monster) => monster.id.toLocaleLowerCase() === normalized || monster.name.toLocaleLowerCase() === normalized) ?? null;
  }

  private monsterCatalog(): MonsterDefinition[] {
    const catalog = new Map<string, MonsterDefinition>();
    for (const monster of this.runtime.monsters) catalog.set(monster.name.toLocaleLowerCase(), monster);
    for (const monster of this.customMonsters) catalog.set(monster.name.toLocaleLowerCase(), monster);
    return [...catalog.values()].sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
  }

  private async saveCustomMonster(data: FormData): Promise<void> {
    if (!this.runtime.saveCustomMonster) return;
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    const duplicate = this.customMonsters.find((monster) => monster.name.toLocaleLowerCase() === name.toLocaleLowerCase() && monster.name !== this.editingCustomMonsterKey);
    if (duplicate && globalThis.confirm && !globalThis.confirm(`Ya existe ${duplicate.name}. ¿Sobrescribirlo?`)) return;
    const featureData = (key: string) => String(data.get(key) ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [entryName = "", content = "", usage = ""] = line.split("|").map((part) => part.trim());
      return { Name: entryName, Content: content, Usage: usage };
    });
    const list = (key: string): string[] => data.getAll(key).flatMap((value) => String(value).split(/[,\r\n]+/)).map((entry) => entry.trim()).filter(Boolean);
    const previousKey = this.editingCustomMonsterKey === "__new__" ? null : this.editingCustomMonsterKey ?? this.selectedCustomMonsterKey ?? duplicate?.name ?? null;
    const existing = previousKey ? this.customMonsters.find((monster) => monster.name === previousKey) ?? null : null;
    const definition = normalizeMonsterDefinition({
      Id: name,
      Name: name,
      Source: "Homebrew",
      Type: String(data.get("type") ?? "").trim(),
      Size: String(data.get("size") ?? "").trim(),
      Alignment: String(data.get("alignment") ?? "").trim(),
      Challenge: String(data.get("challenge") ?? "0").trim(),
      HP: { Value: Math.max(0, integer(data.get("hitPoints"), 10)), Notes: String(data.get("hitPointFormula") ?? "").trim() },
      AC: { Value: Math.max(0, integer(data.get("armorClass"), 10)), Notes: "" },
      InitiativeModifier: integer(data.get("initiativeModifier")),
      InitiativeAdvantage: data.get("initiativeAdvantage") === "on",
      Speed: list("speed"),
      Abilities: Object.fromEntries(["Str", "Dex", "Con", "Int", "Wis", "Cha"].map((key) => [key, integer(data.get(`ability${key}`), 10)])),
      Saves: list("saves"), Skills: list("skills"), Senses: list("senses"), Languages: list("languages"),
      DamageVulnerabilities: list("vulnerabilities"), DamageResistances: list("resistances"),
      DamageImmunities: list("immunities"), ConditionImmunities: list("conditionImmunities"),
      Traits: featureData("traits"), Actions: featureData("actions"), Reactions: featureData("reactions"),
      LegendaryActions: featureData("legendaryActions"),
      Spells: list("spells"), Inventory: existing?.inventory ?? [],
    });
    definition.catalog = catalogFormMetadata(existing, data);
    try {
      await this.runtime.saveCustomMonster(definition, previousKey);
      this.customMonsters = [...this.customMonsters.filter((monster) =>
        monster.name !== previousKey && monster.name.toLocaleLowerCase() !== definition.name.toLocaleLowerCase()), definition];
      this.toolsPanel.syncMonsterInventory(definition);
      this.selectedCustomMonsterKey = definition.name;
      this.editingCustomMonsterKey = null;
      this.monsterTemplate = null;
      this.monsterSearch = definition.name;
      this.monsterShowAll = false;
      this.appendActionLog(`Guardar monstruo: ${definition.name}`);
      this.message = { kind: "success", text: `${definition.name} guardado en el catálogo de esta campaña.` };
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
    }
    this.render();
  }

  private async toggleMonsterFavorite(key: string): Promise<void> {
    if (!this.runtime.saveCustomMonster) return;
    const current = this.customMonsters.find((monster) => monster.name === key);
    if (!current) return;
    const meta = catalogMetadata(current);
    const tags = visibleCatalogTags(meta.tags);
    if (!isCatalogFavorite(current)) tags.push(FAVORITE_TAG);
    const updated = { ...current, catalog: { ...meta, tags } };
    try {
      await this.runtime.saveCustomMonster(updated, key);
      this.customMonsters = this.customMonsters.map((monster) => monster.name === key ? updated : monster);
      this.appendActionLog(`Favorito: ${key}`);
      this.message = { kind: "success", text: "Favoritos actualizados." };
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
    }
    this.render();
  }

  private async deleteCustomMonster(): Promise<void> {
    const key = this.selectedCustomMonsterKey;
    if (!key || !this.runtime.deleteCustomMonster) return;
    try {
      await this.runtime.deleteCustomMonster(key);
      this.customMonsters = this.customMonsters.filter((monster) => monster.name !== key);
      this.selectedCustomMonsterKey = this.customMonsters[0]?.name ?? null;
      this.editingCustomMonsterKey = null;
      this.appendActionLog(`Eliminar monstruo: ${key}`);
      this.message = { kind: "success", text: `${key} eliminado del catálogo de esta campaña.` };
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
    }
    this.render();
  }

  private async applyReceivedSummary(received: ReceivedCharacterSummary): Promise<void> {
    const encounter = this.selectedEncounterId ? this.snapshot?.campaign.encounters[this.selectedEncounterId] : null;
    const combatant = encounter?.combatants.find((entry) => entry.kind === "player" && (
      entry.taleSpireClientId === received.clientId || entry.characterId === received.summary.characterId
    ));
    if (!encounter || !combatant || !this.snapshot) { this.render(); return; }
    await this.execute(() => this.application.updateConnectedPlayer({
      encounterId: encounter.id,
      combatantId: combatant.id,
      summary: received.summary,
      taleSpireClientId: received.clientId,
      expectedEncounterRevision: encounter.revision,
      expectedCampaignChecksum: this.snapshot!.checksum,
    }), `Estadísticas de ${received.summary.name} actualizadas.`);
  }

  private async applyReceivedInitiative(clientId: string, initiative: number, characterId: string | null): Promise<void> {
    const encounter = this.selectedEncounterId ? this.snapshot?.campaign.encounters[this.selectedEncounterId] : null;
    const summaryCharacterId = this.playerSummaries.get(clientId)?.characterId ?? null;
    const combatant = encounter ? findPlayerInitiativeCombatant(encounter, clientId, characterId, summaryCharacterId) : null;
    if (encounter && combatant) await this.apply({ kind: "set-initiative", combatantId: combatant.id, initiative });
  }

  private async rollCombatantInitiative(combatantId: string): Promise<void> {
    const encounter = this.requireEncounter();
    const combatant = encounter.combatants.find((entry) => entry.id === combatantId);
    if (!combatant) return;
    const monster = combatant.kind === "monster" ? this.findMonster(combatant.monsterDefinitionId) : null;
    const character = combatant.kind === "player" && combatant.characterId
      ? this.requireSnapshot().campaign.characters[combatant.characterId] ?? null
      : null;
    const modifier = monster?.initiativeModifier ?? (character ? projectCharacterStatistics(character).initiativeModifier : 0);
    try {
      const result = await this.runtime.diceRoller.roll({
        name: `Iniciativa: ${combatant.name}`,
        expressions: [`1d20${modifier >= 0 ? "+" : ""}${modifier}`],
        mode: monster?.initiativeAdvantage ? "advantage" : "normal",
      });
      const initiative = result.totals[0];
      this.appendActionLog(`Iniciativa de ${combatant.name}: ${result.summary}`, "roll");
      if (initiative !== undefined) await this.apply({ kind: "set-initiative", combatantId, initiative });
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
      this.render();
    }
  }

  private async addCondition(combatantId: string, card: HTMLElement): Promise<void> {
    const select = card.querySelector<HTMLSelectElement>('[data-action="condition-select"]');
    const definition = GM_CONDITIONS.find(([key]) => key === select?.value);
    if (!definition) return;
    const encounter = this.requireEncounter();
    await this.execute(() => this.application.addCondition({
      encounterId: encounter.id,
      combatantId,
      key: definition[0],
      label: definition[1],
      expectedEncounterRevision: encounter.revision,
      expectedCampaignChecksum: this.requireSnapshot().checksum,
    }));
  }

  private requireSnapshot(): CampaignSnapshot {
    if (!this.snapshot) throw new Error("CAMPAIGN_NOT_FOUND");
    return this.snapshot;
  }

  private requireEncounter(): Encounter {
    const encounter = this.selectedEncounterId ? this.requireSnapshot().campaign.encounters[this.selectedEncounterId] : null;
    if (!encounter) throw new Error("ENCOUNTER_NOT_FOUND");
    return encounter;
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
