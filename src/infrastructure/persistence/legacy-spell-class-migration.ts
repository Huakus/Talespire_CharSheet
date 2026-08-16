import { cloneJson, type JsonObject } from "../../shared/json";

const LEGACY_CLASS_KEYS: Record<string, string> = {
  artificer: "artificer", artifice: "artificer",
  bard: "bard", bardo: "bard",
  warlock: "warlock", brujo: "warlock", bruijo: "warlock",
  cleric: "cleric", clerigo: "cleric",
  druid: "druid", druida: "druid",
  ranger: "ranger", explorador: "ranger",
  sorcerer: "sorcerer", hechicero: "sorcerer",
  wizard: "wizard", mago: "wizard",
  paladin: "paladin",
};

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function normalized(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function migratedClasses(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;
  return [...new Set(value.split(/[,;]+/).map((entry) => {
    const key = normalized(entry);
    return LEGACY_CLASS_KEYS[key] ?? key;
  }).filter(Boolean))];
}

export function migrateLegacyCharacterSpellClasses(input: JsonObject): JsonObject {
  const spell = cloneJson(input);
  const definition = object(spell.definition);
  if (definition && typeof definition.classes === "string") definition.classes = migratedClasses(definition.classes) as JsonObject["classes"];
  return spell;
}

export function migrateLegacyCampaignSpellClasses(input: JsonObject): JsonObject {
  const campaign = cloneJson(input);
  const characters = object(campaign.characters);
  if (!characters) return campaign;
  for (const characterValue of Object.values(characters)) {
    const character = object(characterValue);
    const spellcasting = object(character?.spellcasting);
    if (!spellcasting || !Array.isArray(spellcasting.spells)) continue;
    spellcasting.spells = spellcasting.spells.map((spell) => {
      const value = object(spell);
      return value ? migrateLegacyCharacterSpellClasses(value) : spell;
    });
  }
  return campaign;
}
