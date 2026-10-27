import { normalizeMonsterDefinition } from "./monster-catalog";
import { parseMonsterChecks } from "./monster-checks";

export interface MonsterAuditIssue { field: string; code: string; detail: string }
export function auditMonsterDefinition(raw: unknown): MonsterAuditIssue[] {
  const m = normalizeMonsterDefinition(raw), issues: MonsterAuditIssue[] = [];
  const add = (field: string, code: string, detail: string) => issues.push({ field, code, detail });
  for (const [field, n] of [["armorClass", m.armorClass], ["hitPoints", m.hitPoints]] as const) if (!Number.isSafeInteger(n) || n <= 0) add(field, "nonpositive-stat", "Comprobar el valor contra el original; no se infiere un reemplazo.");
  for (const [key, score] of Object.entries(m.abilities)) if (!Number.isSafeInteger(score) || score < 1 || score > 30) add(`abilities.${key}`, "ability-range", `Puntuación ${score} fuera del intervalo habitual 1–30.`);
  if (m.hitPointFormula) {
    const match = /^(\d+)d(\d+)(?:\s*[+-]\s*\d+)?$/i.exec(m.hitPointFormula);
    if (!match || ![4, 6, 8, 10, 12, 20].includes(Number(match[2]))) add("hitPointFormula", "hp-formula", `Fórmula a cotejar: ${m.hitPointFormula}`);
  }
  for (const section of ["traits", "actions", "reactions", "legendaryActions"] as const) {
    for (const [i, feature] of m[section].entries()) {
      if (!feature.name.trim()) add(`${section}.${i}`, "unnamed-feature", "Hay contenido sin nombre de rasgo o acción.");
      if (!feature.content.trim() && feature.name.trim()) add(`${section}.${i}`, "possible-split-paragraph", `Entrada sin descripción: ${feature.name}`);
      if (/^\s*(?:si |cuando |durante |obtiene |inflige |daño |if |when |during |deals |takes )/i.test(feature.name)) add(`${section}.${i}`, "sentence-as-name", "El nombre parece una continuación de texto. Requiere cotejo, no agrupación automática.");
    }
  }
  for (const kind of ["saves", "skills"] as const) for (const value of parseMonsterChecks(m[kind], kind).unparsed) add(kind, "unparsed-check", value);
  return issues;
}

/** Recognize explicit attack bonuses without interpreting damage or save DC as attacks. */
export function monsterDiceExpressions(content: string): string[] {
  const expressions = [...new Set((content.match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?/gi) ?? []).map(s => s.replace(/\s/g, "")))];
  const attack = /(?:\b(?:ataque|attack)\s*:\s*([+-]?\d+)(?!\d*d)|([+-]\s*\d+)\s+(?:al?\s+(?:ataque|impacto|impactar)|a\s+impactar|to\s+hit))/i.exec(content);
  const bonus = attack?.[1] ?? attack?.[2];
  if (bonus && !expressions.some(s => /^1d20(?:[+-]|$)/i.test(s))) {
    const n = Number(bonus.replace(/\s/g, ""));
    if (Number.isSafeInteger(n)) expressions.unshift(`1d20${n >= 0 ? "+" : ""}${n}`);
  }
  return expressions;
}
