import type { MonsterDefinition } from "../domain/monsters/monster-catalog";
import { MONSTER_SAVES, monsterSavingThrow } from "../domain/monsters/monster-checks";
import { monsterDiceExpressions } from "../domain/monsters/monster-audit";
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
export function combatModifierStyle(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  const strength = Math.min(1, Math.abs(value) / 10);
  const tone = value > 0 ? [65, 205, 100] : [245, 85, 90];
  const lightTone = value > 0 ? [16, 120, 45] : [185, 30, 40];
  const blend = (end: number[]) => [217, 189, 115].map((neutral, i) => Math.round(neutral + (end[i]! - neutral) * strength)).join(",");
  return `--check-tone:rgb(${tone.join(",")});--check-light-tone:rgb(${lightTone.join(",")});--check-strength:${strength * 100}%;--check-text:rgb(${blend(tone)});--check-light-text:rgb(${blend(lightTone)})`;
}
export function renderMonsterAbilitySaves(monster: MonsterDefinition, displayName = monster.name): string {
  return `<span class="gm-monster-ability-saves">${MONSTER_SAVES.map((d, i) => {
    const key = ["Str", "Dex", "Con", "Int", "Wis", "Cha"][i]!;
    const label = ["FUE", "DES", "CON", "INT", "SAB", "CAR"][i]!;
    const score = monster.abilities[key] ?? 10, modifier = Math.floor((score - 10) / 2), save = monsterSavingThrow(monster, d.key);
    return `<span class="gm-ability-save-pair"><button type="button" class="gm-roll gm-stat-roll" data-check-value="${modifier}" style="${combatModifierStyle(modifier)}" data-roll-name="${escape(displayName)} · ${label}" data-roll-expression="1d20${signed(modifier)}" title="Prueba de ${d.label}"><small>${label}</small><strong>${score}</strong><em class="gm-modifier-value">${signed(modifier)}</em></button><button type="button" class="gm-roll gm-save-roll gm-stat-roll" data-check-value="${save}" style="${combatModifierStyle(save)}" data-roll-name="${escape(displayName)} · Salvación de ${escape(d.label)}" data-roll-expression="1d20${signed(save)}" title="Salvación de ${d.label}: ${signed(save)}" aria-label="Salvación de ${escape(d.label)}: ${signed(save)}"><span class="gm-modifier-value">${signed(save)}</span></button></span>`;
  }).join("")}</span>`;
}
export function renderMonsterDefensesSummary(monster: MonsterDefinition): string {
  const groups = [["Vulnerable", "vulnerable", monster.damageVulnerabilities], ["Resiste", "resistant", monster.damageResistances], ["Inmune", "immune", monster.damageImmunities], ["Inmune a", "immune-condition", monster.conditionImmunities]] as const;
  return `<span class="gm-defense-summary">${groups.filter(([, , values]) => values.length).map(([label, tone, values]) => `<span class="gm-defense-chip ${tone}"><b>${label}</b> ${escape(values.join(", "))}</span>`).join("")}</span>`;
}
export function renderMonsterActionShortcuts(monster: MonsterDefinition, displayName = monster.name): string {
  return `<span class="gm-action-shortcuts">${monster.actions.map(action => {
    const dice = monsterDiceExpressions(action.content);
    return `<span class="gm-action-shortcut"><b title="${escape(action.content)}">${escape(action.name || "Acción")}</b>${dice.map(expression => `<button type="button" class="gm-roll" data-roll-name="${escape(displayName)} · ${escape(action.name)}" data-roll-expression="${escape(expression)}" title="${/^1d20/i.test(expression) ? "Ataque" : "Daño / efecto"}">${/^1d20/i.test(expression) ? "ATQ " : ""}${escape(expression)}</button>`).join("")}</span>`;
  }).join("")}</span>`;
}
