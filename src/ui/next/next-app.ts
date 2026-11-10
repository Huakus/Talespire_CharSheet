import type { CampaignSnapshot } from "../../application/ports/campaign-repository";
import type { CharacterV2 } from "../../domain/character/character-v2";
import { itemIsIdentified, unidentifiedItemView } from "../../domain/equipment/equipment-identification";
import { uiAccentStyle } from "../design-system/theme";
import { spellPersonalInfo } from "../spell-casting-filters";
import { browserSymbiotePreferences, type SymbiotePreferences } from "../symbiote-preferences";
import { characterIdentityHeader, characterSheetContent, updateNextSheetLayout } from "./next-sheet";
import { NextTooltips } from "./next-tooltips";
import type { CampaignApplication, CharacterResourceAction } from "../../application/campaign/campaign-application";
import type { DiceRoller } from "../../application/ports/dice-roller";
import { projectCharacterStatistics, projectAdjustedRollMode, projectAbilityCheckModifier } from "../../domain/character/character-projection";
import { SAVE_DEFINITIONS, SKILL_DEFINITIONS, type SaveKey, type SkillKey } from "../../domain/character/character-checks";
import { combineRollModes, toggleManualRollMode, toggleManualRollModeLock, consumeManualRollMode, experienceProgress, applyCheckConditionDice, type ManualRollModeState } from "../character-play-controls";
import type { SheetInteraction } from "./next-sheet-controls";

export interface NextAppOptions {
  role: "player" | "gm";
  loadCampaign: () => Promise<CampaignSnapshot | null>;
  subscribeChanges?: (listener: (snapshot?: CampaignSnapshot) => void) => () => void;
  storageEventKey?: string;
  connectCharacterQueries?: (read: () => CharacterV2 | null, reportError: () => void) => () => void;
  preferences?: SymbiotePreferences;
  play?: { application: Pick<CampaignApplication,"applyCharacterResource"|"editCharacter"|"advanceGuidedCharacter">; diceRoller: DiceRoller };
}

function escape(value: string | number): string {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

/** Commands are opt-in; readers without a play adapter remain read-only. */
export class NextApp {
  private snapshot: CampaignSnapshot | null = null;
  private selectedCharacterId: string | null = null;
  private selectedEncounterId: string | null = null;
  private section: string;
  private stopped = false;
  private started = false;
  private stopChanges: (() => void) | null = null;
  private stopCharacterQueries: (() => void) | null = null;
  private loadSequence = 0;
  private message = "";
  private busy = false;
  private readonly armed = new Set<string>();
  private readonly manualModes = new Map<string, ManualRollModeState>();
  private readonly handleSubmit = (event: Event) => {
    const form=(event.target as Element).closest<HTMLFormElement>('form[data-next-form]');
    if(!form||!this.root.contains(form))return;
    event.preventDefault();
    const values=new FormData(form);
    void this.playAction(form.dataset.nextForm!,Number(values.get('amount')),String(values.get('color')??''));
  };
  private readonly handleKeydown = (event: KeyboardEvent):void => {
    if(event.key!=='Escape')return;
    const details=this.root.querySelector<HTMLDetailsElement>('.ns-level-details[open], .ns-person-menu[open]');
    if(details&&details.contains(event.target as Node)){details.open=false;details.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});this.tooltips?.hide();}
  };
  private readonly expandedConditions = new Set<string>();
  private tooltips: NextTooltips | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly relayout = () => updateNextSheetLayout(this.root);
  private readonly preferences: SymbiotePreferences;
  private readonly handleStorage = (event: StorageEvent): void => {
    if (event.key === this.options.storageEventKey) this.refresh();
  };
  private readonly handleClick = (event: Event): void => {
    for(const details of this.root.querySelectorAll<HTMLDetailsElement>('.ns-level-details[open], .ns-person-menu[open]'))if(!details.contains(event.target as Node))details.open=false;
    const play=(event.target as Element).closest<HTMLButtonElement>('button[data-next-play]');
    if(play&&this.root.contains(play)){if(!play.disabled)void this.playAction(play.dataset.nextPlay!);return;}
    const toggle = (event.target as Element).closest<HTMLButtonElement>("button[data-next-conditions]");
    if (toggle && this.root.contains(toggle) && toggle.dataset.nextConditions === this.selectedCharacterId) {
      const id = toggle.dataset.nextConditions!;
      if (this.expandedConditions.has(id)) this.expandedConditions.delete(id); else this.expandedConditions.add(id);
      this.render();
      this.root.querySelector<HTMLButtonElement>("[data-next-conditions]")?.focus({ preventScroll: true });
      return;
    }
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-next-section]");
    if (!button || !this.root.contains(button) || !this.sections().some(([id]) => id === button.dataset.nextSection)) return;
    this.section = button.dataset.nextSection!;
    this.render();
    this.root.querySelector<HTMLButtonElement>(`[data-next-section="${this.section}"]`)?.focus();
  };
  private readonly handleChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    if (select.hasAttribute("data-next-encounter")) {
      if (this.options.role !== "gm" || !this.snapshot?.campaign.encounters[select.value]) return;
      this.selectedEncounterId = select.value;
      this.render();
      this.root.querySelector<HTMLSelectElement>("[data-next-encounter]")?.focus();
      return;
    }
    if (select.id !== "character-title-select" || !this.characters().some(character => character.id === select.value)) return;
    this.selectedCharacterId = select.value;
    if (this.snapshot) this.preferences.rememberCharacter(this.snapshot.campaign.id, select.value);
    this.render();
    this.root.querySelector<HTMLSelectElement>("#character-title-select")?.focus();
  };

  constructor(private readonly root: HTMLElement, private readonly options: NextAppOptions) {
    this.section = options.role === "gm" ? "combat" : "sheet";
    this.preferences = options.preferences ?? browserSymbiotePreferences();
  }

  async start(): Promise<void> {
    if (this.started || this.stopped) return;
    this.started = true;
    this.tooltips = new NextTooltips(this.root);
    if (typeof ResizeObserver !== "undefined") { this.resizeObserver = new ResizeObserver(this.relayout); this.resizeObserver.observe(this.root); }
    this.root.ownerDocument.defaultView?.addEventListener("resize", this.relayout);
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("change", this.handleChange);
    this.root.addEventListener("submit", this.handleSubmit);
    this.root.addEventListener("keydown", this.handleKeydown);
    if (this.options.storageEventKey !== undefined) this.root.ownerDocument.defaultView?.addEventListener("storage", this.handleStorage);
    try {
      this.stopCharacterQueries = this.options.connectCharacterQueries?.(() => this.characters().find(character => character.id === this.selectedCharacterId) ?? null,
        () => { if (!this.stopped) { this.message = "No se pudo responder a la consulta de estadísticas del GM."; this.render(); } }) ?? null;
      this.stopChanges = this.options.subscribeChanges?.(snapshot => {
        if (this.stopped) return;
        if (snapshot) { ++this.loadSequence; this.accept(snapshot); }
        else this.refresh();
      }) ?? null;
      await this.reload();
    }
    catch (error) { this.stop(); throw error; }
  }

  private refresh(): void {
    void this.reload().catch(() => {
      if (this.stopped) return;
      this.message = "No se pudo actualizar la consulta. Se conservan los últimos datos cargados.";
      this.render();
    });
  }

  stop(): void {
    this.stopped = true;
    ++this.loadSequence;
    this.stopChanges?.();
    this.stopChanges = null;
    this.stopCharacterQueries?.();
    this.stopCharacterQueries = null;
    this.root.ownerDocument.defaultView?.removeEventListener("storage", this.handleStorage);
    this.root.removeEventListener("click", this.handleClick);
    this.root.removeEventListener("change", this.handleChange);
    this.root.removeEventListener("submit", this.handleSubmit);
    this.root.removeEventListener("keydown", this.handleKeydown);
    this.resizeObserver?.disconnect(); this.resizeObserver = null;
    this.root.ownerDocument.defaultView?.removeEventListener("resize", this.relayout);
    this.tooltips?.stop(); this.tooltips = null;
  }

  async savePendingChanges(): Promise<boolean> { return !this.busy; }

  private interaction(): SheetInteraction { return { enabled:!!this.options.play, busy:this.busy, armed:this.armed.has(this.selectedCharacterId??''), manual:this.manualModes.get(this.selectedCharacterId??'')??null }; }
  private focusPlay(action:string):void { [...this.root.querySelectorAll<HTMLButtonElement>('[data-next-play]')].find(button=>button.dataset.nextPlay===action&&!button.disabled)?.focus({preventScroll:true}); }

  private async playAction(action:string,amount?:number,color?:string):Promise<void> {
    const adapter=this.options.play,base=this.snapshot,id=this.selectedCharacterId,c=id?base?.campaign.characters[id]:null;
    if(!adapter||!base||!id||!c||this.busy||this.stopped)return;
    if(c.combat.hitPoints.current<=0&&!['heal','death:success','death:failure','death:reset'].includes(action)){this.message='Con 0 PG solo se permiten salvaciones de muerte y curación.';this.render();return;}
    const [kind,key]=action.split(':');
    if(kind==='mode'||kind==='lock') {
      if(key!=='advantage'&&key!=='disadvantage')return;
      const current=this.manualModes.get(id)??null,next=kind==='mode'?toggleManualRollMode(current,key):toggleManualRollModeLock(current,key);
      if(next)this.manualModes.set(id,next);else this.manualModes.delete(id);
      this.render();this.focusPlay(action);return;
    }
    if(action==='inspiration'&&c.combat.inspiration&&!this.armed.has(id)){this.armed.add(id);this.render();this.focusPlay(action);return;}
    this.busy=true;this.message='';this.render();
    const adopt=(snapshot:CampaignSnapshot)=>{if(!this.stopped&&this.snapshot?.campaign.id===base.campaign.id){++this.loadSequence;if(this.snapshot.campaign.revision<=snapshot.campaign.revision)this.accept(snapshot);}};
    const resource=async(value:CharacterResourceAction)=>{const result=await adapter.application.applyCharacterResource({characterId:id,expectedCharacterRevision:c.revision,expectedCampaignChecksum:base.checksum,action:value});adopt(result.snapshot);};
    try {
      if(action==='inspiration'){await resource({kind:'toggle-inspiration'});this.armed.delete(id);}
      else if(action==='heal'){if(!Number.isSafeInteger(amount)||amount!<1)throw new Error('Ingresá una cantidad entera positiva.');await resource({kind:'heal',amount:amount!});}
      else if(kind==='death'){
        if(c.combat.hitPoints.current>0)throw new Error('Las salvaciones de muerte solo se gestionan con 0 PG.');
        if(key==='reset')await resource({kind:'set-death-saves',successes:0,failures:0});
        else if(key==='success'||key==='failure')await resource({kind:'record-death-save',outcome:key});
      }
      else if(action==='color'){
        if(!color||!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Elegí un color válido.');
        adopt(await adapter.application.editCharacter({characterId:id,expectedCharacterRevision:c.revision,expectedCampaignChecksum:base.checksum,patch:{color}}));
      }
      else if(action==='experience'){
        if(!Number.isSafeInteger(amount)||amount!<1||!Number.isSafeInteger(c.identity.experience+amount!))throw new Error('Ingresá una cantidad entera positiva de experiencia.');
        adopt(await adapter.application.editCharacter({characterId:id,expectedCharacterRevision:c.revision,expectedCampaignChecksum:base.checksum,patch:{identity:{experience:c.identity.experience+amount!}}}));
      }
      else if(action==='level-up'){
        const xp=experienceProgress(c.identity.level,c.identity.experience);
        if(!c.builder||xp.next===null||xp.current<xp.next)throw new Error('Todavía no está disponible la subida guiada.');
        const {openCharacterBuilder}=await import('../character-builder');
        await openCharacterBuilder({campaignId:base.campaign.id,character:c,diceRoller:adapter.diceRoller,onCreate:async()=>{throw new Error('Este asistente solo permite subir de nivel.');},onAdvance:async choice=>{
          if(this.stopped||this.snapshot?.campaign.id!==base.campaign.id)throw new Error('La vista o campaña cambió. Volvé a abrir el asistente.');
          const updated=await adapter.application.advanceGuidedCharacter({characterId:id,choice,expectedCharacterRevision:c.revision,expectedCampaignChecksum:base.checksum,expectedCampaignId:base.campaign.id});adopt(updated);
        }});
      }
      else if(kind==='roll'){
        const [check,checkKey]=key?.split('/')??[],stats=projectCharacterStatistics(c);
        let modifier:number,label:string,mode:'normal'|'advantage'|'disadvantage';
        if(check==='skill'&&checkKey&&checkKey in SKILL_DEFINITIONS){const k=checkKey as SkillKey,definition=SKILL_DEFINITIONS[k];modifier=stats.skills[k];label=definition.label;mode=projectAdjustedRollMode(c,'skills',[k,definition.label],c.checks.skills[k].rollMode);}
        else if((check==='ability'||check==='save')&&checkKey&&checkKey in SAVE_DEFINITIONS){const k=checkKey as SaveKey;modifier=check==='save'?stats.savingThrows[k]:projectAbilityCheckModifier(c,k);label=(check==='save'?'Salvación de ':'')+SAVE_DEFINITIONS[k].label;mode=projectAdjustedRollMode(c,check==='save'?'saves':'skills',[k,k.slice(0,3)],check==='save'?c.checks.savingThrows[k].rollMode:'normal');}
        else throw new Error('Tirada desconocida.');
        const inspired=c.combat.inspiration&&this.armed.has(id),manual=this.manualModes.get(id)??null;
        const conditions=new Set(c.combat.conditions.map(value=>value.key));
        const expression=applyCheckConditionDice(`1d20${modifier>=0?'+':''}${modifier}`,conditions);
        await adapter.diceRoller.roll({name:label,characterId:id,expressions:[expression],mode:combineRollModes(mode,manual?.mode??'normal',inspired?'advantage':'normal')});
        const next=consumeManualRollMode(manual);if(next)this.manualModes.set(id,next);else this.manualModes.delete(id);
        if(inspired){this.armed.delete(id);await resource({kind:'toggle-inspiration'});}
      }
    } catch(error){try{await this.reload();}catch{/* Keep the last snapshot if refreshing also fails. */}this.message=error instanceof Error?error.message:String(error);}
    finally{this.busy=false;if(!this.stopped){this.render();if(this.selectedCharacterId===id){if(action==='color')this.root.querySelector<HTMLElement>('.ns-person-menu summary')?.focus({preventScroll:true});else this.focusPlay(action);}}}
  }

  private async reload(): Promise<void> {
    const sequence = ++this.loadSequence;
    const snapshot = await this.options.loadCampaign();
    if (!this.stopped && sequence === this.loadSequence) this.accept(snapshot);
  }

  private accept(snapshot: CampaignSnapshot | null): void {
    if(this.snapshot?.campaign.id!==snapshot?.campaign.id){this.armed.clear();this.manualModes.clear();}
    for(const id of this.armed)if(!snapshot?.campaign.characters[id]?.combat.inspiration)this.armed.delete(id);
    this.snapshot = snapshot;
    this.message = "";
    if (!this.selectedEncounterId || !snapshot?.campaign.encounters[this.selectedEncounterId]) {
      this.selectedEncounterId = Object.keys(snapshot?.campaign.encounters ?? {})[0] ?? null;
    }
    const characters = this.characters();
    if (!characters.some(character => character.id === this.selectedCharacterId)) {
      const remembered = snapshot ? this.preferences.lastCharacterId(snapshot.campaign.id) : null;
      this.selectedCharacterId = characters.find(character => character.id === remembered)?.id ?? characters[0]?.id ?? null;
    }
    // Preserve expanded descriptions and reading position during live updates.
    const expanded = new Set([...this.root.querySelectorAll<HTMLDetailsElement>("details[data-next-detail][open]")].map(node => node.dataset.nextDetail));
    const scroll = this.root.ownerDocument.scrollingElement?.scrollTop ?? 0;
    const focused = this.root.contains(this.root.ownerDocument.activeElement)
      ? this.root.ownerDocument.activeElement as HTMLElement : null;
    const focusSection = focused?.dataset.nextSection;
    const focusCharacter = focused?.id === "character-title-select";
    const focusEncounter = focused?.hasAttribute("data-next-encounter");
    const focusDetail = focused?.closest<HTMLDetailsElement>("details[data-next-detail]")?.dataset.nextDetail;
    const focusStatistic = focused?.dataset.nextFocus;
    const focusConditions = focused?.hasAttribute("data-next-conditions");
    this.render();
    for (const node of this.root.querySelectorAll<HTMLDetailsElement>("details[data-next-detail]")) node.open = expanded.has(node.dataset.nextDetail);
    if (focusSection) this.root.querySelector<HTMLButtonElement>(`[data-next-section="${focusSection}"]`)?.focus({ preventScroll: true });
    if (focusCharacter) this.root.querySelector<HTMLSelectElement>("#character-title-select")?.focus({ preventScroll: true });
    if (focusEncounter) this.root.querySelector<HTMLSelectElement>("[data-next-encounter]")?.focus({ preventScroll: true });
    if (focusDetail) [...this.root.querySelectorAll<HTMLDetailsElement>("details[data-next-detail]")].find(node => node.dataset.nextDetail === focusDetail)?.querySelector("summary")?.focus({ preventScroll: true });
    if (focusStatistic) [...this.root.querySelectorAll<HTMLElement>("[data-next-focus]")].find(node => node.dataset.nextFocus === focusStatistic)?.focus({ preventScroll: true });
    if (focusConditions) this.root.querySelector<HTMLButtonElement>("[data-next-conditions]")?.focus({ preventScroll: true });
    if (this.root.ownerDocument.scrollingElement) this.root.ownerDocument.scrollingElement.scrollTop = scroll;
  }

  private characters(): CharacterV2[] {
    return Object.values(this.snapshot?.campaign.characters ?? {}).filter(character => this.options.role === "gm" || !character.archived)
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  }

  private sections(): readonly (readonly [string, string])[] {
    return this.options.role === "gm"
      ? [["combat", "Combate"], ["characters", "Personajes"], ["content", "Contenido"], ["more", "Más"]]
      : [["sheet", "Ficha"], ["turn", "Turno"], ["equipment", "Equipo"], ["more", "Más"]];
  }

  private detail(id: string, title: string, description: string, meta = ""): string {
    return `<details data-next-detail="${escape(id)}"><summary>${escape(title)}</summary>${meta ? `<p class="next-meta">${escape(meta)}</p>` : ""}<p class="next-description">${escape(description || "Sin descripción.")}</p></details>`;
  }

  private characterContent(character: CharacterV2): string {
    if (this.section === "equipment") return `<h2>Equipo personal</h2>${character.inventory.length
      ? character.inventory.map(original => { const item = unidentifiedItemView(original); return this.detail(item.id, `${item.name} ×${item.quantity}`, item.description,
        [item.equipped ? "Equipado" : "En inventario", item.attuned ? "Sintonizado" : "", !itemIsIdentified(original) ? "Sin identificar" : ""].filter(Boolean).join(" · ")); }).join("")
      : "<p>No hay objetos en el inventario.</p>"}`;
    if (this.section === "sheet" || this.section === "characters") {
      return characterSheetContent(character, this.expandedConditions.has(character.id),this.interaction());
    }
    if (this.section === "more") return `<h2>Notas del personaje</h2>${character.notes.flatMap(group => group.notes).map(note => this.detail(note.id, note.title, note.content)).join("") || "<p>Sin notas registradas.</p>"}<p class="next-meta">Progresión, extras, biblioteca y edición siguen disponibles en la interfaz actual.</p>`;
    const hiddenItems = new Set(character.inventory.filter(item => !itemIsIdentified(item)).map(item => item.id));
    const actions = character.actions.filter(action => !action.inventoryItemId || !hiddenItems.has(action.inventoryItemId));
    const spells = character.spellcasting.spells.filter(spell => ![...hiddenItems].some(id => spell.casting?.source.startsWith(`inventory:${id}:`)));
    return `<h2>Acciones y conjuros</h2><p class="next-meta">Consulta de lo registrado en tu ficha. Tiradas, uso de recursos y lanzamiento siguen en la interfaz actual.</p>
      <h3>Acciones</h3>${actions.map(action => this.detail(action.id, action.name, action.description, [action.activation, action.reach].filter(Boolean).join(" · "))).join("") || "<p>Sin acciones registradas.</p>"}
      <h3>Conjuros</h3>${spells.map(spell => {
        const preparation = spellPersonalInfo(character, spell).preparation === "unnecessary"
          ? "No requiere preparación" : spell.prepared ? "Preparado" : "No preparado";
        return this.detail(spell.id, spell.name, spell.definition?.description ?? "", `${spell.level === 0 ? "Truco" : `Nivel ${spell.level}`} · ${preparation}`);
      }).join("") || "<p>Sin conjuros registrados.</p>"}`;
  }

  private gmContent(): string {
    if (this.section === "content") return "<h2>Contenido de campaña</h2><p>La consulta y edición de monstruos, objetos, conjuros y comerciantes continúa en la interfaz actual.</p>";
    if (this.section === "more") return "<h2>Campaña y herramientas</h2><p>Las notas del GM, tablas, biblioteca y ajustes continúan en la interfaz actual.</p>";
    const encounters = Object.values(this.snapshot?.campaign.encounters ?? {});
    const encounter = encounters.find(entry => entry.id === this.selectedEncounterId);
    return `<h2>Combate guardado</h2><p class="next-meta">Esta vista consulta el estado guardado. No controla ni sincroniza la cola nativa de TaleSpire.</p>
      ${encounters.length > 1 ? `<label>Encuentro consultado<select data-next-encounter>${encounters.map(entry => `<option value="${escape(entry.id)}" ${entry.id === this.selectedEncounterId ? "selected" : ""}>${escape(entry.name)}</option>`).join("")}</select></label>` : ""}
      ${encounter ? `<section class="next-encounter"><div class="next-section-heading"><h3>${escape(encounter.name)}</h3><span class="next-meta">${encounter.combatants.length} combatientes</span></div>
      <ol class="next-combat-list">${[...encounter.combatants].sort((a, b) => a.order - b.order).map(combatant => `<li class="${combatant.id === encounter.activeCombatantId ? "next-current-combatant" : ""}">
        <div class="next-combatant-identity"><strong>${escape(combatant.name)}</strong>${combatant.id === encounter.activeCombatantId ? '<span class="next-turn-label">Turno guardado</span>' : ""}</div>
        <dl class="next-combatant-stats"><div><dt>PG</dt><dd>${combatant.hitPoints.current}<span> / ${combatant.hitPoints.maximum}</span>${combatant.hitPoints.temporary ? `<small>+${combatant.hitPoints.temporary} temporales</small>` : ""}</dd></div><div><dt>CA</dt><dd>${combatant.armorClass ?? "—"}</dd></div></dl>
      </li>`).join("")}</ol>${encounter.combatants.length ? "" : "<p>Este encuentro no tiene combatientes.</p>"}</section>` : "<p>No hay encuentros guardados.</p>"}`;
  }

  private render(): void {
    this.tooltips?.hide();
    const characters = this.characters();
    const character = characters.find(entry => entry.id === this.selectedCharacterId);
    const showCharacter = this.options.role === "player" || this.section === "characters";
    const theme = this.root.ownerDocument.documentElement.dataset.v2Theme === "light" ? "light" : "dark";
    this.root.innerHTML = `<section class="next-interface" aria-busy="${this.busy}" style="${character ? uiAccentStyle(character.color, theme) : ""}">
      <p class="next-preview-notice">${this.options.play?'Nueva · piloto de Ficha. Equipo, acciones y edición general continúan en Actual.':'Vista previa de consulta · Volvé a Actual para jugar o editar.'}</p>
      <header><h1 class="ns-sr-only">${this.options.role === "gm" ? "Control GM" : "Ficha de personaje"}</h1>
      ${character ? characterIdentityHeader(character, characters,this.interaction()) : ""}</header>
      <nav aria-label="Secciones de la nueva interfaz">${this.sections().map(([id, label]) => `<button type="button" data-next-section="${id}" aria-pressed="${id === this.section}">${label}</button>`).join("")}</nav>
      ${this.message ? `<p role="status">${escape(this.message)}</p>` : ""}
      <section class="next-content" aria-label="Contenido de consulta">${!this.snapshot ? "<h2>No hay campaña cargada</h2><p>Volvé a la interfaz actual para crear o seleccionar una campaña.</p>" : showCharacter ? character ? this.characterContent(character) : "<h2>No hay personajes disponibles</h2><p>La creación de personajes sigue en la interfaz actual.</p>" : this.gmContent()}</section>
    </section>`;
    this.tooltips?.afterRender();
    for(const details of this.root.querySelectorAll<HTMLDetailsElement>('.ns-level-details'))details.addEventListener('toggle',()=>{if(details.isConnected&&details.open)this.tooltips?.hide();});
    this.relayout();
  }
}
