export const EQUIPMENT_RARITIES = [
  "none", "common", "uncommon", "rare", "very-rare", "legendary", "artifact", "varies",
] as const;

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

export function equipmentPropertyLabel(value: string): string {
  const labels: Record<string, string> = { ammunition: "Munición", finesse: "Sutil", heavy: "Pesada", light: "Ligera", loading: "Recarga", reach: "Gran alcance", special: "Especial", thrown: "Arrojadiza", "two-handed": "A dos manos", versatile: "Versátil", silvered: "Plateada", magic: "Mágica", cursed: "Maldita" };
  const key = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (["attunement", "requires-attunement"].includes(key)) return "Requiere sintonización";
  return labels[key] ?? value;
}

