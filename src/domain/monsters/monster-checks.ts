import { SAVE_DEFINITIONS, SKILL_DEFINITIONS } from "../character/character-checks";
import type { MonsterDefinition } from "./monster-catalog";

export const MONSTER_SAVES = Object.entries(SAVE_DEFINITIONS).map(([key, value], i) => ({ key, label: value.label, aliases: [["FUE", "STR"], ["DES", "DEX"], ["CON"], ["INT"], ["SAB", "WIS"], ["CAR", "CHA"]][i]! }));
export const MONSTER_SKILLS = Object.entries(SKILL_DEFINITIONS).map(([key, value]) => ({ key, label: value.label, aliases: key === "arcana" ? ["Conocimiento arcano", "C. Arcano"] : [] }));
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f\s_-]/g, "").toLowerCase();
export interface MonsterCheckValues { bonuses: Record<string, number>; unparsed: string[] }

/** Parse only an unambiguous label and integer bonus. Unknown rules stay intact. */
export function parseMonsterChecks(values: string[], kind: "saves" | "skills"): MonsterCheckValues {
  const definitions = kind === "saves" ? MONSTER_SAVES : MONSTER_SKILLS;
  const result: MonsterCheckValues = { bonuses: {}, unparsed: [] };
  for (const source of values) for (const entry of source.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)) {
    const bonusText = entry.replace(/^(.+?)\s+1d20\s*([+-]\s*\d+)$/i, "$1 $2");
    const match = /^(.+?)\s*:?\s*([+-]?\s*\d+)$/.exec(bonusText);
    const definition = match && definitions.find(d => [d.key, d.label, ...d.aliases].some(alias => normalize(alias) === normalize(match[1]!)));
    const bonus = match ? Number(match[2]!.replace(/\s/g, "")) : NaN;
    if (!definition || !Number.isSafeInteger(bonus) || result.bonuses[definition.key] !== undefined && result.bonuses[definition.key] !== bonus) result.unparsed.push(entry);
    else result.bonuses[definition.key] = bonus;
  }
  return result;
}

export function monsterSavingThrow(monster: MonsterDefinition, key: string): number {
  const values = parseMonsterChecks(monster.saves, "saves");
  const definition = MONSTER_SAVES.find(d => d.key === key)!;
  const score = Object.entries(monster.abilities).find(([name]) => [key, ...definition.aliases].some(alias => normalize(alias) === normalize(name)))?.[1] ?? 10;
  return values.bonuses[key] ?? Math.floor((score - 10) / 2);
}

/** Explicit passive scores take precedence; otherwise use the listed skill bonus or its real ability score. */
export function monsterPassiveChecks(monster: MonsterDefinition): Record<"perception" | "investigation" | "insight", number | null> {
  const checks = parseMonsterChecks(monster.skills, "skills"), skills = checks.bonuses;
  const senses = monster.senses.join("; ").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const passive = (key: "perception" | "investigation" | "insight", spanish: string, ability: "Wis" | "Int"): number | null => {
    const pattern = new RegExp(`(?:${spanish}\\s+pasiva|passive\\s+${key})\\s*:?\\s*([+-]?\\d+)\\b`, "gi");
    const matches = [...new Set([...senses.matchAll(pattern)].map(match => Number(match[1])))];
    if (matches.length) return matches.length === 1 ? matches[0]! : null;
    if (checks.unparsed.some(entry => parseMonsterChecks([entry], "skills").bonuses[key] !== undefined)) return null;
    if (skills[key] !== undefined) return 10 + skills[key]!;
    const score = monster.abilities[ability];
    return score === undefined ? null : 10 + Math.floor((score - 10) / 2);
  };
  return { perception: passive("perception", "percepcion", "Wis"), investigation: passive("investigation", "investigacion", "Int"), insight: passive("insight", "perspicacia", "Wis") };
}

export function serializeMonsterChecks(bonuses: Record<string, number>, unknown: string[], kind: "saves" | "skills"): string[] {
  const definitions = kind === "saves" ? MONSTER_SAVES : MONSTER_SKILLS;
  return [...definitions.filter(d => bonuses[d.key] !== undefined).map(d => `${d.label} ${bonuses[d.key]! >= 0 ? "+" : ""}${bonuses[d.key]}`), ...unknown];
}
