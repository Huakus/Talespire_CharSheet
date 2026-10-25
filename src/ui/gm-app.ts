import { EncounterApplication } from "../application/encounter/encounter-application";
import type { CampaignSnapshot } from "../application/ports/campaign-repository";
import { isBloodied, orderedCombatants } from "../domain/encounter/encounter";
import type { Encounter, EncounterCombatant } from "../domain/encounter/encounter-model";
import type { DiceRoller } from "../application/ports/dice-roller";
import { CHALLENGE_RATINGS, MONSTER_SIZES, MONSTER_TYPES, normalizeMonsterDefinition, type MonsterDefinition } from "../domain/monsters/monster-catalog";
import type { EncounterTransferStatus, ReceivedCharacterSummary, TaleSpireGmPlayer, TaleSpireNativeInitiativeQueue } from "../infrastructure/talespire/talespire-gm-collaboration";
import { projectCharacterStatistics, projectAdjustedRollMode, projectSpellcasting } from "../domain/character/character-projection";
import type { CharacterV2 } from "../domain/character/character-v2";
import type { SpellDefinition } from "../domain/character/character-spell-model";
import type { CatalogMetadata } from "../domain/content/catalog-metadata";
import { GmToolsPanel, type GmContentSection, type GmSection, type GmToolsRuntime } from "./gm-tools-panel";
import type { GmWorkspace } from "../domain/gm/gm-workspace";
import {
  canOpenPersistencePanel,
  openPersistencePanel,
  renderAppConnectionIndicators,
  subscribeAppConnectionStatus,
  getAppConnectionStatuses,
} from "./app-chrome";
import { captureIssueFormState, openIssueReportDialog, renderIssueReportButton } from "./issue-report-dialog";
import type { CampaignIssueReporter, IssueUiContext } from "../infrastructure/remote/supabase-campaign-issue-client";
import { bindViewportConstrainedDetails } from "./floating-panel";
import { renderCheckboxGroup } from "./checkbox-group";
import type { CampaignLoreReader } from "../application/ports/campaign-lore-reader";
import { CampaignLoreBrowser } from "./campaign-lore-browser";
import { normalizeUiHexColor, UI_ACCENT_PRESETS, uiAccentStyle } from "./design-system/theme";
import { renderUiEmptyState } from "./design-system/primitives";
import { FormDraftStore } from "./form-draft-store";
import { bindMonsterEditor, readMonsterFeatures, renderMonsterDefenses, renderMonsterFeatures, renderMonsterSpells } from "./monster-editor";
import { APP_BUILD } from "../build-info";
import { inspectMiniatureImage, openMiniatureImageDiagnostics, type MiniatureImageReport } from "./miniature-image-diagnostics";

export { calculateFloatingPanelPosition } from "./floating-panel";

type GmContentKind = "monster" | GmContentSection;

export interface GmAppRuntime extends GmToolsRuntime {
  issueReporter?: CampaignIssueReporter;
  diceRoller: DiceRoller;
  subscribeCampaignChanges?: (listener: () => void) => () => void;
  subscribeDiceResults?: (listener: (result: { name: string; total: number; correlationId?: string }) => void) => () => void;
  subscribeDiceCancellations?: (listener: (correlationId: string) => void) => () => void;
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
  createMiniatureThumbnail?: (creatureId: string) => Promise<HTMLElement | null>;
  subscribeMiniatureChanges?: (listener: (creatureId: string | null) => void) => () => void;
  getMiniatureImageDiagnostics?: () => Pick<MiniatureImageReport, "capabilities"> & { images: NonNullable<MiniatureImageReport["participants"][number]["native"]>[] };
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

export function hasInitiativeOrderMismatch(encounter: Pick<Encounter, "combatants">): boolean {
  const linked = encounter.combatants
    .filter((combatant) => combatant.taleSpireCreatureId !== null)
    .sort((left, right) => left.order - right.order);
  if (linked.length < 2 || linked.every((combatant) => combatant.initiative === null)) return false;
  const byInitiative = [...linked].sort((left, right) => {
    if (left.initiative === null && right.initiative !== null) return 1;
    if (left.initiative !== null && right.initiative === null) return -1;
    return (right.initiative ?? 0) - (left.initiative ?? 0) || left.order - right.order;
  });
  return linked.some((combatant, index) => combatant.id !== byInitiative[index]?.id);
}

export function validEncounterSelection(
  encounters: Readonly<Record<string, unknown>>,
  selectedEncounterId: string | null,
): string | null {
  return selectedEncounterId && encounters[selectedEncounterId] ? selectedEncounterId : null;
}

export interface EncounterSynchronizationWarning {
  code: "initiative-order" | "miniature-without-identity" | "monster-without-miniature";
  text: string;
}

export function encounterSynchronizationWarnings(
  encounter: Pick<Encounter, "combatants">,
  taleSpireConnected: boolean,
): EncounterSynchronizationWarning[] {
  const warnings: EncounterSynchronizationWarning[] = [];
  if (taleSpireConnected && hasInitiativeOrderMismatch(encounter)) {
    warnings.push({
      code: "initiative-order",
      text: "El orden por iniciativa no coincide con TaleSpire. Cambiá el orden de las miniaturas desde TaleSpire.",
    });
  }
  const miniaturesWithoutIdentity = encounter.combatants.filter((combatant) =>
    combatant.taleSpireCreatureId !== null && combatant.kind === "custom"
  );
  if (miniaturesWithoutIdentity.length) {
    warnings.push({
      code: "miniature-without-identity",
      text: `${miniaturesWithoutIdentity.length === 1 ? "La miniatura" : "Las miniaturas"} ${miniaturesWithoutIdentity.map((combatant) => `“${combatant.taleSpireDisplayName ?? combatant.name}”`).join(", ")} ${miniaturesWithoutIdentity.length === 1 ? "no tiene" : "no tienen"} un monstruo o personaje asociado.`,
    });
  }
  const monstersWithoutMiniature = encounter.combatants.filter((combatant) =>
    combatant.kind === "monster" && combatant.taleSpireCreatureId === null
  );
  if (monstersWithoutMiniature.length) {
    warnings.push({
      code: "monster-without-miniature",
      text: `${monstersWithoutMiniature.length === 1 ? "El monstruo" : "Los monstruos"} ${monstersWithoutMiniature.map((combatant) => `“${combatant.name}”`).join(", ")} ${monstersWithoutMiniature.length === 1 ? "no tiene" : "no tienen"} una miniatura asociada.`,
    });
  }
  return warnings;
}

export function findPlayerInitiativeCombatant(
  encounter: Pick<Encounter, "combatants">,
  clientId: string,
  characterId: string | null,
  summaryCharacterId: string | null,
): EncounterCombatant | null {
  const players = encounter.combatants.filter((entry) => entry.kind === "player");
  if (characterId !== null) return players.find((entry) => entry.characterId === characterId) ?? null;
  if (summaryCharacterId !== null) return players.find((entry) => entry.characterId === summaryCharacterId) ?? null;
  return players.find((entry) => entry.taleSpireClientId === clientId) ?? null;
}

export function recommendedInitiativeOrder(combatants: readonly EncounterCombatant[]): EncounterCombatant[] {
  return [...combatants].sort((left, right) => {
    if (left.initiative === null && right.initiative !== null) return 1;
    if (right.initiative === null && left.initiative !== null) return -1;
    return (right.initiative ?? 0) - (left.initiative ?? 0) || left.order - right.order;
  });
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
  private readonly formDrafts = new FormDraftStore();
  private snapshot: CampaignSnapshot | null = null;
  private selectedEncounterId: string | null = null;
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
  private pendingInitiativeRolls = new Map<string, string[]>();
  private operations: Promise<void> = Promise.resolve();
  private polling: ReturnType<typeof globalThis.setInterval> | null = null;
  private refreshingQueue = false;
  private thumbnailCache = new Map<string, Promise<HTMLElement | null>>();
  private thumbnailFailures = new Map<string, { attempt: number; nextAt: number; reason: string }>();
  private thumbnailRetryTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private thumbnailsStopped = false;
  private closeImageDiagnostics: (() => void) | null = null;
  private stopMiniatureChanges: (() => void) | null = null;
  private associationPicker: { combatantId: string; kind: "monster" | "player" } | null = null;
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
    this.stopMiniatureChanges = this.runtime.subscribeMiniatureChanges?.((creatureId) => {
      if (creatureId === null) {
        this.thumbnailCache.clear();
        this.thumbnailFailures.clear();
      } else {
        this.thumbnailCache.delete(creatureId);
        this.thumbnailFailures.delete(creatureId);
      }
      this.populateMiniatureThumbnails();
    }) ?? null;
    this.runtime.subscribeCampaignChanges?.(() => { void this.handleExternalChange(); });
    this.runtime.subscribeDiceResults?.((result) => { void this.handleResolvedDiceResult(result); });
    this.runtime.subscribeDiceCancellations?.((key) => {
      if (this.pendingInitiativeRolls.delete(key)) this.render();
    });
    this.runtime.subscribePlayers?.((players) => { this.players = players; this.render(); });
    this.runtime.subscribeCharacterSummaries?.((received) => {
      this.playerSummaries.set(received.clientId, received.summary);
      void this.applyReceivedSummary(received);
    });
    this.runtime.subscribeInitiative?.((clientId, initiative, characterId) => { void this.applyReceivedInitiative(clientId, initiative, characterId); });
    this.runtime.subscribeNativeInitiative?.((queue) => {
      if (!this.snapshot) return;
      void this.enqueueTaleSpireInitiativeSync(queue);
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
    if (this.snapshot && this.selectedEncounterId) {
      this.snapshot = await this.application.synchronizeCharacters(
        this.snapshot.checksum,
        new Date().toISOString(),
        this.selectedEncounterId,
      );
    }
    this.render();
    void this.loreBrowser?.load();
    await this.refreshNativeQueue();
    if (this.runtime.getNativeInitiative) {
      this.polling = globalThis.setInterval(() => { void this.refreshNativeQueue(); }, 2500);
    }
  }

  stop(): void {
    this.closeImageDiagnostics?.();
    if (this.polling !== null) globalThis.clearInterval(this.polling);
    this.polling = null;
    this.stopMiniatureChanges?.();
    this.stopMiniatureChanges = null;
    this.thumbnailsStopped = true;
    if (this.thumbnailRetryTimer !== null) globalThis.clearTimeout(this.thumbnailRetryTimer);
    this.thumbnailRetryTimer = null;
  }

  private async refreshNativeQueue(): Promise<void> {
    if (!this.runtime.getNativeInitiative || this.refreshingQueue || !this.snapshot) return;
    this.refreshingQueue = true;
    try {
      const queue = await this.runtime.getNativeInitiative();
      if (!queue) throw new Error("TaleSpire no devolvió una cola de turnos válida.");
      await this.enqueueTaleSpireInitiativeSync(queue);
    } catch (error) {
      this.message = { kind: "error", text: this.formatError(error) };
      this.render();
    } finally { this.refreshingQueue = false; }
  }

  private async handleExternalChange(): Promise<void> {
    await this.execute(async () => {
      this.undoStack = [];
      this.redoStack = [];
      const loaded = await this.application.loadCampaign();
      if (!loaded) throw new Error("CAMPAIGN_NOT_FOUND");
      const encounterId = Object.keys(loaded.campaign.encounters)[0];
      if (!encounterId) return loaded;
      return this.application.synchronizeCharacters(loaded.checksum, new Date().toISOString(), encounterId);
    }, undefined, false);
  }

  private selectAvailableEncounter(): void {
    this.selectedEncounterId = Object.keys(this.snapshot?.campaign.encounters ?? {})[0] ?? null;
    this.taleSpireLinkedEncounterId = this.selectedEncounterId;
  }

  private render(): void {
    const selected = this.snapshot && this.selectedEncounterId ? this.snapshot.campaign.encounters[this.selectedEncounterId] ?? null : null;
    const sections: readonly GmSection[] = this.loreBrowser
      ? ["encounter", "content", "lore", "notes", "tools"]
      : ["encounter", "content", "notes", "tools"];
    this.root.innerHTML = `
      <section class="gm-shell" style="${uiAccentStyle(this.gmColor, currentUiThemeMode())}">
        <header class="gm-header">
          <strong class="gm-header-title">Control de GM</strong>
          <div class="gm-header-controls">${this.renderActionHistoryControls()}${renderAppConnectionIndicators()}${this.renderNotificationCenter()}<details class="sheet-menu gm-menu"><summary>⋯</summary><div><button type="button" class="secondary-button" data-open-persistence ${canOpenPersistencePanel() ? "" : "disabled"}>Persistencia</button><button type="button" class="secondary-button" data-open-image-diagnostics>Diagnóstico de imágenes</button>${this.renderColorPicker()}</div></details></div>
        </header>
        <nav class="sheet-tabs gm-section-nav" style="--gm-section-count:${sections.length}">${sections.map((section) => `<button type="button" data-gm-section="${section}" class="sheet-tab-button ${this.activeSection === section ? "active" : ""}">${section === "encounter" ? "Combate" : section === "content" ? "Contenido" : section === "lore" ? "Campaña" : section === "notes" ? "Notas" : "Herramientas"}</button>`).join("")}</nav>
        ${this.activeSection === "encounter" ? `<div class="gm-combat-toolbar">
          <strong>Combate de TaleSpire</strong>
          <span class="gm-connected-count">${this.players.length} conectado${this.players.length === 1 ? "" : "s"}</span>
          <button type="button" data-action="refresh-combat" ${this.runtime.getNativeInitiative ? "" : "disabled"}>Actualizar</button>
          <button type="button" data-action="clear-initiatives" ${(selected?.combatants.some((entry) => entry.initiative !== null) || this.pendingInitiativeRolls.size) ? "" : "disabled"}>Limpiar iniciativas</button>
        </div>
        ${this.snapshot && selected ? this.renderEncounter(selected) : renderUiEmptyState({ title: "No hay una campaña cargada", text: "Abrí una campaña para consultar el combate de TaleSpire.", className: "sheet-empty" })}` : ""}

        ${this.activeSection === "content" ? `<div class="gm-content-source-bar"><span>Catálogo de esta campaña · Supabase</span></div>${this.renderContentNavigation()}${this.activeContentKind === "monster" ? this.renderCustomMonsterManager() : this.toolsPanel.render("content", this.snapshot?.campaign.gm ?? { noteGroups: [], randomTables: [], googleDocsUrl: "" }, this.activeContentKind)}` : ""}
        ${this.activeSection === "lore" ? this.loreBrowser?.render() ?? "" : ""}
        ${this.activeSection === "notes" && this.snapshot ? this.toolsPanel.render("notes", this.snapshot.campaign.gm) : ""}
        ${this.activeSection === "tools" && this.snapshot ? this.toolsPanel.render("tools", this.snapshot.campaign.gm) : ""}
      </section>`;
    this.bindEvents();
    this.populateMiniatureThumbnails();
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
    return `${renderIssueReportButton(Boolean(this.runtime.issueReporter))}<details class="notification-center ${unread ? "has-unread" : ""}"><summary title="Mensajes" aria-label="Mensajes${unread ? `: ${unread} importantes sin leer` : ""}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path></svg>${unread ? `<strong class="notification-badge">${unread}</strong>` : ""}</summary><div><header><strong>Mensajes</strong><small>${notifications.length} en esta sesión</small></header>${notifications.length ? `<ol>${notifications.map((entry) => `<li class="${entry.kind}"><time>${entry.occurredAt.slice(11, 19)}</time><span>${escapeHtml(entry.text)}</span></li>`).join("")}</ol>` : "<p>Sin mensajes en esta sesión.</p>"}</div></details>`;
  }

  private issueUiContext(): IssueUiContext {
    return {
      view: { mode: 'gm', theme: currentUiThemeMode(), interfaceColor: this.gmColor, screen: this.activeSection, contentKind: this.activeContentKind,
        selectedEncounterId: this.selectedEncounterId, expandedCombatantId: this.expandedCombatantId,
        selectedMonsterKey: this.selectedCustomMonsterKey, editingMonsterKey: this.editingCustomMonsterKey,
        monsterSearch: this.monsterSearch, monsterFilters: [...this.monsterFilters], monsterFavoritesOnly: this.monsterFavoritesOnly,
        players: this.players, initiative: this.previousTaleSpireInitiativeQueue,
        miniatureImages: this.miniatureImageReport() },
      selectedCharacterId: null, character: null,
      campaignChecksum: this.snapshot?.checksum ?? null,
      campaignRevision: this.snapshot?.campaign.revision ?? null,
      loadedCampaign: this.snapshot?.campaign ?? null,
      pendingForms: captureIssueFormState(this.root),
      notifications: this.notifications.slice(-40), actions: this.actionLog.slice(-40),
      connection: getAppConnectionStatuses(),
    };
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
    return `<section class="gm-encounter-board gm-native-combat">
      <p class="gm-combat-caption">${this.runtime.getNativeInitiative ? "Participantes y orden de la cola de TaleSpire. Las flechas indican la posición recomendada por iniciativa." : "La cola de turnos no está disponible fuera de TaleSpire."}</p>
      <div class="gm-combatants">${combatants.length
        ? combatants.map((combatant) => this.renderCombatant(encounter, combatant)).join("")
        : renderUiEmptyState({ title: "La cola de turnos está vacía", text: "Agregá miniaturas al modo por turnos de TaleSpire. Sus tarjetas aparecerán aquí automáticamente.", className: "sheet-empty" })}
      </div></section>`;
  }

  private populateMiniatureThumbnails(): void {
    if (!this.runtime.createMiniatureThumbnail || this.thumbnailsStopped) return;
    const slots = [...this.root.querySelectorAll<HTMLElement>("[data-miniature-image]")];
    const present = new Set(slots.map((slot) => slot.dataset.miniatureImage!));
    for (const id of this.thumbnailFailures.keys()) {
      if (!present.has(id)) {
        this.thumbnailFailures.delete(id);
        this.thumbnailCache.delete(id);
      }
    }
    slots.forEach((slot) => {
      const creatureId = slot.dataset.miniatureImage!;
      if (!creatureId) return;
      let thumbnail = this.thumbnailCache.get(creatureId);
      if (!thumbnail) {
        slot.dataset.miniatureImageState = "loading";
        thumbnail = this.runtime.createMiniatureThumbnail!(creatureId).then((element) => {
          if (!element) throw new Error("TaleSpire no devolvió una imagen del modelo activo.");
          if (this.thumbnailCache.get(creatureId) === thumbnail) this.thumbnailFailures.delete(creatureId);
          return element;
        }).catch((error: unknown) => {
          if (this.thumbnailCache.get(creatureId) === thumbnail && !this.thumbnailsStopped) {
            const attempt = (this.thumbnailFailures.get(creatureId)?.attempt ?? 0) + 1;
            const delay = [1000, 3000, 10000, 30000][Math.min(attempt - 1, 3)]!;
            this.thumbnailFailures.set(creatureId, { attempt, nextAt: Date.now() + delay,
              reason: error instanceof Error ? error.message : String(error) });
            if (attempt === 1) console.warn("TALESPIRE_MINIATURE_IMAGE_FAILED", creatureId, error);
            this.scheduleMiniatureRetry();
          }
          return null;
        });
        this.thumbnailCache.set(creatureId, thumbnail);
      }
      void thumbnail.then((element) => {
        if (!slot.isConnected || this.thumbnailCache.get(creatureId) !== thumbnail || this.thumbnailsStopped) return;
        slot.dataset.miniatureImageState = element ? "ready" : "retrying";
        slot.title = element ? "Modelo activo de la miniatura en TaleSpire" : "Imagen pendiente. Se reintentará automáticamente.";
        if (element) {
          element.classList.add("gm-miniature-render");
          slot.replaceChildren(element);
        }
      });
    });
    this.scheduleMiniatureRetry();
  }

  private miniatureImageReport(): MiniatureImageReport {
    const native = this.runtime.getMiniatureImageDiagnostics?.();
    const encounter = this.selectedEncounterId ? this.snapshot?.campaign.encounters[this.selectedEncounterId] : null;
    const slots = [...this.root.querySelectorAll<HTMLElement>("[data-miniature-image]")];
    return {
      build: APP_BUILD, capturedAt: new Date().toISOString(),
      thumbnailLoaderAvailable: Boolean(this.runtime.createMiniatureThumbnail),
      capabilities: native?.capabilities ?? {},
      participants: (encounter ? orderedCombatants(encounter) : []).filter((entry) => entry.taleSpireCreatureId).map((entry) => {
        const creatureId = entry.taleSpireCreatureId!;
        const failure = this.thumbnailFailures.get(creatureId);
        const imageDiagnostic = native?.images.find((image) => image.creatureId === creatureId);
        return {
          creatureId, name: entry.taleSpireDisplayName ?? entry.name,
          ...(imageDiagnostic ? { native: imageDiagnostic } : {}),
          ...(failure ? { failure: { attempt: failure.attempt, reason: failure.reason,
            retryInMs: Number.isFinite(failure.nextAt) ? Math.max(0, failure.nextAt - Date.now()) : null } } : {}),
          display: inspectMiniatureImage(slots.find((slot) => slot.dataset.miniatureImage === creatureId) ?? null),
        };
      }),
    };
  }

  private retryMiniatureImages(): void {
    this.thumbnailCache.clear();
    this.thumbnailFailures.clear();
    this.populateMiniatureThumbnails();
  }

  private scheduleMiniatureRetry(): void {
    if (this.thumbnailRetryTimer !== null) globalThis.clearTimeout(this.thumbnailRetryTimer);
    this.thumbnailRetryTimer = null;
    if (!this.thumbnailFailures.size || this.thumbnailsStopped) return;
    const deadlines = [...this.thumbnailFailures.values()].map((failure) => failure.nextAt).filter(Number.isFinite);
    if (!deadlines.length) return;
    const nextAt = Math.min(...deadlines);
    this.thumbnailRetryTimer = globalThis.setTimeout(() => {
      this.thumbnailRetryTimer = null;
      for (const [id, failure] of this.thumbnailFailures) {
        if (failure.nextAt <= Date.now()) {
          this.thumbnailCache.delete(id);
          failure.nextAt = Infinity;
        }
      }
      this.populateMiniatureThumbnails();
    }, Math.max(0, nextAt - Date.now()));
  }

  private renderCombatant(encounter: Encounter, combatant: EncounterCombatant): string {
    const active = encounter.activeCombatantId === combatant.id;
    const monster = combatant.kind === "monster" ? this.findMonster(combatant.monsterDefinitionId) : null;
    const character = combatant.kind === "player" && combatant.characterId ? this.snapshot?.campaign.characters[combatant.characterId] ?? null : null;
    const associated = Boolean(monster || character);
    const expanded = this.expandedCombatantId === combatant.id;
    const pending = [...this.pendingInitiativeRolls.values()].some((ids) => ids.includes(combatant.id));
    const currentPercent = combatant.hitPoints.maximum > 0 ? Math.min(100, combatant.hitPoints.current / combatant.hitPoints.maximum * 100) : 0;
    const temporaryPercent = combatant.hitPoints.maximum > 0 ? Math.min(100, combatant.hitPoints.temporary / combatant.hitPoints.maximum * 100) : 0;
    const bloodied = isBloodied(combatant) && !combatant.conditions.some((condition) => condition.key === "bloodied");
    const desired = recommendedInitiativeOrder(encounter.combatants).findIndex((entry) => entry.id === combatant.id);
    const current = orderedCombatants(encounter).findIndex((entry) => entry.id === combatant.id);
    const correction = combatant.initiative !== null && desired !== current;
    const orderSummary = `<span class="gm-combat-order ${correction ? "needs-order" : ""}" title="Posición actual: ${current + 1}. Posición recomendada por iniciativa: ${desired + 1}."><small>TS #${current + 1}</small>${correction ? `<span class="gm-order-correction" title="Mover manualmente al puesto ${desired + 1} en TaleSpire" aria-label="${desired < current ? "Subir" : "Bajar"} al puesto ${desired + 1}">${desired < current ? "↑" : "↓"} #${desired + 1}</span>` : ""}</span>`;
    const conditions = combatant.conditions;
    const spellcasting = character ? projectSpellcasting(character) : null;
    const monsterSize = monster?.size && !normalizedSearch(monster.type).includes(normalizedSearch(monster.size)) ? ` · ${monster.size}` : "";
    const identityType = character ? character.identity.className || "Personaje" : monster ? `${monster.type || "Criatura"}${monsterSize}` : "";
    const identityRank = character ? `nivel ${character.identity.level}` : monster ? `VD ${monster.challenge || "—"}` : "";
    const identityDetail = `${identityType} · ${identityRank}`;
    const monsterPerception = monster?.senses.join(" ").match(/(?:percepci[oó]n\s+pasiva|passive\s+perception)\s*:?\s*(\d+)/i)?.[1];
    const tacticalFacts = [
      { label: "Velocidad", value: character?.combat.speed || monster?.speed.join(", ") || "", title: "Velocidad" },
      { label: "P. pasiva", value: character ? String(projectCharacterStatistics(character).passives.perception) : monsterPerception ?? "", title: "Percepción pasiva" },
      { label: "CD conj.", value: spellcasting?.ability ? String(spellcasting.saveDc) : "", title: "CD de salvación de conjuros" },
      { label: "ATQ conj.", value: spellcasting?.ability ? `${spellcasting.attackModifier >= 0 ? "+" : ""}${spellcasting.attackModifier}` : "", title: "Bonificador de ataque con conjuros" },
    ].filter((fact) => fact.value).map((fact) => `<span class="gm-combat-fact" title="${fact.title}: ${escapeHtml(fact.value)}"><small>${fact.label}</small><strong>${escapeHtml(fact.value)}</strong></span>`).join("");
    const conditionChip = (label: string, key: string): string => `<span class="gm-combat-status" data-condition-key="${escapeHtml(key)}">${escapeHtml(label)}</span>`;
    const statusChips = [
      ...(active ? ['<span class="gm-combat-status gm-combat-active-label">Turno activo</span>'] : []),
      ...conditions.map((condition) => conditionChip(`${condition.label}${condition.level ? ` ${condition.level}` : ""}`, condition.key)),
      ...(bloodied ? [conditionChip("Herido", "bloodied")] : []),
      ...(character?.combat.exhaustion ? [conditionChip(`Agotamiento ${character.combat.exhaustion}`, "exhaustion")] : []),
    ].join("");
    return `<details class="gm-combatant ${active ? "active" : ""} ${character ? "linked-character" : ""} ${associated ? "" : "missing-association"}" data-combatant-id="${combatant.id}" ${expanded ? "open" : ""}>
      <summary class="gm-combatant-summary">
        <span class="gm-combatant-miniature"><span class="gm-miniature-image" data-miniature-image="${escapeHtml(combatant.taleSpireCreatureId ?? "")}" role="img" aria-label="Miniatura de ${escapeHtml(combatant.taleSpireDisplayName ?? combatant.name)}"><span class="gm-miniature-placeholder" aria-hidden="true">♟</span></span><small title="${escapeHtml(combatant.taleSpireDisplayName ?? combatant.name)}">${escapeHtml(combatant.taleSpireDisplayName ?? combatant.name)}</small></span>
        <span class="gm-combatant-core ${associated ? "" : "needs-association"}">
          <span class="gm-combatant-identity"><strong title="${escapeHtml(associated ? combatant.name : "Sin combatiente asociado")}">${escapeHtml(associated ? combatant.name : "Sin combatiente asociado")}</strong>${associated ? `<small title="${escapeHtml(identityDetail)}"><span class="gm-combat-identity-type">${escapeHtml(identityType)}</span><span class="gm-combat-identity-rank">${escapeHtml(identityRank)}</span></small>` : ""}</span>
          ${associated ? `${tacticalFacts ? `<span class="gm-combat-facts" aria-label="Estadísticas rápidas">${tacticalFacts}</span>` : ""}`
          : '<span class="gm-associate-actions"><button type="button" data-open-association="monster">Asociar criatura</button><button type="button" data-open-association="player">Asociar personaje</button></span>'}
          ${associated && statusChips ? `<span class="gm-summary-conditions" aria-label="Estados">${statusChips}</span>` : !associated && active ? '<span class="gm-summary-conditions" aria-label="Estados"><span class="gm-combat-status gm-combat-active-label">Turno activo</span></span>' : ""}
        </span>
        ${associated ? `<span class="gm-combat-ac"><small>CA</small><strong>${combatant.armorClass ?? "—"}</strong></span>
        <span class="hp-readout gm-combatant-hp-readout" style="--hp-level:${Math.round(currentPercent)}%;--hp-temp-level:${Math.round(temporaryPercent)}%;--hp-temp-bottom:${Math.min(currentPercent, 100 - temporaryPercent)}%;--hp-tone:hsl(${Math.round(currentPercent / 100 * 112)} 38% 43%)" role="meter" aria-label="Puntos de golpe" aria-valuemin="0" aria-valuemax="${combatant.hitPoints.maximum}" aria-valuenow="${combatant.hitPoints.current}"><span>PG</span><strong>${combatant.hitPoints.current}</strong><small>de ${combatant.hitPoints.maximum}</small>${combatant.hitPoints.temporary ? `<b class="gm-combat-temp-hp">+${combatant.hitPoints.temporary} temp.</b>` : ""}</span>` : ""}
        <span class="gm-combat-initiative ${associated && combatant.initiative === null ? "needs-initiative" : ""}">
          <small>INI</small>
          ${associated ? `<button type="button" data-action="roll-initiative" ${pending ? "disabled" : ""} title="Tirar iniciativa de ${escapeHtml(combatant.name)}">${pending ? "…" : combatant.initiative ?? "Tirar"}</button>${pending ? '<small>Tirando…</small>' : combatant.initiative === null ? '<small>Falta INI</small>' : orderSummary}` : '<strong>—</strong>'}
        </span>
        <span class="gm-combat-expand" aria-hidden="true">${expanded ? "▴" : "▾"}</span>
      </summary>
      <div class="gm-combatant-popover gm-combat-details">
        <div class="gm-combat-detail-toolbar">
          ${associated ? `<div class="gm-combatant-control-row"><label>INI<input data-action="initiative" type="number" step="1" value="${combatant.initiative ?? ""}" placeholder="—"></label><button type="button" data-action="save-initiative">Guardar</button></div>` : ""}
          ${monster ? `<div class="gm-card-actions gm-combat-health-actions"><input data-action="hp-amount" type="number" min="1" step="1" value="1" aria-label="Cantidad de puntos de golpe"><button type="button" data-action="damage">Daño</button><button type="button" data-action="heal">Curar</button><button type="button" data-action="temporary-hit-points">PG temp.</button></div>` : ""}
          <details class="gm-combat-binding"><summary>Asociación</summary><div><strong>${escapeHtml(character?.name ?? monster?.name ?? "Sin asociación válida")}</strong><button type="button" data-open-association="monster">${associated ? "Cambiar criatura" : "Asociar criatura"}</button><button type="button" data-open-association="player">${associated ? "Cambiar personaje" : "Asociar personaje"}</button>${combatant.kind !== "custom" ? '<button type="button" data-action="clear-association">Quitar asociación</button>' : ""}${monster ? '<button type="button" data-action="edit-encounter-monster">Editar criatura</button>' : ""}</div></details>
        </div>
        ${this.associationPicker?.combatantId === combatant.id ? this.renderAssociationPicker(this.associationPicker.kind) : ""}
        ${character ? '<p class="gm-linked-character-notice">PG y condiciones desde la hoja del personaje.</p>' : monster ? `<div class="gm-combat-condition-toolbar"><div class="gm-condition-pills">${conditions.map((condition) => `<button type="button" data-action="remove-condition" data-condition-id="${condition.id}" title="Quitar condición">${escapeHtml(condition.label)} ×</button>`).join("")}</div><div class="gm-condition-control"><select data-action="condition-select" aria-label="Condición">${GM_CONDITIONS.filter(([key]) => !conditions.some((condition) => condition.key === key)).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select><button type="button" data-action="add-condition" ${GM_CONDITIONS.every(([key]) => conditions.some((condition) => condition.key === key)) ? "disabled" : ""}>Agregar estado</button></div></div>` : '<p class="gm-combat-missing-notice">Asociá una criatura o un personaje para consultar sus estadísticas y tirar iniciativa.</p>'}
        ${monster ? this.renderMonsterDetails(monster) : ""}
        ${character ? this.renderCharacterDetails(character) : ""}
      </div></details>`;
  }

  private renderAssociationPicker(kind: "monster" | "player"): string {
    const categories = kind === "monster"
      ? uniqueFacetValues(this.monsterCatalog().map((entry) => entry.type))
      : uniqueFacetValues(Object.values(this.snapshot?.campaign.characters ?? {}).map((entry) => entry.identity.className));
    return `<section class="gm-combat-association-picker" data-association-kind="${kind}">
      <div class="gm-association-search"><input type="search" data-association-search placeholder="${kind === "monster" ? "Buscar criatura…" : "Buscar personaje…"}" aria-label="Buscar combatiente"><select data-association-category aria-label="${kind === "monster" ? "Tipo de criatura" : "Clase de personaje"}"><option value="">${kind === "monster" ? "Todos los tipos" : "Todas las clases"}</option>${categories.map((entry) => `<option value="${escapeHtml(entry)}">${escapeHtml(entry)}</option>`).join("")}</select><button type="button" data-close-association aria-label="Cerrar búsqueda">×</button></div>
      <div class="gm-combat-association-results">${this.renderAssociationChoices(kind, "", "")}</div></section>`;
  }

  private renderAssociationChoices(kind: "monster" | "player", query: string, category: string): string {
    const normalized = normalizedSearch(query);
    const candidates = kind === "monster" ? this.monsterCatalog().map((monster) => ({
      id: monster.id, name: monster.name, category: monster.type,
      detail: `${monster.type} · VD ${monster.challenge || "—"} · CA ${monster.armorClass} · PG ${monster.hitPoints} · INI ${monster.initiativeModifier >= 0 ? "+" : ""}${monster.initiativeModifier}`,
      search: `${monster.name} ${monster.type} ${monster.size} ${monster.challenge} ${catalogMetadata(monster).tags.join(" ")}`,
    })) : Object.values(this.snapshot?.campaign.characters ?? {}).map((character) => ({
      id: character.id, name: character.name, category: character.identity.className,
      detail: `${character.identity.className || "Personaje"} · nivel ${character.identity.level} · PG ${character.combat.hitPoints.current}/${character.combat.hitPoints.maximum}`,
      search: `${character.name} ${character.identity.className} ${character.identity.level}`,
    }));
    const matches = candidates.filter((entry) => (!category || entry.category === category) && (!normalized || normalizedSearch(entry.search).includes(normalized)));
    return matches.length ? `${matches.slice(0, 40).map((entry) => `<button type="button" data-associate-id="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.detail)}</small></button>`).join("")}${matches.length > 40 ? '<p>Mostrando 40 resultados. Refiná la búsqueda para ver otros.</p>' : ""}` : '<p>No se encontraron combatientes.</p>';
  }

  private renderCharacterDetails(character: CharacterV2): string {
    const statistics = projectCharacterStatistics(character);
    const signed = (value: number): string => value >= 0 ? `+${value}` : String(value);
    const abilityLabels: Record<string, string> = { strength: "FUE", dexterity: "DES", constitution: "CON", intelligence: "INT", wisdom: "SAB", charisma: "CAR" };
    const abilities = Object.entries(statistics.abilityScores).map(([key, score]) => `<span><small>${abilityLabels[key] ?? key.slice(0, 3).toUpperCase()}</small><strong>${score}</strong><em>${signed(statistics.abilityModifiers[key as keyof typeof statistics.abilityModifiers])}</em><i>Salv. ${signed(statistics.savingThrows[key as keyof typeof statistics.savingThrows])}</i></span>`).join("");
    const conditions = character.combat.conditions.map((condition) => `<span>${escapeHtml(condition.label)}${condition.level ? ` ${condition.level}` : ""}</span>`).join("") || '<span class="muted">Sin condiciones</span>';
    const hitDice = `${character.combat.hitDice.remaining}/${character.combat.hitDice.maximum} d${character.combat.hitDice.dieSize}`;
    return `<section class="gm-participant-sheet gm-character-overview" style="${uiAccentStyle(character.color, currentUiThemeMode())}">
      <p class="gm-character-identity-details">${escapeHtml([character.identity.className || "Personaje", `Nivel ${character.identity.level}`, character.identity.species, character.identity.background].filter(Boolean).join(" · "))}</p>
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
    return `<details class="gm-monster-details" open><summary>${escapeHtml(monster.type || "Estadísticas")} · VD ${escapeHtml(monster.challenge || "—")} · ${escapeHtml(monster.speed.join(", "))}</summary>
      <div class="gm-monster-roll-toolbar"><label>Modo <select data-monster-roll-mode><option value="normal">Normal</option><option value="advantage">Ventaja</option><option value="disadvantage">Desventaja</option></select></label></div>
      <div class="gm-abilities gm-monster-rolls">${abilityButtons}</div>
      <div class="gm-monster-facts-grid">${this.monsterFact("Salvaciones", monster.saves)}${this.monsterFact("Habilidades", monster.skills)}
      ${this.monsterFact("Vulnerabilidades", monster.damageVulnerabilities)}${this.monsterFact("Resistencias", monster.damageResistances)}
      ${this.monsterFact("Inmunidades", monster.damageImmunities)}${this.monsterFact("Inmunidad a condiciones", monster.conditionImmunities)}
      ${this.monsterFact("Sentidos", monster.senses)}${this.monsterFact("Idiomas", monster.languages)}</div>
      <div class="gm-monster-sections-grid">${sections.filter(([, entries]) => entries.length).map(([title, entries]) => `<section><strong>${title}</strong>${entries.map((entry) => `<p><b>${escapeHtml(entry.name)}</b> ${escapeHtml(entry.content)} ${this.renderDiceButtons(entry.name, entry.content)}</p>`).join("")}</section>`).join("")}
      ${spells ? `<section><strong>Conjuros</strong>${spells}</section>` : ""}</div>
    </details>`;
  }

  private renderCustomMonsterManager(): string {
    if (!this.runtime.loadCustomMonsters) return "";
    const selected = this.selectedCustomMonsterKey ? this.customMonsters.find((monster) => monster.name === this.selectedCustomMonsterKey) ?? null : null;
    const editing = selected !== null && this.editingCustomMonsterKey === selected.name;
    if (editing || !selected && this.editingCustomMonsterKey === "__new__") {
      const draft = this.editingCustomMonsterKey === "__new__" ? this.monsterTemplate : selected;
      const draftKey = this.customMonsterDraftKey();
      return `<section class="gm-editor-surface"><div class="gm-edit-heading"><strong>${escapeHtml(draft?.name ?? "Nuevo monstruo")}</strong><small class="gm-draft-status" data-gm-draft-status ${draftKey && this.formDrafts.has(draftKey) ? "" : "hidden"}>Borrador sin guardar</small></div>${this.renderCustomMonsterForm(draft)}</section>`;
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
    const spellCatalog = this.customSpells;
    const spellNames = [...new Set(spellCatalog.map((entry) => entry.name))].sort((a, b) => a.localeCompare(b, "es"));
    const meta = catalogMetadata(monster);
    return `<form data-action="save-custom-monster" class="gm-custom-monster-form">
      <div class="gm-monster-editor-toolbar"><small>Los cambios se aplican al guardar.</small><button type="button" data-action="cancel-custom-monster">Cancelar</button><button type="submit">${monster ? "Guardar monstruo" : "Crear monstruo"}</button></div>
      <fieldset class="gm-monster-section"><legend>Identidad</legend><div class="gm-monster-section-body gm-monster-identity-fields">
        <label class="gm-monster-field-wide">Nombre<input name="name" required value="${escapeHtml(monster?.name ?? "")}"></label>
        <label>Tipo<select name="type">${fixedOptions(MONSTER_TYPES, monster?.type ?? "", "Sin tipo")}</select></label>
        <label>Tamaño<select name="size">${fixedOptions(MONSTER_SIZES, monster?.size ?? "", "Sin tamaño")}</select></label>
        <label>Alineamiento<select name="alignment">${fixedOptions(["Legal bueno", "Neutral bueno", "Caótico bueno", "Legal neutral", "Neutral", "Caótico neutral", "Legal malvado", "Neutral malvado", "Caótico malvado", "Sin alineamiento"], monster?.alignment ?? "", "Sin alineamiento")}</select></label>
        <label>Valor de desafío<select name="challenge">${fixedOptions(CHALLENGE_RATINGS, monster?.challenge ?? "0")}</select></label>
      </div></fieldset>
      <fieldset class="gm-monster-section"><legend>Combate</legend><div class="gm-monster-section-body">
        <div class="gm-monster-combat-fields"><label>CA<input name="armorClass" type="number" min="0" step="1" value="${monster?.armorClass ?? 10}"></label>
        <label>PG máximos<input name="hitPoints" type="number" min="0" step="1" value="${monster?.hitPoints ?? 10}"></label>
        <label>Dados de PG<input name="hitPointFormula" value="${escapeHtml(monster?.hitPointFormula ?? "")}" placeholder="2d8+2"></label></div>
        <div class="gm-monster-initiative-fields"><label>Modificador de iniciativa<input name="initiativeModifier" type="number" step="1" value="${monster?.initiativeModifier ?? 0}"></label>
        <label class="checkbox"><input name="initiativeAdvantage" type="checkbox" ${monster?.initiativeAdvantage ? "checked" : ""}> Ventaja en iniciativa</label></div>
        <label>Velocidad<input name="speed" value="${list(monster?.speed ?? [])}" placeholder="30 pies, volar 60 pies"></label>
      </div></fieldset>
      <fieldset class="gm-monster-section"><legend>Características</legend><div class="gm-monster-section-body gm-monster-abilities">${[["Str", "FUE"], ["Dex", "DES"], ["Con", "CON"], ["Int", "INT"], ["Wis", "SAB"], ["Cha", "CAR"]].map(([key, label]) => { const score = ability(key!); const modifier = Math.floor((score - 10) / 2); return `<label>${label}<input name="ability${key}" type="number" step="1" value="${score}" data-monster-ability><output data-ability-modifier>${modifier >= 0 ? "+" : ""}${modifier}</output></label>`; }).join("")}</div></fieldset>
      <details class="gm-monster-section" open><summary>Aptitudes y sentidos</summary><div class="gm-monster-section-body gm-monster-identity-fields">
        <label>Salvaciones<input name="saves" value="${list(monster?.saves ?? [])}" placeholder="FUE +6, CON +6"></label>
        <label>Habilidades<input name="skills" value="${list(monster?.skills ?? [])}" placeholder="Percepción +4"></label>
        <label class="gm-monster-field-wide">Sentidos<input name="senses" value="${list(monster?.senses ?? [])}" placeholder="Visión en la oscuridad 60 pies, Percepción pasiva 14"></label>
        <label class="gm-monster-field-wide">Idiomas<input name="languages" value="${list(monster?.languages ?? [])}" placeholder="Común, élfico"></label>
      </div></details>
      ${renderMonsterDefenses(monster, GM_CONDITIONS.slice(0, 14).map(([value, label]) => ({ value, label })))}
      ${renderMonsterFeatures(monster)}
      ${renderMonsterSpells(spellNames, monster?.spells ?? [])}
      <details class="gm-monster-section"><summary>Etiquetas de campaña<span class="catalog-origin ${escapeHtml(meta.origin)}">${escapeHtml(meta.origin)}</span></summary><div class="gm-monster-section-body"><label>Etiquetas separadas por comas<input name="catalogTags" value="${escapeHtml(visibleCatalogTags(meta.tags).join(", "))}" placeholder="oficial, jefe, no-muerto"></label></div></details>
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
    this.root.querySelector<HTMLButtonElement>('[data-report-issue]')?.addEventListener('click', () => {
      if (this.runtime.issueReporter) openIssueReportDialog(this.runtime.issueReporter, this.issueUiContext());
    });
    this.loreBrowser?.bind(this.root);
    bindViewportConstrainedDetails(this.root, ".gm-popover", ":scope > div");
    bindViewportConstrainedDetails(this.root, ".gm-filter-group", ":scope > div");
    this.root.querySelector<HTMLButtonElement>("[data-open-persistence]")?.addEventListener("click", openPersistencePanel);
    this.root.querySelector<HTMLButtonElement>("[data-open-image-diagnostics]")?.addEventListener("click", () => {
      this.closeImageDiagnostics?.();
      this.closeImageDiagnostics = openMiniatureImageDiagnostics(() => this.miniatureImageReport(), () => this.retryMiniatureImages());
    });
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
      const draftKey = this.customMonsterDraftKey();
      if (draftKey) this.formDrafts.clear(draftKey);
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
    const monsterDraftKey = this.customMonsterDraftKey();
    if (monsterDraftKey) this.formDrafts.bind(
      this.root.querySelector<HTMLFormElement>('[data-action="save-custom-monster"]'),
      monsterDraftKey,
      () => { const status = this.root.querySelector<HTMLElement>("[data-gm-draft-status]"); if (status) status.hidden = false; },
    );
    bindMonsterEditor(this.root.querySelector<HTMLFormElement>('[data-action="save-custom-monster"]'));
    this.root.querySelector('[data-action="refresh-combat"]')?.addEventListener("click", () => {
      this.retryMiniatureImages();
      void this.refreshNativeQueue();
      void this.runtime.refreshPlayers?.();
      void this.runtime.requestCharacterSummaries?.();
    });
    this.root.querySelector('[data-action="clear-initiatives"]')?.addEventListener("click", () => {
      this.pendingInitiativeRolls.clear();
      void this.apply({ kind: "clear-initiatives" });
    });
    this.root.querySelectorAll<HTMLElement>("[data-combatant-id]").forEach((card) => {
      const combatantId = card.dataset.combatantId!;
      card.querySelector<HTMLElement>(".gm-combatant-summary")?.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest("button, input, select")) return;
        event.preventDefault(); event.stopPropagation();
        this.expandedCombatantId = this.expandedCombatantId === combatantId ? null : combatantId;
        this.render();
      });
      card.querySelectorAll<HTMLButtonElement>("[data-open-association]").forEach((button) => button.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        this.expandedCombatantId = combatantId;
        this.associationPicker = { combatantId, kind: button.dataset.openAssociation === "player" ? "player" : "monster" };
        this.render();
        this.root.querySelector<HTMLInputElement>("[data-association-search]")?.focus();
      }));
      card.querySelector("[data-close-association]")?.addEventListener("click", () => { this.associationPicker = null; this.render(); });
      card.querySelector('[data-action="clear-association"]')?.addEventListener("click", () => {
        this.cancelCombatantRoll(combatantId);
        void this.execute(() => {
          const encounter = this.requireEncounter();
          return this.application.clearCombatantAssociation({ encounterId: encounter.id, combatantId,
            expectedEncounterRevision: encounter.revision, expectedCampaignChecksum: this.requireSnapshot().checksum });
        }, "Asociación eliminada.");
      });
      const picker = card.querySelector<HTMLElement>("[data-association-kind]");
      if (picker) {
        const kind = picker.dataset.associationKind === "player" ? "player" : "monster";
        const filter = (): void => {
          picker.querySelector(".gm-combat-association-results")!.innerHTML = this.renderAssociationChoices(kind,
            picker.querySelector<HTMLInputElement>("[data-association-search]")!.value,
            picker.querySelector<HTMLSelectElement>("[data-association-category]")!.value);
        };
        picker.querySelector("[data-association-search]")?.addEventListener("input", filter);
        picker.querySelector("[data-association-category]")?.addEventListener("change", filter);
        picker.addEventListener("click", (event) => {
          const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-associate-id]");
          if (button) void this.associateCombatant(combatantId, kind, button.dataset.associateId!);
        });
      }
      card.querySelector('[data-action="edit-encounter-monster"]')?.addEventListener("click", () => {
        const combatant = this.requireEncounter().combatants.find((entry) => entry.id === combatantId);
        const monster = combatant?.kind === "monster" ? this.findMonster(combatant.monsterDefinitionId) : null;
        if (monster) this.openMonsterEditor(monster);
      });
      card.querySelector('[data-action="activate-combatant"]')?.addEventListener("click", () => void this.apply({ kind: "set-active-combatant", combatantId }));
      card.querySelector('[data-action="save-initiative"]')?.addEventListener("click", () => {
        const input = card.querySelector<HTMLInputElement>('[data-action="initiative"]');
        if (input) { this.cancelCombatantRoll(combatantId); void this.apply({ kind: "set-initiative", combatantId, initiative: input.value === "" ? null : integer(input.value) }); }
      });
      card.querySelector('[data-action="remove-combatant"]')?.addEventListener("click", () => {
        const combatant = this.requireEncounter().combatants.find((entry) => entry.id === combatantId);
        if (combatant) { if (this.expandedCombatantId === combatantId) this.expandedCombatantId = null; void this.apply({ kind: "remove-combatant", combatantId }); }
      });
      card.querySelector('[data-action="roll-initiative"]')?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); void this.rollCombatantInitiative(combatantId); });
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
  }

  private async associateCombatant(combatantId: string, kind: "monster" | "player", definitionId: string): Promise<void> {
    this.cancelCombatantRoll(combatantId);
    await this.execute(() => {
      const encounter = this.requireEncounter();
      const base = { encounterId: encounter.id, combatantId,
        expectedEncounterRevision: encounter.revision, expectedCampaignChecksum: this.requireSnapshot().checksum };
      if (kind === "player") return this.application.associateCharacter({ ...base, characterId: definitionId });
      const monster = this.findMonster(definitionId);
      if (!monster) throw new Error("No se encontr? la criatura seleccionada.");
      return this.application.associateMonster({ ...base, monster: {
        definitionId: monster.id, name: monster.name, armorClass: monster.armorClass, hitPoints: monster.hitPoints,
      } });
    }, "Asociación guardada.");
    this.associationPicker = null;
    this.render();
  }

  private openMonsterEditor(monster: MonsterDefinition): void {
    this.activeSection = "content";
    this.activeContentKind = "monster";
    const custom = this.customMonsters.find((candidate) => candidate.id === monster.id || candidate.name === monster.name);
    if (custom) {
      this.selectedCustomMonsterKey = custom.name;
      this.editingCustomMonsterKey = custom.name;
      this.monsterTemplate = null;
    } else {
      this.selectedCustomMonsterKey = null;
      this.editingCustomMonsterKey = "__new__";
      this.monsterTemplate = structuredClone(monster);
    }
    this.render();
  }

  private apply(action: Parameters<EncounterApplication["apply"]>[0]["action"]): Promise<void> {
    return this.execute(async () => {
      const encounter = this.requireEncounter();
      return (await this.application.apply({ encounterId: encounter.id,
        expectedEncounterRevision: encounter.revision, expectedCampaignChecksum: this.requireSnapshot().checksum, action })).snapshot;
    }, this.describeEncounterAction(action));
  }

  private enqueueTaleSpireInitiativeSync(queue: TaleSpireNativeInitiativeQueue, success?: string): Promise<void> {
    const incoming = structuredClone(queue);
    if (JSON.stringify(incoming) === JSON.stringify(this.previousTaleSpireInitiativeQueue)) return Promise.resolve();
    return this.execute(async () => {
      if (JSON.stringify(incoming) === JSON.stringify(this.previousTaleSpireInitiativeQueue)) return this.requireSnapshot();
      const encounter = this.requireEncounter();
      const snapshot = await this.application.synchronizeTaleSpireInitiative({
        encounterId: encounter.id, expectedEncounterRevision: encounter.revision,
        expectedCampaignChecksum: this.requireSnapshot().checksum,
        queue: { ...incoming, roundDelta: calculateTaleSpireRoundDelta(this.previousTaleSpireInitiativeQueue, incoming), retainUnlisted: false },
      });
      this.previousTaleSpireInitiativeQueue = incoming;
      // Membership/order changes are controlled by TS and are never undone by a stat edit.
      this.undoStack = [];
      this.redoStack = [];
      return snapshot;
    }, success, false);
  }

  private execute(operation: () => Promise<CampaignSnapshot>, success?: string, record = true): Promise<void> {
    const pending = this.operations.then(async () => {
      const before = this.snapshot ? this.captureHistoryState(this.snapshot) : null;
      try {
        const snapshot = await operation();
        const changed = snapshot.checksum !== this.snapshot?.checksum;
        if (!changed && !success) return;
        if (record && changed && before) this.recordReversibleAction(success ?? "Actualizar combate", before, this.captureHistoryState(snapshot));
        this.snapshot = snapshot;
        this.message = success ? { kind: "success", text: success } : null;
        this.selectAvailableEncounter();
        const active = this.selectedEncounterId ? snapshot.campaign.encounters[this.selectedEncounterId] : null;
        if (changed && active) {
          try { await this.runtime.publishEncounter?.(active); }
          catch (error) { this.message = { kind: "error", text: `No se pudo compartir el combate: ${this.formatError(error)}` }; }
        }
      } catch (error) {
        this.message = { kind: "error", text: this.formatError(error) };
        try { this.snapshot = await this.application.loadCampaign(); }
        catch { /* Keep the last usable combat view while campaign storage is unavailable. */ }
      }
      this.selectAvailableEncounter();
      this.render();
    });
    this.operations = pending.catch(() => undefined);
    return pending;
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
      "clear-initiatives": "Limpiar iniciativas", "set-combatant-association": "Cambiar asociación",
      "set-initiative": "Actualizar iniciativa", "remove-combatant": "Quitar combatiente", damage: "Aplicar daño", heal: "Curar combatiente",
      "grant-temporary-hit-points": "Agregar PG temporales", "set-visibility": "Cambiar visibilidad", "add-condition": "Agregar condición", "remove-condition": "Quitar condición",
      "set-talespire-creature": "Cambiar miniatura de TaleSpire",
      "set-monster-association": "Cambiar monstruo asociado",
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
    const featureData = (key: string) => readMonsterFeatures(String(data.get(key) ?? "[]"));
    const list = (key: string): string[] => data.getAll(key).flatMap((value) => String(value).split(/[,\r\n]+/)).map((entry) => entry.trim()).filter(Boolean);
    const previousKey = this.editingCustomMonsterKey === "__new__" ? null : this.editingCustomMonsterKey ?? this.selectedCustomMonsterKey ?? duplicate?.name ?? null;
    const existing = previousKey ? this.customMonsters.find((monster) => monster.name === previousKey) ?? null : null;
    const sourceDefinitionId = existing?.id ?? this.monsterTemplate?.id ?? null;
    try {
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
      await this.runtime.saveCustomMonster(definition, previousKey);
      const draftKey = this.customMonsterDraftKey();
      if (draftKey) this.formDrafts.clear(draftKey);
      this.customMonsters = [...this.customMonsters.filter((monster) =>
        monster.name !== previousKey && monster.name.toLocaleLowerCase() !== definition.name.toLocaleLowerCase()), definition];
      if (this.snapshot && sourceDefinitionId) {
        this.snapshot = await this.application.refreshMonsterDefinition(sourceDefinitionId, {
          definitionId: definition.id,
          name: definition.name,
          armorClass: definition.armorClass,
          hitPoints: definition.hitPoints,
        }, this.snapshot.checksum);
      }
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

  private customMonsterDraftKey(): string | null {
    return this.editingCustomMonsterKey ? `monster:${this.editingCustomMonsterKey}` : null;
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
    await this.execute(async () => {
      const encounter = this.requireEncounter();
      const combatant = encounter.combatants.find((entry) => entry.kind === "player" && entry.characterId === received.summary.characterId);
      if (!combatant) return this.requireSnapshot();
      return this.application.updateConnectedPlayer({ encounterId: encounter.id, combatantId: combatant.id,
        summary: received.summary, taleSpireClientId: received.clientId,
        expectedEncounterRevision: encounter.revision, expectedCampaignChecksum: this.requireSnapshot().checksum });
    }, undefined, false);
  }

  private async applyReceivedInitiative(clientId: string, initiative: number, characterId: string | null): Promise<void> {
    await this.execute(async () => {
      const encounter = this.requireEncounter();
      const combatant = findPlayerInitiativeCombatant(encounter, clientId, characterId, this.playerSummaries.get(clientId)?.characterId ?? null);
      if (!combatant) return this.requireSnapshot();
      this.cancelCombatantRoll(combatant.id);
      return (await this.application.apply({ encounterId: encounter.id, expectedEncounterRevision: encounter.revision,
        expectedCampaignChecksum: this.requireSnapshot().checksum,
        action: { kind: "set-initiative", combatantId: combatant.id, initiative } })).snapshot;
    }, undefined, false);
  }

  private cancelCombatantRoll(combatantId: string): void {
    for (const [key, ids] of this.pendingInitiativeRolls) {
      if (ids.includes(combatantId)) this.pendingInitiativeRolls.delete(key);
    }
  }

  private async handleResolvedDiceResult(result: { name: string; total: number; correlationId?: string }): Promise<void> {
    this.appendActionLog(`${result.name}: resultado ${result.total}`, "roll");
    const key = result.correlationId ?? result.name;
    const pending = this.pendingInitiativeRolls.get(key);
    const combatantId = pending?.shift();
    if (pending && pending.length === 0) this.pendingInitiativeRolls.delete(key);
    const encounter = this.selectedEncounterId ? this.snapshot?.campaign.encounters[this.selectedEncounterId] : null;
    if (combatantId && encounter?.combatants.some((combatant) => combatant.id === combatantId)) {
      await this.apply({ kind: "set-initiative", combatantId, initiative: result.total });
      return;
    }
    this.render();
  }

  private async rollCombatantInitiative(combatantId: string): Promise<void> {
    if ([...this.pendingInitiativeRolls.values()].some((ids) => ids.includes(combatantId))) return;
    const combatant = this.requireEncounter().combatants.find((entry) => entry.id === combatantId);
    if (!combatant) return;
    const monster = combatant.kind === "monster" ? this.findMonster(combatant.monsterDefinitionId) : null;
    const character = combatant.kind === "player" && combatant.characterId
      ? this.requireSnapshot().campaign.characters[combatant.characterId] ?? null : null;
    if (!monster && !character) return;
    const modifier = monster?.initiativeModifier ?? projectCharacterStatistics(character!).initiativeModifier;
    // Route results by request ID, including when two minis have the same name.
    const correlationId = globalThis.crypto.randomUUID();
    this.pendingInitiativeRolls.set(correlationId, [combatantId]);
    this.render();
    try {
      const result = await this.runtime.diceRoller.roll({
        name: `Iniciativa: ${combatant.name}`, correlationId,
        expressions: [`1d20${modifier >= 0 ? "+" : ""}${modifier}`],
        mode: character ? projectAdjustedRollMode(character, "skills", ["Initiative"], character.checks.initiative.rollMode)
          : monster?.initiativeAdvantage ? "advantage" : "normal",
      });
      this.appendActionLog(`Iniciativa de ${combatant.name}: ${result.summary}`, "roll");
      const initiative = result.totals[0];
      if (initiative !== undefined && this.pendingInitiativeRolls.delete(correlationId)) {
        await this.apply({ kind: "set-initiative", combatantId, initiative });
      } else if (result.kind === "submitted") {
        this.message = { kind: "success", text: "Tirada enviada a TaleSpire; la iniciativa se cargará al resolverse." };
        this.render();
      }
    } catch (error) {
      this.pendingInitiativeRolls.delete(correlationId);
      this.message = { kind: "error", text: this.formatError(error) };
      this.render();
    }
  }

  private async addCondition(combatantId: string, card: HTMLElement): Promise<void> {
    const select = card.querySelector<HTMLSelectElement>('[data-action="condition-select"]');
    const definition = GM_CONDITIONS.find(([key]) => key === select?.value);
    if (!definition) return;
    await this.execute(() => {
      const encounter = this.requireEncounter();
      return this.application.addCondition({ encounterId: encounter.id, combatantId,
        key: definition[0], label: definition[1], expectedEncounterRevision: encounter.revision,
        expectedCampaignChecksum: this.requireSnapshot().checksum });
    }, `Agregar condición: ${definition[1]}`);
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
