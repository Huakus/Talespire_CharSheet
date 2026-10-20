import type { EquipmentDefinitionDraft } from "./equipment-definition";

/** A family source table must not offer other variants' healing rolls on this item. */
export function equipmentVariantDescription(definition: EquipmentDefinitionDraft): EquipmentDefinitionDraft["description"] {
  if (definition.category !== "potion" || !definition.consumable) return definition.description;
  const expressions = new Set(definition.capabilities.flatMap(cap => cap.consumeQuantity > 0
    ? cap.effects.flatMap(effect => effect.kind === "healing" ? [effect.expression.replace(/\s/g, "").toLowerCase()] : []) : []));
  if (expressions.size !== 1) return definition.description;
  const expression = [...expressions][0]!;
  return definition.description.map(block => {
    if (block.type !== "table" || block.columns.length !== 3 || block.columns[0] !== "Poción de..." || block.columns[1] !== "Rareza" || block.columns[2] !== "PG recuperados") return block;
    const rows = block.rows.filter(row => row[2]?.replace(/\s/g, "").toLowerCase() === expression);
    return rows.length === 1 ? { ...block, rows } : block;
  });
}
