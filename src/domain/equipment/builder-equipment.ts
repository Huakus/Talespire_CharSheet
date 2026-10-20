import cache from "./builder-equipment-cache.json";
import { EquipmentDefinitionDraftSchema } from "./equipment-definition";
import { bindReviewedEquipment } from "./equipment-live";
import { normalizeEquipmentDefinition, type EquipmentCatalogDraft } from "./equipment-catalog";
import { CatalogMetadataSchema } from "../content/catalog-metadata";

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const aliases: Record<string, string> = { "kit de herborista": "Útiles de herborista", "ropa comun": "Ropas comunes", "ropa fina": "Ropas de calidad", "virote": "Virote de ballesta", "bolsa de monedas": "Bolsa" };
const indices: Record<string, string> = {
  "playing-cards": "playing-card-set", "gaming-set": "dice-set", quill: "ink-pen", ink: "ink-1-ounce-bottle",
  "iron-pot": "pot-iron", costume: "clothes-costume", "cook-utensils": "cooks-utensils", "glassblower-tools": "glassblowers-tools",
  "leatherworker-tools": "leatherworkers-tools", "painter-supplies": "painters-supplies", "tinker-tools": "tinkers-tools",
  "weaver-tools": "weavers-tools", "woodcarver-tools": "woodcarvers-tools",
};
/** A bundled fallback lets offline creation use the same verified Spanish identities. */
export function canonicalBuilderEquipment(index: string, fallback: EquipmentCatalogDraft): EquipmentCatalogDraft {
  const direct = cache.find(e => e.index === (indices[index] ?? index));
  const name = aliases[normalize(fallback.name)] ?? fallback.name;
  const matches = direct ? [direct] : cache.filter(e => [e.definition.name, ...e.definition.aliases].some(n => normalize(n) === normalize(name)));
  const unique = [...new Map(matches.map(e => [e.catalog.contentKey, e])).values()];
  if (unique.length !== 1) return fallback; // Personal gifts are not another character's catalog variant.
  const source = unique[0]!, definition = EquipmentDefinitionDraftSchema.parse(source.definition);
  const { rules: _rules, ...plain } = fallback;
  const bound = bindReviewedEquipment({ ...plain, id: "inv_00000000000000000000000000000000", order: 0, group: "Mochila" }, definition);
  bound.rules!.original = {};
  return normalizeEquipmentDefinition({ ...bound, rarity: definition.rarity, catalog: CatalogMetadataSchema.parse(source.catalog) });
}
