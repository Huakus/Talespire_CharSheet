import type { MonsterDefinition } from "../domain/monsters/monster-catalog";
import type { SpellDefinition } from "../domain/character/character-spell-model";
import { monsterSpellcasting, monsterSpellEffect, resolveMonsterSpell } from "../domain/monsters/monster-spells";
import { monsterDiceExpressions } from "../domain/monsters/monster-audit";
import { editorEscape as escape } from "./gm-content-editors";

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
const saves: Record<string, string> = { strength: "Fuerza", dexterity: "Destreza", constitution: "Constitución", intelligence: "Inteligencia", wisdom: "Sabiduría", charisma: "Carisma" };
export function renderMonsterSpellRolls(monster: MonsterDefinition, spell: SpellDefinition, key: string | null, slotLevel: number, actor: string): string {
  const casting = monsterSpellcasting(monster), effect = monsterSpellEffect(monster, spell, key, slotLevel);
  const button = (label: string, expression: string) => `<button type="button" class="gm-roll" data-roll-name="${escape(actor)} · ${escape(spell.name)} · ${label}" data-roll-expression="${escape(expression)}">${label} <strong>${escape(expression)}</strong></button>`;
  const missing: string[] = [...effect.warnings];
  const attack = spell.attackType === "attack"
    ? casting.attackBonus === null ? (missing.push("Falta el bono de ataque de conjuro del monstruo."), "") : button(effect.beams > 1 ? "Ataque por rayo" : "Ataque", `1d20${signed(casting.attackBonus)}`)
    : "";
  const save = spell.attackType === "save" ? `<span class="gm-spell-save ${casting.saveDc === null ? "needs-initiative" : ""}">CD ${casting.saveDc ?? "pendiente"} · ${escape(saves[spell.saveAbility] ?? (spell.saveAbility || "salvación del objetivo"))}</span>` : "";
  if (spell.attackType === "save" && casting.saveDc === null) missing.push("Falta la CD de conjuros del monstruo.");
  const extras = !spell.damageExpression ? monsterDiceExpressions(spell.description).filter(expression => !/^1d20/i.test(expression)).map(expression => button("Dados del texto", expression)).join("") : "";
  return `<div class="gm-monster-spell-rolls">${attack}${save}${effect.expression ? button(effect.beams > 1 ? "Daño por rayo" : /heal|curaci/i.test(spell.damageType) ? "Curación" : "Daño / efecto", effect.expression) : ""}${extras}${effect.beams > 1 ? `<small>${effect.beams} rayos; tirá ataque y daño para cada uno.</small>` : ""}</div>${missing.length ? `<div class="gm-spell-missing"><p>${escape(missing.join(" "))}</p><button type="button" data-action="edit-encounter-monster">Configurar conjuración</button></div>` : ""}`;
}

export function renderMonsterSpellCards(monster: MonsterDefinition, catalog: readonly SpellDefinition[], actor = monster.name, scope = monster.id, getLevel?: (name: string) => number | undefined): string {
  if (!monster.spells.length) return "";
  return `<section class="gm-monster-spells" data-monster-profile="${escape(monster.id)}"><strong>Conjuros</strong>${monster.spells.map(name => {
    const resolved = resolveMonsterSpell(name, catalog);
    if (!resolved) return `<article class="gm-monster-spell-card gm-spell-missing"><strong>${escape(name)}</strong><p>No se encontró una ficha de este conjuro. Asociá una entrada del catálogo para consultar sus reglas y tiradas.</p><button type="button" data-action="edit-encounter-monster">Editar conjuros</button></article>`;
    const spell = resolved.definition;
    const level = Math.max(spell.level, Math.min(9, getLevel?.(name) ?? spell.level));
    const metadata = [spell.castingTime, spell.range, spell.duration, spell.components, spell.ritual ? "Ritual" : "", spell.concentration ? "Concentración" : ""].filter(Boolean).map(escape).join(" · ");
    return `<article class="gm-monster-spell-card" data-monster-profile="${escape(monster.id)}" data-monster-spell="${escape(name)}" data-spell-scope="${escape(scope)}" data-spell-actor="${escape(actor)}"><header><strong>${escape(spell.name)}</strong><small>${spell.level ? `Nivel ${spell.level}` : "Truco"} · ${escape(spell.school)}</small></header><p class="gm-monster-spell-meta">${metadata}</p>
      ${spell.level > 0 && (spell.upcastDamageExpression || spell.higherLevels) ? `<label class="gm-spell-level-control">Lanzar a nivel<select data-monster-spell-level>${Array.from({ length: 10 - spell.level }, (_, i) => `<option value="${spell.level + i}" ${spell.level + i === level ? "selected" : ""}>${spell.level + i}</option>`).join("")}</select></label>` : ""}
      <div data-monster-spell-output>${renderMonsterSpellRolls(monster, spell, resolved.key, level, actor)}</div>
      <details class="gm-spell-rules"><summary>Reglas y descripción</summary>${spell.material ? `<p><b>Material:</b> ${escape(spell.material)}</p>` : ""}<p>${escape(spell.description)}</p>${spell.higherLevels ? `<p><b>A niveles superiores:</b> ${escape(spell.higherLevels)}</p>` : ""}</details></article>`;
  }).join("")}<small class="field-help">Usos, espacios, objetivos y concentración se resuelven según la ficha de la criatura; estas tiradas no gastan recursos automáticamente.</small></section>`;
}
