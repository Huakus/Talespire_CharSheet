import englishMonsters from "../../../Monster_Manual-eng.json";
import spanishMonsters from "../../../Monster_Manual-es.json";
import { CharacterInventoryItemV2Schema, type CharacterInventoryItemV2 } from "../character/character-inventory-model";
import { normalizeEquipmentDefinition } from "../equipment/equipment-catalog";
import { cloneJson, type JsonObject } from "../../shared/json";

const monsters = [
  ...Object.values(englishMonsters as Record<string, unknown>),
  ...Object.values(spanishMonsters as Record<string, unknown>),
].filter((value): value is JsonObject => value !== null && !Array.isArray(value) && typeof value === "object")
  .map(cloneJson);

export interface MonsterFeature {
  name: string;
  content: string;
  usage: string;
}

export interface MonsterDefinition {
  id: string;
  name: string;
  type: string;
  size?: string;
  alignment?: string;
  challenge: string;
  armorClass: number;
  hitPoints: number;
  hitPointFormula: string;
  initiativeModifier: number;
  initiativeAdvantage: boolean;
  speed: string[];
  abilities: Record<string, number>;
  saves: string[];
  skills: string[];
  senses: string[];
  languages: string[];
  damageVulnerabilities: string[];
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
  traits: MonsterFeature[];
  actions: MonsterFeature[];
  reactions: MonsterFeature[];
  legendaryActions: MonsterFeature[];
  spells: string[];
  inventory: CharacterInventoryItemV2[];
  legacyData: JsonObject;
}

export const MONSTER_TYPES = [
  "Aberración", "Bestia", "Celestial", "Constructo", "Dragón", "Elemental",
  "Feérico", "Gigante", "Humanoide", "Limo", "Monstruosidad", "No muerto",
  "Planta", "Infernal",
] as const;
export const MONSTER_SIZES = ["Diminuto", "Pequeño", "Mediano", "Grande", "Enorme", "Gargantuesco"] as const;
export const CHALLENGE_RATINGS = [
  "0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21",
  "22", "23", "24", "25", "26", "27", "28", "29", "30",
] as const;

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function integer(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function boolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function features(value: unknown): MonsterFeature[] {
  return Array.isArray(value) ? value.flatMap((entry) => {
    const data = object(entry);
    const name = String(data.Name ?? data.name ?? "").trim();
    const content = String(data.Content ?? data.content ?? "").trim();
    return name || content ? [{ name, content, usage: String(data.Usage ?? data.usage ?? "").trim() }] : [];
  }) : [];
}

function quickActions(value: unknown): MonsterFeature[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const data = object(entry);
    const name = String(data.Name ?? data.name ?? "").trim();
    const toHit = String(data.ToHit ?? data.toHit ?? "").trim();
    const damage = String(data.Damage ?? data.damage ?? "").trim();
    const damageType = String(data.DamageType ?? data.damageType ?? "").trim();
    const parts = [toHit ? `Ataque: ${toHit}` : "", damage ? `Daño: ${damage}${damageType ? ` ${damageType}` : ""}` : ""].filter(Boolean);
    return name || parts.length ? [{ name, content: parts.join(" · "), usage: "" }] : [];
  });
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string" || typeof entry === "number") return [String(entry)];
    const data = object(entry);
    const name = String(data.Name ?? data.name ?? "").trim();
    const detail = String(data.Value ?? data.value ?? data.Modifier ?? data.modifier ?? "").trim();
    return name || detail ? [`${name}${name && detail ? " " : ""}${detail}`] : [];
  }).filter(Boolean);
}

function stableInventoryId(value: string): string {
  const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (const character of value) for (let index = 0; index < hashes.length; index += 1) {
    hashes[index] = Math.imul(hashes[index]! ^ (character.charCodeAt(0) + index * 31), 0x01000193) >>> 0;
  }
  return `inv_${hashes.map((hash) => hash.toString(16).padStart(8, "0")).join("")}`;
}

function inventory(value: unknown, owner: string): CharacterInventoryItemV2[] {
  if (!Array.isArray(value)) return [];
  const parsed: CharacterInventoryItemV2[] = [];
  const legacy = new Map<string, { name: string; quantity: number }>();
  for (const entry of value) {
    const structured = CharacterInventoryItemV2Schema.safeParse(entry);
    if (structured.success) {
      parsed.push(structured.data);
      continue;
    }
    const name = typeof entry === "string" || typeof entry === "number"
      ? String(entry).trim()
      : String(object(entry).Name ?? object(entry).name ?? "").trim();
    if (!name) continue;
    const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    const current = legacy.get(key);
    if (current) current.quantity += 1;
    else legacy.set(key, { name, quantity: 1 });
  }
  for (const entry of legacy.values()) {
    const { rarity: _rarity, ...draft } = normalizeEquipmentDefinition({ name: entry.name, category: "adventuring-gear" });
    parsed.push({ ...draft, id: stableInventoryId(`${owner}:${entry.name}:${parsed.length}`), order: parsed.length, group: "backpack", quantity: entry.quantity });
  }
  return parsed.map((item, order) => ({ ...item, order }));
}

function inferredSize(type: string): string {
  const normalized = type.toLocaleLowerCase();
  return ["Diminuto", "Pequeño", "Mediano", "Grande", "Enorme", "Gargantuesco", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]
    .find((size) => normalized.includes(size.toLocaleLowerCase())) ?? "";
}

function inferredAlignment(type: string): string {
  return type.includes(",") ? type.slice(type.indexOf(",") + 1).trim() : "";
}

function mergedActions(source: JsonObject): MonsterFeature[] {
  const complete = features(source.Actions ?? source.actions);
  const completeNames = new Set(complete.map((entry) => entry.name.trim().toLocaleLowerCase()).filter(Boolean));
  return [...complete, ...quickActions(source.QuickAction ?? source.quickAction).filter((entry) => !completeNames.has(entry.name.trim().toLocaleLowerCase()))];
}

export function normalizeMonsterDefinition(value: unknown): MonsterDefinition {
  const source = object(value);
  const hp = object(source.HP ?? source.hp);
  const ac = object(source.AC ?? source.ac);
  const abilityData = object(source.Abilities ?? source.abilities);
  const type = String(source.Type ?? source.type ?? "").trim();
  return {
    id: String(source.Id ?? source.id ?? source.Name ?? source.name ?? "").trim(),
    name: String(source.Name ?? source.name ?? "").trim(),
    type,
    size: String(source.Size ?? source.size ?? "").trim() || inferredSize(type),
    alignment: String(source.Alignment ?? source.alignment ?? "").trim() || inferredAlignment(type),
    challenge: String(source.Challenge ?? source.challenge ?? source.CR ?? source.cr ?? "").trim(),
    armorClass: integer(ac.Value ?? ac.value ?? source.armorClass ?? source.AC ?? source.ac),
    hitPoints: Math.max(0, integer(hp.Value ?? hp.value ?? source.hitPoints ?? source.HP ?? source.hp)),
    hitPointFormula: String(hp.Notes ?? hp.notes ?? source.hitPointFormula ?? "").replace(/[()]/g, "").trim(),
    initiativeModifier: integer(source.InitiativeModifier ?? source.initiativeModifier),
    initiativeAdvantage: boolean(source.InitiativeAdvantage ?? source.initiativeAdvantage),
    speed: strings(source.Speed ?? source.speed),
    abilities: Object.fromEntries(Object.entries(abilityData).map(([key, score]) => [key, integer(score)])),
    saves: strings(source.Saves ?? source.saves),
    skills: strings(source.Skills ?? source.skills),
    senses: strings(source.Senses ?? source.senses),
    languages: strings(source.Languages ?? source.languages),
    damageVulnerabilities: strings(source.DamageVulnerabilities ?? source.damageVulnerabilities),
    damageResistances: strings(source.DamageResistances ?? source.damageResistances),
    damageImmunities: strings(source.DamageImmunities ?? source.damageImmunities),
    conditionImmunities: strings(source.ConditionImmunities ?? source.conditionImmunities),
    traits: features(source.Traits ?? source.traits),
    actions: mergedActions(source),
    reactions: features(source.Reactions ?? source.reactions),
    legendaryActions: features(source.LegendaryActions ?? source.legendaryActions),
    spells: strings(source.Spells ?? source.spells),
    inventory: inventory(source.Inventory ?? source.inventory, String(source.Id ?? source.id ?? source.Name ?? source.name ?? "monster")),
    legacyData: cloneJson(source),
  };
}

const definitions = monsters.map(normalizeMonsterDefinition).filter((monster) => monster.name);

export function allMonsterNames(): readonly string[] {
  return definitions.map((monster) => monster.name);
}

export function findMonsterByName(name: string): JsonObject | null {
  const normalized = name.trim().toLocaleLowerCase();
  return monsters.find((monster) =>
    String(monster.Name ?? monster.name ?? "").toLocaleLowerCase() === normalized,
  ) ?? null;
}

export function monsterDefinitions(): readonly MonsterDefinition[] {
  return definitions;
}

export function findMonsterDefinition(nameOrId: string): MonsterDefinition | null {
  const normalized = nameOrId.trim().toLocaleLowerCase();
  return definitions.find((monster) => monster.id.toLocaleLowerCase() === normalized || monster.name.toLocaleLowerCase() === normalized) ?? null;
}
