import type { CharacterV2 } from "../../domain/character/character-v2";
import { SAVE_DEFINITIONS, SKILL_DEFINITIONS, type SaveKey, type SkillKey } from "../../domain/character/character-checks";
import { projectCharacterStatistics, projectCharacterStatisticOrigins, type StatisticOrigin } from "../../domain/character/character-projection";
import { nextIcon, type NextIcon } from "./next-icons";
import { consultation, levelControl, inspirationControl, rollModeControl, deathControl, canPlay, type SheetInteraction } from "./next-sheet-controls";

export const escapeNext = (value: string | number): string => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const tip = (value: string) => `data-next-tip="${escapeNext(value)}"`;
const abilities: readonly SaveKey[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const abilityIcons: Record<SaveKey, NextIcon> = { strength: "dumbbell", dexterity: "feather", constitution: "heart-pulse", intelligence: "brain", wisdom: "eye", charisma: "megaphone" };
const skillIcons: Record<SkillKey, NextIcon> = { acrobatics: "person-standing", animalHandling: "paw-print", arcana: "sparkles", athletics: "dumbbell", deception: "drama", history: "scroll-text", insight: "scan-face", intimidation: "angry", investigation: "search", medicine: "cross", nature: "leaf", perception: "eye", performance: "music-2", persuasion: "message-circle", religion: "book-open", sleightOfHand: "hand", stealth: "footprints", survival: "compass" };
function explanation(name: string, origin: StatisticOrigin): string {
  return [name, ...origin.contributions.map(part => `${signed(part.value)} ${part.label}`), ...(origin.incomplete ? ["Parte del origen todavía no está desglosada."] : [])].join("\n");
}
const recorded = (name: string, value: string | number) => `${name}\n${value} · valor registrado en ficha.\nOrigen no desglosado.`;
const unavailable = (name: string, icon: NextIcon) => `<span class="ns-unavailable" tabindex="0" aria-disabled="true" aria-label="${escapeNext(name)} · disponible en Actual" ${tip(name + "\nDisponible en Actual.")}>${nextIcon(icon)}</span>`;
const group = (title: string, content: string) => `<section class="ns-group"><h3>${title}</h3>${content}</section>`;

export function characterIdentityHeader(character: CharacterV2, characters: CharacterV2[], interaction: SheetInteraction = consultation): string {
  return `<div class="ns-identity"><div><select id="character-title-select" aria-label="Personaje seleccionado" ${interaction.busy?'disabled':''}>${characters.map(entry => `<option style="color:${entry.color}" value="${escapeNext(entry.id)}" ${entry.id === character.id ? "selected" : ""}>${escapeNext(entry.name)}${entry.archived ? " · archivado" : ""}</option>`).join("")}</select></div><div class="ns-person-actions">${unavailable("Editar ficha", "pencil")}<details class="ns-person-menu" data-next-detail="character-options"><summary aria-label="Más opciones del personaje" ${tip('Más opciones')}>${nextIcon('ellipsis')}</summary><div class="ns-person-panel">${character.identity.playerName?`<p class="next-meta">Jugador: ${escapeNext(character.identity.playerName)}</p>`:""}<form data-next-form="color"><label>Color del personaje<input name="color" type="color" value="${character.color}" ${canPlay(character,interaction)?'':'disabled'}></label><button type="submit" ${canPlay(character,interaction)?'':'disabled'}>Guardar color</button></form>${!interaction.enabled?'<p class="next-meta">Edición disponible en Actual.</p>':''}</div></details></div></div>`;
}

function characterIdentity(character: CharacterV2): string {
  const identity = character.identity;
  const fields = ([
    ['Raza', identity.species], ['Subraza', identity.subrace],
    ['Clase', identity.className], ['Subclase', identity.subclass],
    ['Trasfondo', identity.background], ['Alineación', identity.alignment],
  ] as const).filter(([, value]) => value.trim());
  return `<dl class="ns-identity-fields" aria-label="Identidad del personaje">${fields.map(([label, value]) => `<div tabindex="0" ${tip(label + ': ' + value)}><dt class="ns-sr-only">${label}</dt><dd>${escapeNext(value)}</dd></div>`).join('') || '<div><dt class="ns-sr-only">Identidad</dt><dd>Sin datos de identidad</dd></div>'}</dl>`;
}

export function hitPointPresentation(current: number, maximum: number): { percent: number; color: string } {
  const percent = maximum > 0 ? Math.max(0, Math.min(100, current / maximum * 100)) : 0;
  // Temporary HP never mask damage in the fraction or the card highlight.
  return { percent, color: `hsl(${percent * 1.2} 65% 45%)` };
}

function characterSheetOverview(character: CharacterV2, interaction:SheetInteraction=consultation): string {
  const stats = projectCharacterStatistics(character), origins = projectCharacterStatisticOrigins(character, stats), hp = character.combat.hitPoints;
  const health = hitPointPresentation(hp.current, hp.maximum);
  const vital = (label: string, name: string, icon: NextIcon, value: string, help: string) => `<div class="ns-vital ns-vital-${label.toLowerCase()}" ${label === 'PG' ? `style="--ns-health:${health.color};--ns-hp-percent:${health.percent}%"` : ''} tabindex="0" aria-label="${escapeNext(name)}" ${tip(help)}><span class="ns-vital-label">${nextIcon(icon)}${label}</span><span class="ns-vital-value">${value}</span>${label === 'PG' ? `<span class="ns-hp-meter" role="progressbar" aria-label="Puntos de golpe restantes" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${health.percent}" aria-valuetext="${hp.current} de ${hp.maximum} PG · ${Math.round(health.percent)}%"><span></span></span>` : ''}</div>`;
  const hpHelp = `Puntos de golpe\nMáximos: ${hp.maximum} registrados; origen por nivel sin detallar.\nActuales: ${hp.maximum} máximos − ${hp.maximum - hp.current} PG perdidos = ${hp.current}.${hp.temporary ? `\nTemporales: ${hp.temporary} registrados; origen sin detallar.` : ""}`;
  return `<div class="ns-dashboard"><div class="ns-vitals">${levelControl(character,interaction)}${vital("PG", "Puntos de golpe", "heart", `${hp.current} <small>/ ${hp.maximum}</small>${hp.temporary ? `<small class="ns-temp">+${hp.temporary} temporales</small>` : ""}`, hpHelp)}
  ${vital("CA", "Clase de armadura", "shirt", String(character.combat.armorClass), recorded("Clase de armadura", character.combat.armorClass) + "\nArmadura, escudo y otros aportes no detallados en el registro.")}
  ${vital("INIC", "Iniciativa", "dices", signed(stats.initiativeModifier), explanation("Iniciativa", origins.initiative))}
  ${vital("VEL", "Velocidad", "footprints", escapeNext(character.combat.speed || "—"), recorded("Velocidad", character.combat.speed || "Sin dato") + "\nPuede incluir cambios de clase/equipo ya incorporados al registro.")}</div>
  <div class="ns-context">${characterIdentity(character)}<div class="ns-quick">${inspirationControl(character,interaction)}<span class="ns-rest"><span class="ns-unavailable" tabindex="0" aria-disabled="true" ${tip('Descanso\nDisponible en Actual.')}><span>Descanso</span></span></span><span class="ns-proficiency" tabindex="0" aria-label="Bono de competencia ${signed(stats.proficiencyBonus)}" ${tip(`Bono de competencia\nNivel ${character.identity.level}: 2 + ⌊(nivel − 1) ÷ 4⌋.`)}><span>Competencia</span><strong>${signed(stats.proficiencyBonus)}</strong></span></div>${rollModeControl(character,interaction)}</div></div>`;
}

interface ConditionChoice { key: string; label: string; icon: NextIcon; good: boolean; }
const conditionChoices: ConditionChoice[] = [
  ["haste", "Acelerar", "zap", true], ["bless", "Bendición", "sun", true], ["concentration", "Concentración", "focus", true], ["raging", "Furia", "flame", true], ["guidance", "Guía", "compass", true], ["heroism", "Heroísmo", "swords", true], ["invisible", "Invisible", "circle-dashed", true], ["sanctuary", "Santuario", "church", true],
  ["grappled", "Agarrado", "grab", false], ["exhaustion", "Agotamiento", "battery-low", false], ["restrained", "Apresado", "link", false], ["frightened", "Asustado", "ghost", false], ["stunned", "Aturdido", "orbit", false], ["blinded", "Cegado", "eye-off", false], ["prone", "Derribado", "person-standing", false], ["deafened", "Ensordecido", "ear-off", false], ["poisoned", "Envenenado", "flask-conical", false], ["charmed", "Hechizado", "heart-handshake", false], ["incapacitated", "Incapacitado", "ban", false], ["unconscious", "Inconsciente", "bed", false], ["hex", "Maleficio", "skull", false], ["paralyzed", "Paralizado", "pause", false], ["bane", "Perdición", "cloud-lightning", false], ["petrified", "Petrificado", "gem", false], ["slow", "Ralentizado", "snail", false], ["reloading", "Recargando", "refresh-cw", false],
].map(([key, label, icon, good]) => ({ key: key as string, label: label as string, icon: icon as NextIcon, good: good as boolean }));

function conditions(character: CharacterV2, expanded: boolean): string {
  const active = character.combat.conditions.map(condition => ({ ...conditionChoices.find(choice => choice.key === condition.key), key: condition.key, label: condition.label, level: condition.level }));
  if (character.combat.exhaustion && !active.some(condition => condition.key === "exhaustion")) active.push({ key: "exhaustion", label: "Agotamiento", level: character.combat.exhaustion, icon: "battery-low", good: false });
  const ordered = <T extends { label: string; good?: boolean }>(entries: T[]) => entries.sort((a, b) => Number(!!b.good) - Number(!!a.good) || a.label.localeCompare(b.label, "es"));
  const cell = (condition: { label: string; icon?: NextIcon; good?: boolean; level?: number | null }, selected: boolean) => `<span class="ns-condition ${condition.good ? "ns-good" : "ns-bad"} ${selected ? "ns-condition-active" : ""}" tabindex="0" ${selected ? 'data-next-active-condition="true"' : 'aria-disabled="true"'} aria-label="${escapeNext(condition.label)}${condition.level ? " · " + condition.level : ""}" ${tip(condition.label + (condition.level ? " · " + condition.level : ""))}>${nextIcon(condition.icon ?? "circle-help")}</span>`;
  return `<section class="ns-group ns-conditions"><div class="ns-row"><h3>Condiciones</h3><button type="button" data-next-conditions="${escapeNext(character.id)}" aria-label="${expanded ? "Ocultar" : "Ver"} condiciones disponibles" aria-expanded="${expanded}" aria-controls="next-condition-choices">${nextIcon(expanded ? "chevron-down" : "chevron-right")}</button></div><div class="ns-condition-grid ns-condition-summary">${ordered(active).map(condition => cell(condition, true)).join("") || '<span class="next-meta ns-no-conditions">Sin condiciones activas</span>'}</div><div id="next-condition-choices" ${expanded ? "" : "hidden"}><p class="next-meta">Consulta · activá o quitá condiciones desde Actual.</p><div class="ns-condition-grid">${expanded ? ordered(conditionChoices.filter(choice => !active.some(condition => condition.key === choice.key))).map(choice => cell(choice, false)).join("") : ""}</div></div></section>`;
}

export function characterSheetContent(character: CharacterV2, expandedConditions: boolean,interaction:SheetInteraction=consultation): string {
  const stats = projectCharacterStatistics(character), origins = projectCharacterStatisticOrigins(character, stats);
  const cell = (kind: string, key: string, ability: SaveKey, icon: NextIcon, value: number, name: string, help: string) => {const tag=interaction.enabled?'button':'div';return `<${tag} ${interaction.enabled?`type="button" data-next-play="roll:${kind}/${key}" ${canPlay(character,interaction)?'':'disabled'}`:'tabindex="0"'} class="ns-check ns-${kind}" data-ability="${ability}" data-next-focus="${kind}:${key}" aria-label="${escapeNext(name)} ${signed(value)}" ${tip(help)}>${nextIcon(icon)}<strong>${signed(value)}</strong></${tag}>`;};
  const pairs = abilities.map(key => {
    const label = SAVE_DEFINITIONS[key].label;
    return `<div class="ns-attribute-pair">${cell("ability", key, key, abilityIcons[key], stats.abilityModifiers[key], label,
      `${label} · puntaje ${stats.abilityScores[key]}\n${origins.abilityScores[key].contributions.map(part => `${part.label}: ${part.value}`).join("\n")}\n(${stats.abilityScores[key]} − 10) ÷ 2, redondeado hacia abajo.`)}${cell("save", key, key, "shield-check", stats.savingThrows[key], "Salvación de " + label, explanation("Salvación de " + label, origins.savingThrows[key]))}</div>`;
  }).join("");
  const skills = abilities.flatMap(ability => (Object.keys(SKILL_DEFINITIONS) as SkillKey[]).filter(key => SKILL_DEFINITIONS[key].ability === ability).sort((a, b) => SKILL_DEFINITIONS[a].label.localeCompare(SKILL_DEFINITIONS[b].label, "es"))).map(key => {
    const definition = SKILL_DEFINITIONS[key];
    return cell("skill", key, definition.ability, skillIcons[key], stats.skills[key], definition.label, explanation(definition.label, origins.skills[key]));
  }).join("");
  const passives = (["perception", "investigation", "insight"] as const).map(key => `<div tabindex="0" data-next-focus="passive:${key}" ${tip(explanation(SKILL_DEFINITIONS[key].label + " pasiva", origins.passives[key]))}><dt>${SKILL_DEFINITIONS[key].label}</dt><dd>${nextIcon(skillIcons[key])}<strong>${stats.passives[key]}</strong></dd></div>`).join("");
  const traits = character.traits.flatMap(group => group.traits);
  const resources = traits.filter(trait => trait.uses.maximum > 0).map(trait => `<div class="ns-resource" tabindex="0" ${tip(`${trait.name}\n${trait.uses.maximum} usos máximos registrados\n−${trait.uses.used} usos consumidos\n${trait.description}`)}><span>${nextIcon("sparkles")}${escapeNext(trait.name)}</span><strong>${trait.uses.maximum - trait.uses.used}/${trait.uses.maximum}</strong>${unavailable("Usar " + trait.name, "circle-check")}</div>`).join("");
  const slots = Object.entries(character.spellcasting.slots).filter(([, slot]) => slot.maximum > 0).map(([level, slot]) => `<span tabindex="0" ${tip(`Espacios de nivel ${level}\n${slot.maximum} máximos registrados\n−${slot.used} usados\nDisponibles: ${slot.maximum - slot.used}.`)}>N${level} <strong>${slot.maximum - slot.used}/${slot.maximum}</strong></span>`).join("");
  const proficiencies = ([["weapons", "Armas"], ["armor", "Armaduras"], ["tools", "Herramientas"], ["languages", "Idiomas"]] as const).map(([key, label]) => `<section><h4>${label}</h4><p>${character.proficiencies[key].map(escapeNext).join(" · ") || "Sin registros"}</p></section>`).join("");
  const descriptions = traits.map(trait => `<details data-next-detail="${escapeNext(trait.id)}"><summary>${escapeNext(trait.name)}</summary><p class="next-description">${escapeNext(trait.description || "Sin descripción.")}</p></details>`).join("");
  const death = deathControl(character,interaction);
  return `<div class="next-sheet">${characterSheetOverview(character,interaction)}${conditions(character, expandedConditions)}${death}${group("Características y salvaciones", `<div class="ns-abilities">${pairs}</div>`)}${group("Habilidades", `<div class="ns-skills">${skills}</div>`)}${group("Pasivas", `<dl class="ns-passives">${passives}</dl>`)}${group("Recursos", `${resources || '<p class="next-meta">Sin recursos con contador registrados.</p>'}${slots ? `<div class="ns-slots">${slots}</div>` : ""}<p class="next-meta">${character.combat.hitDice.remaining}/${character.combat.hitDice.maximum} dados de golpe · d${character.combat.hitDice.dieSize}</p>`)}<details data-next-detail="proficiencies"><summary>Competencias e idiomas</summary><div class="ns-competencies">${proficiencies}</div></details>${descriptions ? group("Rasgos", descriptions) : ""}</div>`;
}

/** Columns fill top to bottom; DOM order matches the approved reading order. */
export function updateNextSheetLayout(root: HTMLElement): void {
  const skills = root.querySelector<HTMLElement>(".ns-skills");
  const width = skills?.clientWidth || root.clientWidth || 440;
  const coarse = root.ownerDocument.defaultView?.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (skills) {
    const columns = Math.max(1, Math.min(6, Math.floor((width + 6) / (coarse ? 60 : 56))));
    skills.style.setProperty("--ns-columns", String(columns));
    skills.style.setProperty("--ns-rows", String(Math.ceil(skills.childElementCount / columns)));
  }
  for (const grid of root.querySelectorAll<HTMLElement>(".ns-condition-grid")) {
    const capacity = Math.max(1, Math.min(13, Math.floor(((grid.clientWidth || width) + 4) / (coarse ? 48 : 36))));
    const rows = Math.ceil(conditionChoices.length / capacity), columns = Math.ceil(conditionChoices.length / rows);
    grid.style.setProperty("--ns-columns", String(columns));
    grid.style.setProperty("--ns-rows", String(Math.max(1, Math.ceil(grid.childElementCount / columns))));
  }
}
