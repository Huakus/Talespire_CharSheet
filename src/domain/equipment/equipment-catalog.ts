import {
  CharacterInventoryItemDraftSchema,
  type CharacterInventoryItemDraft,
} from "../character/character-inventory-model";
import { cloneJson, type JsonObject, type JsonValue } from "../../shared/json";

export const EQUIPMENT_RARITIES = [
  "none", "common", "uncommon", "rare", "very-rare", "legendary", "artifact", "varies",
] as const;

const EQUIPMENT_RARITY_ALIASES: Record<string, typeof EQUIPMENT_RARITIES[number]> = {
  "": "none",
  none: "none",
  ninguna: "none",
  "sin-rareza": "none",
  common: "common",
  comun: "common",
  uncommon: "uncommon",
  "poco-comun": "uncommon",
  rare: "rare",
  raro: "rare",
  rara: "rare",
  "very-rare": "very-rare",
  "muy-raro": "very-rare",
  "muy-rara": "very-rare",
  legendary: "legendary",
  legendario: "legendary",
  legendaria: "legendary",
  artifact: "artifact",
  artefacto: "artifact",
  varies: "varies",
  variable: "varies",
  varia: "varies",
};

const EQUIPMENT_RARITY_LABELS: Record<typeof EQUIPMENT_RARITIES[number], string> = {
  none: "Sin rareza",
  common: "Común",
  uncommon: "Poco común",
  rare: "Raro",
  "very-rare": "Muy raro",
  legendary: "Legendario",
  artifact: "Artefacto",
  varies: "Variable",
};

export const EQUIPMENT_CATEGORIES = [
  "adventuring-gear", "weapon", "armor", "shield", "tool", "ammunition",
  "potion", "scroll", "wand", "staff", "rod", "ring", "wondrous-item",
] as const;

export const EQUIPMENT_PROPERTIES = [
  "ammunition", "finesse", "heavy", "light", "loading", "reach", "special",
  "thrown", "two-handed", "versatile", "silvered", "magic", "cursed",
] as const;

export const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
] as const;

export type EquipmentCatalogDraft = Omit<CharacterInventoryItemDraft, "order" | "group"> & {
  rarity: string;
};

function object(value: JsonValue | undefined): JsonObject {
  return value !== null && value !== undefined && !Array.isArray(value) && typeof value === "object"
    ? value
    : {};
}

function text(value: JsonValue | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function number(value: JsonValue | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function signedInteger(value: JsonValue | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function bonusAbility(value: JsonValue | undefined): "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma" | null {
  const abilities = {
    str: "strength", strength: "strength", fue: "strength",
    dex: "dexterity", dexterity: "dexterity", des: "dexterity",
    con: "constitution", constitution: "constitution",
    int: "intelligence", intelligence: "intelligence",
    wis: "wisdom", wisdom: "wisdom", sab: "wisdom",
    cha: "charisma", charisma: "charisma", car: "charisma",
  } as const;
  return abilities[String(value ?? "").trim().toLocaleLowerCase() as keyof typeof abilities] ?? null;
}

function boolean(value: JsonValue | undefined): boolean {
  return value === true || value === 1 || ["true", "yes", "sí", "si"].includes(String(value ?? "").trim().toLocaleLowerCase());
}

function description(value: JsonValue | undefined): string {
  return Array.isArray(value) ? value.map((entry) => text(entry)).filter(Boolean).join("\n\n") : text(value);
}

export function normalizeEquipmentRarity(value: unknown): typeof EQUIPMENT_RARITIES[number] {
  const normalized = String(value ?? "none")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[\s_]+/g, "-");
  return EQUIPMENT_RARITY_ALIASES[normalized] ?? "none";
}

export function equipmentRarityLabel(value: unknown): string {
  return EQUIPMENT_RARITY_LABELS[normalizeEquipmentRarity(value)];
}

export function normalizeEquipmentDefinition(input: unknown): EquipmentCatalogDraft {
  const raw = input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const rawRarity = raw.rarity !== null && typeof raw.rarity === "object" && !Array.isArray(raw.rarity)
    ? raw.rarity as Record<string, unknown>
    : {};
  const rarity = normalizeEquipmentRarity(rawRarity.index ?? rawRarity.name ?? raw.rarity ?? raw.Rarity);
  const existing = CharacterInventoryItemDraftSchema.safeParse(input);
  if (existing.success) {
    const { order: _order, group: _group, ...definition } = existing.data;
    return { ...definition, rarity };
  }
  const normalizedDraft = CharacterInventoryItemDraftSchema.safeParse({
    ...raw,
    order: raw.order ?? 0,
    group: raw.group ?? "backpack",
  });
  if (normalizedDraft.success) {
    const { order: _order, group: _group, ...definition } = normalizedDraft.data;
    return { ...definition, rarity };
  }
  const data = cloneJson(input as JsonObject);
  const category = object(data.equipment_category);
  const cost = object(data.cost);
  const damage = object(data.damage);
  const damageType = object(damage.damage_type);
  const range = object(data.throw_range ?? data.range);
  const armorClass = object(data.armor_class);
  const chargeOptions = object(data.chargesOptions);
  const properties = Array.isArray(data.properties)
    ? data.properties.map((entry) => text(object(entry).name || object(entry).index)).filter(Boolean)
    : [];
  const rawBonuses = (Array.isArray(data.bonus) ? data.bonus : Array.isArray(data.bonuses) ? data.bonuses : [])
    .map((entry) => object(entry));
  const bonuses = rawBonuses
    .map((entry) => ({
      category: text(entry.category),
      key: text(entry.key),
      value: bonusAbility(entry.value) === null ? signedInteger(entry.value) : 0,
      valueSource: bonusAbility(entry.value),
      advantage: Boolean(entry.advantage),
      disadvantage: Boolean(entry.disadvantage),
    }))
    .filter((entry) => entry.category.length > 0 && entry.key.length > 0);
  const features = rawBonuses.flatMap((entry, index) => {
    const detail = text(entry.description).trim();
    if (!detail) return [];
    return [{
      id: `legacy-bonus-${index}`,
      order: index,
      kind: "passive" as const,
      name: text(entry.key).trim() || `Bono ${index + 1}`,
      description: detail,
      active: false,
      toggleable: false,
      showInActions: false,
      chargeCost: 0,
      uses: null,
      rolls: [],
      bonuses: [],
    }];
  });
  const categoryKey = text(category.index || data.category).toLowerCase();
  const isWeapon = categoryKey.includes("weapon") || damage.damage_dice !== undefined;
  const isArmor = categoryKey.includes("armor") || armorClass.base !== undefined;
  const name = text(data.name).trim();

  return {
    name: name || "Objeto sin nombre",
    quantity: 1,
    unitWeight: number(data.weight),
    cost: { quantity: number(cost.quantity), unit: text(cost.unit) },
    category: categoryKey || "adventuring-gear",
    rarity,
    description: description(data.description ?? data.desc),
    properties,
    equipped: false,
    attuned: false,
    requiresAttunement: boolean(data.requires_attunement ?? data.requiresAttunement) ||
      properties.some((property) => property.toLowerCase().includes("attun")),
    usable: boolean(data.usable) || boolean(data.hasCharges) || categoryKey.includes("potion") || categoryKey.includes("scroll"),
    consumable: boolean(data.consumable) || categoryKey.includes("potion") || categoryKey.includes("scroll"),
    charges: boolean(data.hasCharges) && number(chargeOptions.maxCharges) > 0 ? {
      current: Math.trunc(number(chargeOptions.maxCharges)),
      maximum: Math.trunc(number(chargeOptions.maxCharges)),
      reset: text(chargeOptions.chargeReset),
    } : null,
    armor: isArmor ? {
      base: Math.trunc(number(armorClass.base)),
      dexterityBonus: Boolean(armorClass.dex_bonus),
      maximumDexterityBonus: armorClass.max_bonus === undefined ? null : Math.trunc(number(armorClass.max_bonus)),
      armorCategory: text(data.armor_category),
      stealthDisadvantage: Boolean(data.stealth_disadvantage),
      strengthRequirement: data.str_minimum !== undefined ? Math.trunc(number(data.str_minimum)) : null,
    } : null,
    weapon: isWeapon ? {
      category: text(data.weapon_category ?? data.category_range),
      range: text(data.weapon_range),
      normalRange: range.normal === undefined ? null : Math.trunc(number(range.normal)),
      longRange: range.long === undefined ? null : Math.trunc(number(range.long)),
      damageExpression: text(damage.damage_dice),
      versatileDamageExpression: text(object(data.two_handed_damage).damage_dice),
      damageType: text(damageType.name || damageType.index),
      attackBonus: signedInteger(data.toHitBonus ?? data.attackBonus),
      damageBonus: signedInteger(data.damageBonus),
    } : null,
    bonuses,
    features,
    effect: { description: "", active: false },
    catalog: null,
  };
}
