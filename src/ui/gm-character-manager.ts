import type { CampaignSnapshot } from "../application/ports/campaign-repository";
import type { CharacterOrganizationAction, CharacterOrganizationCommand } from "../application/gm/character-organization";
import type { CharacterV2 } from "../domain/character/character-v2";
import type { GmCharacterGroup } from "../domain/gm/gm-workspace";
import { createRandomId } from "../shared/id";
import { confirmAction } from "./confirm-action";

export interface GmCharacterManagerRuntime {
  manageCharacter?: (command: { characterId: string; expectedCharacterRevision: number; expectedCampaignId: string; action: "archive" | "restore" | "delete" | "rename" | "unlink"; name?: string }) => Promise<unknown>;
  organizeCharacters?: (command: CharacterOrganizationCommand) => Promise<CampaignSnapshot>;
  openCharacter?: (id: string) => Promise<void>;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
export const compareManagedCharacters = (a: CharacterV2, b: CharacterV2) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, "es", { sensitivity: "base" });

export class GmCharacterManager {
  private snapshot: CampaignSnapshot | null = null;
  private search = "";
  private filter = "all";
  private newGroupName = "";
  private readonly names = new Map<string, string>();
  private readonly groupNames = new Map<string, string>();
  private readonly openedCharacters = new Set<string>();
  private readonly closedGroups = new Set<string>();
  private busy = false;

  constructor(private readonly root: HTMLElement, private readonly runtime: GmCharacterManagerRuntime,
    private readonly reload: () => Promise<CampaignSnapshot | null>,
    private readonly accept: (snapshot: CampaignSnapshot | null) => void,
    private readonly message: (message: { kind: "success" | "error"; text: string }) => void,
    private readonly rerender: () => void) {}

  private capture(): void {
    this.root.querySelectorAll<HTMLDetailsElement>("details[data-managed-character]").forEach(row => {
      if (row.open) this.openedCharacters.add(row.dataset.managedCharacter!); else this.openedCharacters.delete(row.dataset.managedCharacter!);
    });
    if (!this.search) this.root.querySelectorAll<HTMLDetailsElement>("details[data-character-group]").forEach(group => {
      if (group.open) this.closedGroups.delete(group.dataset.characterGroup!); else this.closedGroups.add(group.dataset.characterGroup!);
    });
  }

  render(snapshot: CampaignSnapshot | null): string {
    this.capture();
    if (snapshot?.campaign.id !== this.snapshot?.campaign.id) {
      this.openedCharacters.clear(); this.closedGroups.clear(); this.names.clear(); this.groupNames.clear(); this.search = ""; this.filter = "all";
      this.newGroupName = "";
    }
    this.snapshot = snapshot;
    const characters = Object.values(snapshot?.campaign.characters ?? {}).sort(compareManagedCharacters);
    const groups = [...(snapshot?.campaign.gm.characterGroups ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es"));
    const grouped = new Set(groups.flatMap(g => g.characterIds));
    const ungrouped = characters.filter(c => !grouped.has(c.id));
    return `<section class="gm-character-manager"><header><h2>Personajes</h2><p>Ocultar una hoja la quita del selector de jugadores sin eliminarla. Los grupos permiten cambiar la visibilidad de varias hojas juntas.</p></header>
      <div class="gm-character-filters"><label>Buscar<input type="search" data-character-search value="${escape(this.search)}" placeholder="Nombre, jugador o clase"></label><label>Estado<select data-character-filter><option value="all" ${this.filter === "all" ? "selected" : ""}>Todos</option><option value="active" ${this.filter === "active" ? "selected" : ""}>Visibles</option><option value="archived" ${this.filter === "archived" ? "selected" : ""}>Ocultos</option></select></label></div>
      <form class="gm-character-new-group" data-character-new-group><label>Nuevo grupo<input name="groupName" maxlength="100" required value="${escape(this.newGroupName)}" placeholder="Nombre del grupo"></label><button type="submit" ${!this.runtime.organizeCharacters || this.busy ? "disabled" : ""}>Crear grupo</button></form>
      ${groups.map(group => this.renderGroup(group, characters.filter(c => group.characterIds.includes(c.id)), groups)).join("")}
      <section class="gm-character-ungrouped">${groups.length ? '<h3>Sin grupo</h3>' : ""}<div class="gm-character-list">${ungrouped.map(c => this.renderCard(c, groups)).join("") || '<p class="gm-character-empty">No hay hojas sin grupo.</p>'}</div></section>
      ${characters.length ? '<p data-character-no-matches hidden>No hay personajes que coincidan con los filtros.</p>' : '<p>No hay personajes.</p>'}</section>`;
  }

  private renderCard(c: CharacterV2, groups: GmCharacterGroup[]): string {
    const groupId = groups.find(g => g.characterIds.includes(c.id))?.id ?? "";
    const disabled = !this.runtime.manageCharacter || this.busy ? "disabled" : "";
    return `<details class="gm-character-row" data-managed-character="${c.id}" data-character-archived="${c.archived}" data-character-text="${escape(normalized([c.name, c.identity.playerName, c.identity.className].join(" ")))}" ${this.openedCharacters.has(c.id) ? "open" : ""}>
      <summary class="gm-managed-character-summary"><strong>${escape(c.name)}</strong><button type="button" data-character-action="open" ${!this.runtime.openCharacter || this.busy ? "disabled" : ""}>Abrir</button></summary>
      <div class="gm-managed-character-body"><div class="gm-character-identity"><small>${escape(c.identity.className || "Sin clase")} · Nivel ${c.identity.level} · ${escape(c.identity.playerName || "Sin jugador indicado")}</small><span class="gm-character-availability">${c.archived ? "Oculto" : "Visible"}</span><span class="gm-character-origin">${c.builder?.creationOperationId ? "Creado con tutorial" : "Sin registro de tutorial"}</span></div>
      <div class="gm-character-actions"><button type="button" data-character-action="export">Exportar</button><button type="button" data-character-action="${c.archived ? "restore" : "archive"}" ${disabled}>${c.archived ? "Mostrar" : "Ocultar"}</button><button type="button" class="danger secondary-button" data-character-action="delete" ${disabled}>Eliminar</button></div>
      <form class="gm-character-rename" data-character-rename><label>Nombre<input data-character-name required value="${escape(this.names.get(c.id) ?? c.name)}"></label><button type="submit" ${disabled}>Guardar nombre</button></form>
      <label class="gm-character-group-picker">Grupo<select data-character-move ${!this.runtime.organizeCharacters || this.busy ? "disabled" : ""}><option value="" ${!groupId ? "selected" : ""}>Sin grupo</option>${groups.map(g => `<option value="${g.id}" ${groupId === g.id ? "selected" : ""}>${escape(g.name)}</option>`).join("")}</select></label></div></details>`;
  }

  private renderGroup(group: GmCharacterGroup, characters: CharacterV2[], groups: GmCharacterGroup[]): string {
    const hidden = characters.filter(c => c.archived).length;
    const disabled = !this.runtime.organizeCharacters || this.busy ? "disabled" : "";
    return `<details class="gm-character-group" data-character-group="${group.id}" ${this.search || !this.closedGroups.has(group.id) ? "open" : ""}><summary><strong>${escape(group.name)}</strong><small>${characters.length} hojas · ${characters.length - hidden} visibles · ${hidden} ocultas</small></summary>
      <div class="gm-character-group-body"><div class="gm-character-group-actions"><button type="button" data-group-action="show" ${disabled || (hidden === 0 ? "disabled" : "")}>Mostrar todos</button><button type="button" data-group-action="hide" ${disabled || (hidden === characters.length ? "disabled" : "")}>Ocultar todos</button></div>
      <details class="gm-character-group-settings"><summary>Editar grupo</summary><form data-group-rename><label>Nombre<input required maxlength="100" data-group-name value="${escape(this.groupNames.get(group.id) ?? group.name)}"></label><button type="submit" ${disabled}>Guardar</button></form><button type="button" class="secondary-button" data-group-action="remove" ${disabled}>Disolver grupo</button></details>
      <div class="gm-character-list">${characters.map(c => this.renderCard(c, groups)).join("") || '<p class="gm-character-empty">Agregá hojas usando el selector Grupo de cada tarjeta.</p>'}</div></div></details>`;
  }

  bind(): void {
    if (!this.root.querySelector(".gm-character-manager")) return;
    const applyFilters = () => {
      let matches = 0;
      this.root.querySelectorAll<HTMLElement>("[data-managed-character]").forEach(row => {
        row.hidden = !row.dataset.characterText?.includes(normalized(this.search)) || this.filter !== "all" && (row.dataset.characterArchived === "true") !== (this.filter === "archived");
        if (!row.hidden) matches++;
      });
      this.root.querySelectorAll<HTMLDetailsElement>("[data-character-group]").forEach(group => {
        const rows = [...group.querySelectorAll<HTMLElement>("[data-managed-character]")];
        group.hidden = rows.length > 0 && rows.every(row => row.hidden);
        if (this.search && !group.hidden) group.open = true;
      });
      const empty = this.root.querySelector<HTMLElement>("[data-character-no-matches]"); if (empty) empty.hidden = matches > 0;
    };
    applyFilters();
    this.root.querySelectorAll<HTMLDetailsElement>("details[data-managed-character]").forEach(row => row.addEventListener("toggle", () => {
      if (!row.isConnected) return;
      if (row.open) this.openedCharacters.add(row.dataset.managedCharacter!); else this.openedCharacters.delete(row.dataset.managedCharacter!);
    }));
    this.root.querySelectorAll<HTMLDetailsElement>("details[data-character-group]").forEach(group => group.addEventListener("toggle", () => {
      if (!group.isConnected || this.search) return;
      if (group.open) this.closedGroups.delete(group.dataset.characterGroup!); else this.closedGroups.add(group.dataset.characterGroup!);
    }));
    this.root.querySelector<HTMLInputElement>("[data-character-search]")?.addEventListener("input", e => { this.search = (e.currentTarget as HTMLInputElement).value; applyFilters(); });
    this.root.querySelector<HTMLSelectElement>("[data-character-filter]")?.addEventListener("change", e => { this.filter = (e.currentTarget as HTMLSelectElement).value; applyFilters(); });
    this.root.querySelector<HTMLInputElement>('[data-character-new-group] input')?.addEventListener("input", e => { this.newGroupName = (e.currentTarget as HTMLInputElement).value; });
    this.root.querySelector<HTMLFormElement>("[data-character-new-group]")?.addEventListener("submit", e => {
      e.preventDefault(); void this.run(async () => { await this.organize({ kind: "create-group", groupId: await createRandomId("cgr"), name: this.newGroupName.trim() }); this.newGroupName = ""; }, "Grupo creado.");
    });
    this.root.querySelectorAll<HTMLInputElement>("[data-character-name]").forEach(input => input.addEventListener("input", () => this.names.set(input.closest<HTMLElement>("[data-managed-character]")!.dataset.managedCharacter!, input.value)));
    this.root.querySelectorAll<HTMLButtonElement>("[data-character-action]").forEach(button => button.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      const id = button.closest<HTMLElement>("[data-managed-character]")!.dataset.managedCharacter!;
      void this.characterAction(id, button.dataset.characterAction!);
    }));
    this.root.querySelectorAll<HTMLFormElement>("[data-character-rename]").forEach(form => form.addEventListener("submit", e => { e.preventDefault(); void this.characterAction(form.closest<HTMLElement>("[data-managed-character]")!.dataset.managedCharacter!, "rename"); }));
    this.root.querySelectorAll<HTMLSelectElement>("[data-character-move]").forEach(select => select.addEventListener("change", () => {
      const characterId = select.closest<HTMLElement>("[data-managed-character]")!.dataset.managedCharacter!;
      const previous = this.snapshot?.campaign.gm.characterGroups?.find(g => g.characterIds.includes(characterId));
      const target = select.value || null;
      void this.run(() => this.organize({ kind: "move-character", characterId, groupId: target, expectedGroupId: previous?.id ?? null }), "Hoja movida.");
    }));
    this.root.querySelectorAll<HTMLInputElement>("[data-group-name]").forEach(input => input.addEventListener("input", () => this.groupNames.set(input.closest<HTMLElement>("[data-character-group]")!.dataset.characterGroup!, input.value)));
    this.root.querySelectorAll<HTMLFormElement>("[data-group-rename]").forEach(form => form.addEventListener("submit", e => {
      e.preventDefault(); const group = this.groupFor(form); if (!group) return;
      void this.run(async () => { await this.organize({ kind: "rename-group", groupId: group.id, expectedRevision: group.revision, name: this.groupNames.get(group.id) ?? group.name }); this.groupNames.delete(group.id); }, "Grupo actualizado.");
    }));
    this.root.querySelectorAll<HTMLButtonElement>("[data-group-action]").forEach(button => button.addEventListener("click", () => {
      const group = this.groupFor(button); if (!group) return;
      const kind = button.dataset.groupAction!;
      void this.run(async () => {
        if (kind === "remove") {
          if (!await confirmAction(`Disolver ${group.name}`, "Las hojas se conservarán y pasarán a Sin grupo.")) return false;
          await this.organize({ kind: "remove-group", groupId: group.id, expectedRevision: group.revision });
        } else await this.organize({ kind: "set-group-hidden", groupId: group.id, expectedRevision: group.revision, hidden: kind === "hide" });
      }, "Grupo actualizado.");
    }));
  }

  private groupFor(element: HTMLElement): GmCharacterGroup | undefined {
    return this.snapshot?.campaign.gm.characterGroups?.find(g => g.id === element.closest<HTMLElement>("[data-character-group]")?.dataset.characterGroup);
  }
  private async organize(action: CharacterOrganizationAction): Promise<void> {
    if (!this.runtime.organizeCharacters || !this.snapshot) throw new Error("No se puede editar la organización desde este entorno.");
    this.accept(await this.runtime.organizeCharacters({ expectedCampaignId: this.snapshot.campaign.id, action }));
  }
  private async characterAction(id: string, action: string): Promise<void> {
    const character = this.snapshot?.campaign.characters[id]; if (!character || this.busy) return;
    if (action === "export") {
      const url = URL.createObjectURL(new Blob([JSON.stringify(character, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `${character.name.replace(/[^\p{L}\p{N}_-]/gu, "_")}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
    }
    await this.run(async () => {
      if (action === "open") { await this.runtime.openCharacter?.(id); return; }
      if (!this.runtime.manageCharacter || !this.snapshot) throw new Error("No se puede administrar la hoja desde este entorno.");
      if (action === "delete" && !await confirmAction(`Eliminar a ${character.name}`, "Se eliminará su hoja y se quitarán sus asociaciones. Esta acción no se puede deshacer.")) return false;
      await this.runtime.manageCharacter({ characterId: id, expectedCharacterRevision: character.revision, expectedCampaignId: this.snapshot.campaign.id, action: action as "archive" | "restore" | "delete" | "rename", ...(action === "rename" ? { name: this.names.get(id) ?? character.name } : {}) });
      this.names.delete(id);
    }, action === "open" ? "Hoja cerrada." : "Personaje actualizado.");
  }
  private async run(operation: () => Promise<void | false>, success: string): Promise<void> {
    if (this.busy) return;
    this.capture(); this.busy = true; this.rerender();
    try { if (await operation() === false) return; this.accept(await this.reload()); this.message({ kind: "success", text: success }); }
    catch (error) {
      this.message({ kind: "error", text: error instanceof Error ? error.message : String(error) });
      try { this.accept(await this.reload()); } catch { /* Keep the current view and draft if refresh is unavailable. */ }
    } finally { this.busy = false; this.rerender(); }
  }
}
