import {
  SpellDefinitionSchema,
  type SpellDefinition,
} from "../character/character-spell-model";
import { cloneJson, type JsonObject, type JsonValue } from "../../shared/json";

export const SPELL_SCHOOLS = [
  "Abjuración", "Adivinación", "Conjuración", "Encantamiento",
  "Evocación", "Ilusión", "Nigromancia", "Transmutación",
] as const;
export const SPELL_COMPONENTS = ["V", "S", "M"] as const;
export const SPELL_CLASSES = [
  "Artífice", "Bardo", "Brujo", "Clérigo", "Druida", "Explorador",
  "Hechicero", "Mago", "Paladín",
] as const;
export const SPELL_SAVE_ABILITIES = ["", "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;

function object(value: unknown): JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === "object"
    ? cloneJson(value as JsonObject)
    : {};
}

function text(value: JsonValue | undefined): string {
  return value === undefined || value === null ? "" : String(value);
}

function normalizedKey(value: unknown): string {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

const SPELL_CLASS_LABELS: Record<string, string> = {
  artificer: "Artífice", artifice: "Artífice",
  bard: "Bardo", bardo: "Bardo",
  warlock: "Brujo", brujo: "Brujo",
  cleric: "Clérigo", clerigo: "Clérigo",
  druid: "Druida", druida: "Druida",
  ranger: "Explorador", explorador: "Explorador",
  sorcerer: "Hechicero", hechicero: "Hechicero",
  wizard: "Mago", mago: "Mago",
  paladin: "Paladín",
  "ritual caster": "Lanzador de rituales", "lanzador de rituales": "Lanzador de rituales",
};

const SPELL_CLASS_KEYS: Record<string, string> = {
  artifice: "artificer", artificer: "artificer",
  bardo: "bard", bard: "bard",
  brujo: "warlock", warlock: "warlock",
  clerigo: "cleric", cleric: "cleric",
  druida: "druid", druid: "druid",
  explorador: "ranger", ranger: "ranger",
  hechicero: "sorcerer", sorcerer: "sorcerer",
  mago: "wizard", wizard: "wizard",
  paladin: "paladin",
  "lanzador de rituales": "ritual-caster", "ritual caster": "ritual-caster", "ritual-caster": "ritual-caster",
};

const SPELL_SCHOOL_LABELS: Record<string, string> = {
  abjuration: "Abjuración", abjuracion: "Abjuración",
  divination: "Adivinación", adivinacion: "Adivinación", divinativo: "Adivinación",
  conjuration: "Conjuración", conjuracion: "Conjuración",
  enchantment: "Encantamiento", encantamiento: "Encantamiento", encanten: "Encantamiento",
  evocation: "Evocación", evocacion: "Evocación",
  illusion: "Ilusión", ilusion: "Ilusión",
  necromancy: "Nigromancia", necromancia: "Nigromancia", nigromancia: "Nigromancia",
  transmutation: "Transmutación", transmutacion: "Transmutación",
};

const SPELL_SCHOOL_KEYS: Record<string, string> = {
  abjuracion: "abjuration",
  adivinacion: "divination",
  conjuracion: "conjuration",
  encantamiento: "enchantment",
  evocacion: "evocation",
  ilusion: "illusion",
  nigromancia: "necromancy",
  transmutacion: "transmutation",
};

const SPELL_DAMAGE_TYPE_LABELS: Record<string, string> = {
  acid: "Ácido", acido: "Ácido",
  bludgeoning: "Contundente", blundgeoning: "Contundente", contundente: "Contundente",
  cold: "Frío", frio: "Frío",
  fire: "Fuego", fuego: "Fuego",
  force: "Fuerza", fuerza: "Fuerza",
  lightning: "Rayo", rayo: "Rayo", relampago: "Rayo",
  necrotic: "Necrótico", necrotico: "Necrótico",
  piercing: "Perforante", perforante: "Perforante",
  poison: "Veneno", posion: "Veneno", veneno: "Veneno",
  psychic: "Psíquico", psiquico: "Psíquico",
  radiant: "Radiante", radiante: "Radiante",
  slashing: "Cortante", cortante: "Cortante",
  thunder: "Trueno", trueno: "Trueno",
  healing: "Curación", curacion: "Curación",
  choice: "A elección", aleatorio: "Aleatorio", random: "Aleatorio",
};

export function spellClassNames(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  const names = entries.flatMap((entry) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const source = entry as Record<string, unknown>;
      return [String(source.name ?? source.Name ?? source.index ?? "")];
    }
    return String(entry ?? "").split(/[,;]+/);
  }).map((entry) => entry.trim()).filter(Boolean).map((name) => SPELL_CLASS_LABELS[normalizedKey(name)] ?? name);
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normalizedKey(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function spellClassKeys(value: unknown): string[] {
  return spellClassNames(value).map((name) => SPELL_CLASS_KEYS[normalizedKey(name)] ?? name);
}

export function spellComponentNames(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : String(value ?? "").split(/[,;\s]+/);
  return [...new Set(entries.map((entry) => String(entry).trim().toUpperCase()).filter((entry) => SPELL_COMPONENTS.includes(entry as typeof SPELL_COMPONENTS[number])))];
}

export function spellSchoolName(value: unknown): string {
  const name = String(value ?? "").trim();
  return SPELL_SCHOOL_LABELS[normalizedKey(name)] ?? name;
}

export function spellSchoolKey(value: unknown): string {
  return SPELL_SCHOOL_KEYS[normalizedKey(spellSchoolName(value))] ?? String(value ?? "").trim();
}

export function spellDamageTypeName(value: unknown): string {
  const entries = Array.isArray(value) ? value : String(value ?? "").split(/[\/;,]+/);
  return entries.map((part) => {
    const name = part.trim();
    return SPELL_DAMAGE_TYPE_LABELS[normalizedKey(name)] ?? name;
  }).filter(Boolean).join("/");
}

export function spellDamageTypeKeys(value: unknown): string[] {
  const names = spellDamageTypeName(value).split("/").map((entry) => entry.trim()).filter(Boolean);
  const aliases: Record<string, string> = {
    acido: "acid", contundente: "bludgeoning", frio: "cold", fuego: "fire", fuerza: "force",
    rayo: "lightning", necrotico: "necrotic", perforante: "piercing", veneno: "poison",
    psiquico: "psychic", radiante: "radiant", cortante: "slashing", trueno: "thunder",
    curacion: "healing", "a eleccion": "choice", aleatorio: "random",
  };
  return [...new Set(names.map((name) => aliases[normalizedKey(name)] ?? normalizedKey(name)).filter(Boolean))];
}

function spellRitual(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = normalizedKey(value);
  return ["yes", "true", "si", "ritual", "r"].includes(normalized) || /(^|[^a-z])r([^a-z]|$)/i.test(normalized);
}

function legacyCastingTime(value: unknown): { castingTime: string; ritual: boolean } {
  const castingTime = String(value ?? "").trim();
  const ritual = /(?:^|,)\s*r\s*$/i.test(castingTime);
  return { castingTime: ritual ? castingTime.replace(/(?:^|,)\s*r\s*$/i, "").trim() : castingTime, ritual };
}

export function spellLevelNumber(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === "cantrip" || normalized === "truco") return 0;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) ? Math.min(9, Math.max(0, parsed)) : 0;
}

export function normalizeSpellDefinition(input: unknown): SpellDefinition {
  const normalized = SpellDefinitionSchema.safeParse(input);
  if (normalized.success) return {
    ...normalized.data,
    school: spellSchoolName(normalized.data.school),
    classes: spellClassNames(normalized.data.classes).join(", "),
    damageType: spellDamageTypeName(normalized.data.damageType),
  };
  const data = object(input);
  const attackRaw = text(data.toHitOrDC).toLowerCase();
  const casting = legacyCastingTime(data.castingTime ?? data.casting_time);
  const explicitAttackType = text(data.attackType);
  const attackType = ["attack", "save", "none"].includes(explicitAttackType)
    ? explicitAttackType as SpellDefinition["attackType"]
    : attackRaw.includes("hit") || attackRaw.includes("golpear")
    ? "attack"
    : attackRaw.includes("dc") || attackRaw.includes("cd")
      ? "save"
      : "none";
  return SpellDefinitionSchema.parse({
    name: text(data.name).trim(),
    level: spellLevelNumber(text(data.level)),
    description: text(data.desc ?? data.description),
    higherLevels: text(data.higherLevels ?? data.higher_level),
    range: text(data.range),
    components: spellComponentNames(data.components).join(", "),
    material: text(data.material),
    ritual: data.ritual === undefined ? casting.ritual : spellRitual(data.ritual),
    duration: text(data.duration),
    concentration: ["yes", "true", "sí", "si"].includes(text(data.concentration).toLowerCase()),
    castingTime: casting.castingTime,
    school: spellSchoolName(data.school),
    classes: spellClassNames(data.classes ?? data.class).join(", "),
    attackType,
    saveAbility: text(data.saveAbility ?? data.spell_save_dc_type),
    damageExpression: text(data.damageExpression ?? data.damage_dice),
    upcastDamageExpression: text(data.upcastDamageExpression ?? data.damage_dice_upcast),
    addAbilityModifier: typeof data.addAbilityModifier === "boolean"
      ? data.addAbilityModifier
      : ["yes", "true", "sí", "si"].includes(text(data.ability_modifier).toLowerCase()),
    damageType: spellDamageTypeName(data.damageTypes ?? data.damageType ?? data.damage_type_01),
    year: text(data.year || "2014"),
  });
}
