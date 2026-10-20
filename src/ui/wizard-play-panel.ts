import { monkFreeModes } from "./martial-play-panel";
import { recoverableEquipmentSlotCount } from "../domain/equipment/equipment-spell-slots";
import { itemSpellState } from "../domain/character/item-spells";
import { sorcererFreeModes } from "./sorcerer-play-panel";
import { druidCastUnavailable } from "../domain/character/druid-play";
import { barbarianRaging } from "../domain/character/barbarian-rules";
import { warlockSpellAvailable,warlockRitualAvailable } from "../domain/character/warlock-play";
import type { CharacterV2 } from "../domain/character/character-v2";
import type { CharacterSpellV2 } from "../domain/character/character-spell-model";
import type { WizardAction } from "../domain/character/wizard-model";
import { PHB_SPELLS, classSpells } from "../domain/character/phb-spells";
import { WIZARD_SLOTS, wizardSchool, wizardSpellSource, wizardCopyDescription, wizardBookDefinition } from "../domain/character/wizard-catalog";
import { wizardPreparationLimit, wizardSignature } from "../domain/character/wizard-builder";
import { wizardWardMaximum, wizardCopyCost, wizardFeature } from "../domain/character/wizard-play";
import type { DiceRoller } from "../application/ports/dice-roller";
import { projectSpellDamageExpression, projectCharacterStatistics, hasBuilderFeat } from "../domain/character/character-projection";

const html = (s: string) => s.replace(/[&<>"']/g,(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const button = (action: string, label: string, disabled = false) => `<button type="button" data-wizard-action="${action}" ${disabled ? "disabled" : ""}>${html(label)}</button>`;
const select = (name: string, label: string, choices: Record<string,string>, current = "") => `<label>${html(label)}<select data-wizard-field="${name}">${Object.entries(choices).map(([key,label]) => `<option value="${key}" ${key === current ? "selected" : ""}>${html(label)}</option>`).join("")}</select></label>`;
export function spellReady(spell: CharacterSpellV2, character?: CharacterV2): boolean { return (spell.casting?.kind !== "item" || !!character && itemSpellState(character,spell).available) && (!character || !druidCastUnavailable(character,spell)) && (!character || !barbarianRaging(character)) && (!character || warlockSpellAvailable(character,spell)) && ( spell.level === 0 || spell.prepared || !!spell.casting && spell.casting.source !== "builder:paladin" && !["wizard","cleric","druid"].includes(spell.casting.kind)); }
export function spellRitualAvailable(character: CharacterV2, spell: CharacterSpellV2): boolean {
  if (spell.casting?.kind === "item") return false;
  if (["builder:monk","builder:paladin"].includes(spell.casting?.source ?? "")) return false;
  if (druidCastUnavailable(character,spell)) return false;
  if (barbarianRaging(character)) return false;
  if (character.builder?.classKey === "barbarian") return spell.casting?.kind === "ritual" && !!spell.definition?.ritual;
  if (spell.casting?.source === "builder:bard") return !!spell.definition?.ritual;
  if (["cleric","druid"].includes(spell.casting?.kind ?? "")) return !!spell.definition?.ritual && spell.prepared;
  if (character.builder?.classKey === "warlock") return warlockRitualAvailable(character,spell);
  return !!spell.definition?.ritual && (!spell.casting || spell.casting.kind === "ritual" || spell.casting.kind === "wizard" && !!character.spellcasting.wizard?.bookAvailable && character.spellcasting.wizard.book.includes(spell.casting.key));
}
export function wizardFreeModes(character: CharacterV2, spell: CharacterSpellV2): Array<{ value: string; label: string; available: boolean }> {
  if (spell.casting?.source === "builder:monk") return monkFreeModes(character,spell);
  if (character.builder?.classKey === "sorcerer") return sorcererFreeModes(character,spell);
  if (spell.casting?.kind !== "wizard") return [];
  const key = spell.casting.key, runtime = character.spellcasting.wizard!, result: Array<{ value: string; label: string; available: boolean }> = [];
  if (runtime.mastery.includes(key)) result.push({ value: "mastery", label: "Maestría · preparado · sin espacio",available: spell.prepared });
  if (wizardSignature(character.builder!).includes(key)) {
    const t = wizardFeature(character,`signature-${key}`);
    result.push({ value: "signature",label: "Característico · nivel 3 · sin espacio",available: !!t && t.uses.used < t.uses.maximum });
  }
  if (key === "polymorph" && wizardSchool(character.builder!) === "transmutation" && character.identity.level >= 10) {
    const t = wizardFeature(character,"shapechanger");
    result.push({ value: "shapechanger",label: "Cambiaformas · preparado · solo vos · bestia VD ≤1",available: spell.prepared && !!t && t.uses.used < t.uses.maximum });
  }
  return result;
}
export function wizardFreeOptions(character: CharacterV2, spell: CharacterSpellV2, selected?: string | number): string { return wizardFreeModes(character,spell).map((m) => `<option value="${m.value}" data-spell-damage="${html(projectSpellDamageExpression(character,spell,m.value.startsWith("ki-") ? Number(m.value.slice(3)) : spell.level))}" data-cast-available="${m.available}" ${m.value === selected ? "selected" : ""} ${m.available ? "" : "disabled"}>${html(m.label)}${m.available ? "" : " · no disponible"}</option>`).join(""); }
export function wizardSpellExtras(character: CharacterV2, spell: CharacterSpellV2): string {
  if (character.builder?.classKey !== "wizard" || spell.level === 0) return "";
  const school = wizardSchool(character.builder), runtime = character.spellcasting.wizard!;
  let result = "";
  if (school === "divination" && character.identity.level >= 6 && spell.definition?.school === "Adivinación") result += `<label>Adivinación experta: recuperar espacio<select data-wizard-recover-slot><option value="0">Sin recuperar</option>${[1,2,3,4,5].filter((n) => recoverableEquipmentSlotCount(character,n) > 0).map((n) => `<option value="${n}">Nivel ${n} · debe ser inferior al lanzamiento</option>`).join("")}</select></label>`;
  if (school === "abjuration" && spell.definition?.school === "Abjuración" && !runtime.ward.created) result += '<label class="checkbox"><input type="checkbox" data-wizard-create-ward checked> Crear guardián arcano con este lanzamiento</label>';
  if (school === "evocation" && character.identity.level >= 14 && wizardSpellSource(character,spell) && spell.level <= 5 && spell.definition?.damageExpression) result += `<label class="checkbox"><input type="checkbox" data-wizard-overchannel> Sobrecanalizar (solo N1–5) · ${runtime.overchannelUses ? `coste propio: ${(runtime.overchannelUses+1)}d12 necrótico por nivel` : "primer uso sin coste"}</label>`;
  return result ? `<div class="wizard-cast-extras">${result}</div>` : "";
}
export function renderWizardPanel(character: CharacterV2): string {
  const runtime = character.spellcasting.wizard;
  if (character.builder?.classKey !== "wizard" || !runtime) return "";
  const level = character.identity.level, school = wizardSchool(character.builder), signature = wizardSignature(character.builder);
  const bookDefinition = (key: string) => wizardBookDefinition(key,runtime.copied)!;
  const spellOptions = (keys: string[]) => Object.fromEntries(keys.map((key) => [key,`${bookDefinition(key).name} · N${bookDefinition(key).level}`]));
  const spells = character.spellcasting.spells.filter((s) => s.casting?.kind === "wizard" && s.level > 0), prepared = spells.filter((s) => s.prepared && !signature.includes(s.casting!.key));
  const used = (name: string) => { const t = wizardFeature(character,name); return !t || t.uses.used >= t.uses.maximum; };
  let content = `<p>${runtime.bookAvailable ? "Libro disponible" : "Libro no disponible: conservás los conjuros preparados, pero no podés preparar otros ni realizar rituales del libro."} · ${runtime.book.length} conjuros en este libro.</p>${button("book-access",runtime.bookAvailable ? "Marcar libro no disponible" : "Recuperé el libro")}
    <details><summary>Preparar conjuros tras descanso largo · ${prepared.length}/${wizardPreparationLimit(character)}</summary><p>Elegí tu lista completa. Estudio mínimo: un minuto por nivel de cada conjuro de la lista. Los característicos se preparan automáticamente, sin ocupar cupo.</p><div class="wizard-preparation-list">${spells.filter((s) => runtime.book.includes(s.casting!.key)).map((s) => `<label class="checkbox"><input type="checkbox" data-wizard-prepared-key="${s.casting!.key}" ${s.prepared ? "checked" : ""} ${signature.includes(s.casting!.key) ? "disabled" : ""}> ${html(s.name)} · N${s.level}${signature.includes(s.casting!.key) ? " · característico" : ""}</label>`).join("")}</div>${button("prepare","Preparar esta lista (tras descanso largo)",!runtime.bookAvailable)}</details>
    <details><summary>Copiar, recuperar o reemplazar el libro</summary><p>Texto ajeno: 50 po y 2 horas por nivel. Notación propia o memoria preparada: 10 po y 1 hora por nivel. La escuela especializada reduce ambos a la mitad. Conseguí la fuente y dedicá el tiempo antes de confirmar. Un pergamino además requiere resolución del GM (prueba de Arcano y consumo).</p><div class="builder-grid">${select("copy-key","Conjuro a copiar",spellOptions(classSpells("wizard",1,WIZARD_SLOTS[level]!.length).filter((key) => !runtime.book.includes(key))))}${select("copy-source","Origen",{ external: "Texto ajeno disponible", own: "Memoria preparada / notación propia", scroll: "Pergamino" })}<label class="checkbox"><input type="checkbox" data-wizard-field="scroll-check"> Prueba del pergamino superada</label></div><p data-wizard-copy-cost></p>${button("copy","Copiar conjuro y descontar materiales",!runtime.bookAvailable)}<p>Si perdiste el libro, marcá arriba los conjuros preparados que reconstruirás de memoria en el nuevo. Los demás deben recuperarse de una fuente.</p><label class="checkbox"><input type="checkbox" data-wizard-field="buy-book" checked> Comprar libro vacío adicional: 50 po</label>${button("replace-book","Reconstruir libro con los preparados seleccionados")}</details>
    <details><summary>Recuperación arcana · ${used("Recuperación arcana") ? "gastada" : "disponible"}</summary><p>Una vez por día, después de descanso corto. Hasta ${Math.ceil(level/2)} niveles combinados, sin espacios de nivel 6 o superior. Cada campo indica cuántos recuperar.</p><div class="builder-grid">${[1,2,3,4,5].map((n) => `<label>Nivel ${n} (${recoverableEquipmentSlotCount(character,n)} gastados)<input type="number" min="0" max="${recoverableEquipmentSlotCount(character,n)}" value="0" data-wizard-field="recover-${n}"></label>`).join("")}</div>${button("arcane-recovery","Recuperar después de descanso corto",used("Recuperación arcana"))}</details>`;
  if (school === "war-magic") content += `<details><summary>Magia de Guerra</summary><p>Desviación Arcana: reacción, +2 CA ante ese ataque o +4 a esa salvación. Solo trucos hasta final del siguiente turno.</p>${runtime.arcaneDeflection ? button("end-deflection","Terminó mi siguiente turno: quitar restricción") : button("arcane-deflection","Usar Desviación Arcana")}${level >= 6 ? `<p>Sobrecargas: ${runtime.powerSurges}. Máximo INT (mínimo 1). Daño de fuerza adicional ${Math.floor(level/2)}, una vez por turno contra un objetivo dañado por conjuro de mago.</p>${button("power-surge-gain","Contraconjuro/Disipar Magia terminó un conjuro")}${button("power-surge-spend","Gastar sobrecarga en este turno",runtime.powerSurges === 0)}` : ""}</details>`;
  if (runtime.copied.length) content += `<details data-wizard-copy-history><summary>Conjuros copiados · ${runtime.copied.length}</summary><ul>${runtime.copied.map((copy) => `<li><strong>${html(wizardBookDefinition(copy.key,runtime.copied)?.name ?? copy.key)}</strong> · ${html(wizardCopyDescription(copy))}</li>`).join("")}</ul></details>`;
  if (level >= 18) content += `<details><summary>Cambiar Maestría de conjuros</summary><p>Requiere ocho horas de estudio. No cambia la lista preparada ni los conjuros característicos.</p><div class="builder-grid">${[1,2].map((n,i) => select(`mastery-${i}`,`Nivel ${n}`,spellOptions(runtime.book.filter((key) => bookDefinition(key)?.level === n)),runtime.mastery[i])).join("")}</div>${button("mastery","Confirmar cambio tras ocho horas",!runtime.bookAvailable)}</details>`;
  content += `<details><summary>Libros de respaldo · ${runtime.backups.length}</summary><p>Copiá conjuros de tu libro disponible a otro: un libro vacío de 50 po más 10 po y una hora por nivel copiado, reducidos por tu escuela. La copia conserva sus propios contenidos; si perdés el libro activo, podés usar el respaldo.</p><div class="wizard-preparation-list">${runtime.book.map((key) => `<label class="checkbox"><input type="checkbox" data-wizard-backup-key="${key}" checked> ${html(bookDefinition(key).name)}</label>`).join("")}</div>${button("backup-book","Crear respaldo (comprar libro y copiar selección)",!runtime.bookAvailable)}${runtime.backups.map((book,i) => `<p>Copia ${i+1}: ${book.keys.length} conjuros · ${book.available ? "disponible" : "no disponible"} ${button(`use-backup-${book.id}`,"Usar esta copia",!book.available)} ${button(`backup-access-${book.id}`,book.available ? "Marcar no disponible" : "Recuperar esta copia")}</p>`).join("")}</details>`;
  if (school === "abjuration") content += `<details open><summary>Guardián arcano · ${runtime.ward.current}/${wizardWardMaximum(character)} PG · ${runtime.ward.created ? "creado" : "sin crear"}</summary><p>Los lanzamientos de abjuración N1+ lo crean o recargan. El daño absorbido no consume PG temporales; aplicá por separado cualquier excedente al objetivo correspondiente.</p><label>Daño antes de resistencias del objetivo<input type="number" min="0" value="0" data-wizard-field="ward-damage"></label>${level >= 6 ? '<label class="checkbox"><input type="checkbox" data-wizard-field="projected"> Proyectado: reacción, objetivo visible a 30 pies</label>' : ""}${button("ward-damage","Aplicar daño al guardián",!runtime.ward.created)}</details>`;
  if (school === "divination") content += `<details open><summary>Portento</summary><p>Registrá las tiradas del descanso largo. Elegí sustituir antes de tirar, máximo una vez por turno. Los resultados anteriores se pierden al descansar.</p>${runtime.portentNeedsRoll ? `<div class="builder-grid">${Array.from({ length: level >= 14 ? 3 : 2 },(_,i) => `<label>d20 ${i+1}<input type="number" min="1" max="20" value="10" data-wizard-field="portent-${i}"></label>`).join("")}</div>${button("roll-portent","Tirar dados de Portento")}${button("portent-roll","Registrar estos resultados")}` : runtime.portent.map((p,i) => button(`portent-use-${i}`,`${p.value} · ${p.used ? "gastado" : "usar sustitución"}`,p.used)).join("")}</details>`;
  if (school === "divination" && level >= 10) content += `<details><summary>Tercer ojo · ${runtime.thirdEye ? html(runtime.thirdEye) : "inactivo"}</summary>${select("third-eye","Percepción",{ darkvision: "Visión en oscuridad 60 pies", ethereal: "Visión etérea 60 pies", reading: "Leer cualquier idioma", invisible: "Ver invisibles 10 pies" })}${button("third-eye","Activar con una acción",used("Tercer ojo"))}</details>`;
  if (school === "conjuration" && level >= 6) content += `<p>Transposición benigna: acción; espacio visible a 30 pies o intercambio con criatura dispuesta Pequeña/Mediana. Recupera al descansar largo o lanzar conjuración N1+.</p>${button("benign-transposition","Usar Transposición benigna",used("Transposición benigna"))}`;
  if (school === "illusion" && level >= 10) content += `<p>Yo ilusorio: reacción frente a un ataque; provoca fallo automático.</p>${button("illusory-self","Usar Yo ilusorio",used("Yo ilusorio"))}`;
  if (school === "transmutation" && level >= 6) content += `<details><summary>Piedra del transmutador · ${runtime.stone ? html(`${runtime.stone.benefit} · ${runtime.stone.bearer === "self" ? "la llevás vos" : "otro portador"}`) : "no creada"}</summary><p>Crear una piedra requiere ocho horas y desactiva la anterior. Si la llevás, lanzar transmutación N1+ permite cambiar su beneficio.</p><div class="builder-grid">${select("stone-benefit","Beneficio",{ darkvision: "Visión en oscuridad 60 pies", speed: "Velocidad +10 pies sin carga", constitution: "Competencia en salvaciones CON", acid: "Resistencia ácido", cold: "Resistencia frío", fire: "Resistencia fuego", lightning: "Resistencia rayo", thunder: "Resistencia trueno" },runtime.stone?.benefit)}${select("stone-bearer","Portador",{ self: "Yo", other: "Otra criatura" },runtime.stone?.bearer)}<label class="checkbox"><input type="checkbox" data-wizard-field="unencumbered" ${runtime.stone?.unencumbered !== false ? "checked" : ""}> Sin carga que impida el beneficio de velocidad</label></div>${button("stone-transfer","Cambiar portador / estado de carga",!runtime.stone)}${button("stone-create","Crear tras ocho horas",runtime.stoneConsumed)}${button("stone-change","Cambiar después de transmutación",!runtime.stoneChangeAvailable)}${level >= 14 ? `${select("master-transmuter","Maestro transmutador",{ transformation: "Transformación mayor · 10 minutos", panacea: "Panacea al tocar", life: "Restaurar vida · Revivir a los muertos", youth: "Apariencia 3d10 años más joven" })}<p>La piedra se destruye y no se recrea hasta después de descanso largo. Aplicá el efecto al objetivo en la mesa; Revivir a los muertos conserva los requisitos que este rasgo no exime.</p>${button("master-transmuter","Consumir piedra para este efecto",!runtime.stone || runtime.stone.bearer !== "self")}` : ""}</details>`;
  if (school === "evocation" && level >= 14) content += `<p>Sobrecanalizar: ${runtime.overchannelUses} usos desde descanso largo. Se elige en el conjuro a lanzar; el daño propio de repeticiones se resuelve en mesa.</p>`;
  if (character.combat.conditions.some((c) => c.key === "concentration")) {
    const modifier = projectCharacterStatistics(character).savingThrows.constitution;
    content += `<p>Concentración: un solo conjuro a la vez. CD por daño = máximo entre 10 y la mitad del daño, redondeada abajo. Lanzamientos largos y rituales también exigen concentración mientras se realizan. ${school === "conjuration" && level >= 10 && runtime.concentrationSchool === "Conjuración" ? "Conjuración concentrada evita la pérdida por daño; no otras causas." : ""}</p><button type="button" class="roll-button" data-roll-name="Concentración" data-roll-expression="1d20${modifier >= 0 ? "+" : ""}${modifier}" data-roll-mode="${hasBuilderFeat(character,"war-caster") ? "advantage" : "normal"}">Tirar salvación de concentración${hasBuilderFeat(character,"war-caster") ? " (ventaja por daño)" : ""}</button>`;
  }
  return `<details class="wizard-play-panel" data-wizard-panel><summary>Libro y recursos de Mago · ${prepared.length}/${wizardPreparationLimit(character)} preparados</summary>${content}</details>`;
}

export function bindWizardPanel(root: HTMLElement, character: CharacterV2, options: { dispatch: (action: WizardAction, label: string) => Promise<void>; diceRoller: DiceRoller; error: (message: string) => void }): void {
  const panel = root.querySelector<HTMLElement>("[data-wizard-panel]");
  if (!panel || !character.spellcasting.wizard) return;
  const text = (name: string) => panel.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-wizard-field="${name}"]`)?.value ?? "";
  const checked = (name: string) => panel.querySelector<HTMLInputElement>(`[data-wizard-field="${name}"]`)?.checked ?? false;
  const keys = () => Array.from(panel.querySelectorAll<HTMLInputElement>("[data-wizard-prepared-key]:checked")).map((i) => i.dataset.wizardPreparedKey!);
  const cost = () => {
    const readout = panel.querySelector("[data-wizard-copy-cost]")!;
    try { const c = wizardCopyCost(character,text("copy-key"),text("copy-source") as "external" | "own" | "scroll"); readout.textContent = `${c.gold} po · ${c.hours} horas. El precio incluye la reducción de tu escuela cuando corresponde.`; }
    catch { readout.textContent = "No quedan conjuros de tu nivel fuera de este libro."; }
  };
  panel.querySelectorAll("[data-wizard-field=copy-key], [data-wizard-field=copy-source]").forEach((control) => control.addEventListener("change",cost)); cost();
  panel.querySelectorAll<HTMLButtonElement>("[data-wizard-action]").forEach((control) => control.addEventListener("click",async () => {
    if (control.disabled) return; control.disabled = true;
    const kind = control.dataset.wizardAction!;
    try {
      let action: WizardAction;
      if (kind === "roll-portent") {
        const count = character.identity.level >= 14 ? 3 : 2, result = await options.diceRoller.roll({ name: "Portento tras descanso largo",expressions: Array(count).fill("1d20"),mode: "normal" });
        if (!panel.isConnected) return;
        if (result.kind !== "rolled" || result.totals.length !== count || result.totals.some((n) => !Number.isInteger(n) || n < 1 || n > 20)) throw new Error("La tirada se envió a TaleSpire. Ingresá los resultados de d20 y registralos aquí.");
        action = { kind: "portent-roll",values: result.totals };
      } else if (kind === "prepare") action = { kind,keys: keys(),afterLongRest: true };
      else if (kind === "copy") action = { kind,key: text("copy-key"),source: text("copy-source") as "external" | "own" | "scroll",scrollCheckSucceeded: checked("scroll-check") };
      else if (kind === "book-access") action = { kind,available: !character.spellcasting.wizard!.bookAvailable };
      else if (kind === "replace-book") action = { kind,keys: keys().filter((key) => character.spellcasting.spells.some((s) => s.casting?.key === key && s.prepared)),buyBlankBook: checked("buy-book") };
      else if (kind === "backup-book") action = { kind,keys: Array.from(panel.querySelectorAll<HTMLInputElement>("[data-wizard-backup-key]:checked")).map((i) => i.dataset.wizardBackupKey!),buyBlankBook: true };
      else if (kind.startsWith("backup-access-")) { const id = kind.slice("backup-access-".length); action = { kind: "book-access",id,available: !character.spellcasting.wizard!.backups.find((b) => b.id === id)!.available }; }
      else if (kind.startsWith("use-backup-")) action = { kind: "use-backup",id: kind.slice("use-backup-".length) };
      else if (kind === "mastery") action = { kind,keys: [text("mastery-0"),text("mastery-1")],studyHours: 8 };
      else if (kind === "arcane-recovery") {
        const slots: number[] = [];
        for (const n of [1,2,3,4,5]) { const count = Number(text(`recover-${n}`)); if (!Number.isInteger(count) || count < 0 || count > 10) throw new Error("Ingresá cantidades enteras de espacios gastados."); slots.push(...Array(count).fill(n)); }
        action = { kind,slots,afterShortRest: true };
      } else if (kind === "portent-roll") action = { kind,values: Array.from({ length: character.identity.level >= 14 ? 3 : 2 },(_,i) => Number(text(`portent-${i}`))) };
      else if (kind.startsWith("portent-use-")) action = { kind: "portent-use",index: Number(kind.slice("portent-use-".length)) };
      else if (kind === "ward-damage") action = { kind,damage: Number(text("ward-damage")),projected: checked("projected") };
      else if (kind === "stone-create" || kind === "stone-change") action = { kind: "stone",benefit: text("stone-benefit") as "speed",bearer: text("stone-bearer") as "self" | "other",unencumbered: checked("unencumbered"),create: kind === "stone-create" };
      else if (kind === "stone-transfer") action = { kind,bearer: text("stone-bearer") as "self" | "other",unencumbered: checked("unencumbered") };
      else if (kind === "master-transmuter") action = { kind,effect: text("master-transmuter") as "life" };
      else if (kind === "third-eye") action = { kind,benefit: text("third-eye") as "darkvision" };
      else if (kind === "arcane-deflection") action = { kind };
      else if (kind === "end-deflection") action = { kind,nextTurnEnded: true };
      else if (kind === "power-surge-gain") action = { kind,endedSpell: true };
      else if (kind === "power-surge-spend") action = { kind,oncePerTurn: true };
      else action = { kind: "use-feature",key: kind as "benign-transposition" | "illusory-self" };
      await options.dispatch(action,control.textContent ?? "Mago");
    } catch (failure) { options.error(failure instanceof Error ? failure.message : "No se pudo registrar la elección."); }
    finally { if (control.isConnected) control.disabled = false; }
  }));
}
