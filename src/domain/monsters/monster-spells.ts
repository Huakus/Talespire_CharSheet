import type { MonsterDefinition } from "./monster-catalog";
import type { MonsterSpellcasting } from "./monster-spellcasting-model";
import type { SpellDefinition } from "../character/character-spell-model";
import { PHB_SPELLS } from "../character/phb-spells";
import translations from "../character/spells-es-2014.json";
import { isOldSpell } from "../spells/spell-source";
import { normalizeDiceExpression } from "../dice/dice-expression";
import { increaseMatchingDice } from "../dice/spell-dice";

const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
const aliases = new Map<string, string>();
for (const [key, spell] of Object.entries(PHB_SPELLS)) { aliases.set(normalized(key), key); aliases.set(normalized(spell.name), key); }
for (const [key, spell] of Object.entries(translations)) { aliases.set(normalized(spell.name), key); aliases.set(normalized(spell.englishName), key); }

export function resolveMonsterSpell(name: string, catalog: readonly SpellDefinition[]): { definition: SpellDefinition; key: string | null } | null {
  const key = aliases.get(normalized(name)) ?? null;
  const matches = catalog.filter(s => !isOldSpell(s) && (normalized(s.name) === normalized(name) || (key !== null && aliases.get(normalized(s.name)) === key)));
  const entry = matches.find(s => s.catalog?.origin === "gm") ?? matches.find(s => s.year === "2014") ?? matches[0];
  if (entry) return { definition: entry, key: entry.catalog?.origin === "gm" ? null : key };
  return key && PHB_SPELLS[key] ? { definition: PHB_SPELLS[key]!, key } : null;
}

function uniqueNumber(text: string, expression: RegExp): number | null {
  const values = [...new Set([...text.matchAll(expression)].map(m => Number(m[1])))];
  return values.length === 1 && Number.isSafeInteger(values[0]) ? values[0]! : null;
}
export function monsterSpellcasting(monster: MonsterDefinition): MonsterSpellcasting {
  const text = monster.traits.filter(t => /conjur|spellcast|magia innata|innate/i.test(t.name)).map(t => t.content).join("\n");
  const abilityName = /(?:caracter[ií]stica(?: de (?:conjuraci[oó]n|lanzamiento de conjuros))?(?: es)?(?: la)?|spellcasting ability is)\s*:?\s*(fuerza|destreza|constituci[oó]n|inteligencia|sabidur[ií]a|carisma|strength|dexterity|constitution|intelligence|wisdom|charisma)/i.exec(text)?.[1];
  const abilityAliases: Record<string, NonNullable<MonsterSpellcasting["ability"]>> = { fuerza: "strength", destreza: "dexterity", constitucion: "constitution", inteligencia: "intelligence", sabiduria: "wisdom", carisma: "charisma", strength: "strength", dexterity: "dexterity", constitution: "constitution", intelligence: "intelligence", wisdom: "wisdom", charisma: "charisma" };
  return {
    ability: monster.spellcasting?.ability ?? (abilityName ? abilityAliases[normalized(abilityName)] ?? null : null),
    attackBonus: monster.spellcasting?.attackBonus ?? uniqueNumber(text, /([+-]\d+)\s*(?:al?\s+(?:ataque|impactar)|a\s+impactar|to hit)/gi),
    saveDc: monster.spellcasting?.saveDc ?? uniqueNumber(text, /(?:CD|DC)\s*(\d+)/gi),
    casterLevel: monster.spellcasting?.casterLevel ?? uniqueNumber(text, /(?:lanzador(?:a)?(?: de conjuros)? de nivel|conjurador(?:a)? de nivel|nivel de lanzador\s*:?|spellcaster level\s*:?)\s*(\d+)/gi)
      ?? uniqueNumber(text, /(\d+)(?:st|nd|rd|th)[ -]level spellcaster/gi),
  };
}

export function monsterSpellEffect(monster: MonsterDefinition, spell: SpellDefinition, key: string | null, slotLevel: number): { expression: string | null; warnings: string[]; beams: number } {
  const casting = monsterSpellcasting(monster), warnings: string[] = [];
  let expression = spell.damageExpression;
  const level = casting.casterLevel;
  const steps = level === null ? 0 : level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0;
  const beams = key === "eldritch-blast" ? steps + 1 : 1;
  if (spell.level === 0 && (spell.upcastDamageExpression || key === "eldritch-blast") && level === null) warnings.push("Falta el nivel del lanzador para escalar el truco.");
  if (spell.level === 0 && key !== "eldritch-blast") expression = increaseMatchingDice(expression, spell.upcastDamageExpression, steps);
  else if (slotLevel > spell.level) expression = increaseMatchingDice(expression, spell.upcastDamageExpression, slotLevel - spell.level);
  if (spell.addAbilityModifier && expression) {
    const short = { strength: "Str", dexterity: "Dex", constitution: "Con", intelligence: "Int", wisdom: "Wis", charisma: "Cha" };
    const score = casting.ability ? monster.abilities[short[casting.ability]] : undefined;
    if (score === undefined) warnings.push("Falta la característica de conjuración para sumar su modificador.");
    else { const modifier = Math.floor((score - 10) / 2); if (modifier) expression += modifier >= 0 ? `+${modifier}` : String(modifier); }
  }
  if (!expression) return { expression: null, warnings, beams };
  try { expression = normalizeDiceExpression(expression); }
  catch { warnings.push("Los dados del efecto no tienen una expresión automatizable. Consultá el texto."); }
  return { expression: warnings.length ? null : expression, warnings, beams };
}
