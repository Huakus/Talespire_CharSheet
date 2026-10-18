import type { EquipmentDefinitionDraft } from "./equipment-definition";

/** Narrow proof for legacy table-only gear. Unrecognized fields fail closed. */
export function simpleEquipmentReplacementIssues(
  source: Record<string, unknown>,
  target: EquipmentDefinitionDraft,
): string[] {
  const issues: string[] = [];
  const fields = new Set(["name", "index", "cost", "weight", "gear_category", "equipment_category", "tool_category", "vehicle_category", "desc", "description", "url"]);
  const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const category = record(source.equipment_category).index;
  for (const key of ["equipment_category", "gear_category", "tool_category"]) {
    if (source[key] !== undefined && (source[key] === null || typeof source[key] !== "object" || Array.isArray(source[key]) ||
      Object.keys(record(source[key])).some(k => !["index", "name", "url"].includes(k)))) issues.push(`Clasificación desconocida: ${key}`);
  }
  const categoryMap: Record<string, string[]> = {
    "adventuring-gear": ["adventuring-gear"], tool: ["tool"], tools: ["tool"],
    "mounts-and-vehicles": ["tack", "vehicle"], armor: ["armor", "shield"],
  };
  if (category === "armor") for (const key of ["armor_category", "armor_class", "str_minimum", "stealth_disadvantage"]) fields.add(key);
  for (const key of Object.keys(source)) if (!fields.has(key)) issues.push(`Campo sin cotejar: ${key}`);
  for (const key of ["desc", "description"]) {
    const text = source[key];
    if (text !== undefined && text !== null && text !== "" && !(Array.isArray(text) && text.every(v => typeof v === "string" && !v.trim()))) issues.push(`Texto pendiente: ${key}`);
  }
  if (target.magical !== false) issues.push("No es equipo mundano.");
  if (!target.review.identity || !target.review.editorial || target.language !== "es" || !target.description.length) issues.push("Identidad o presentación española sin cotejar.");
  if (!target.sources.some(s => s.verified && s.rulesEdition === "2014" && ["srd", "book"].includes(s.kind))) issues.push("Falta una fuente oficial de 2014 cotejada.");
  if (typeof category !== "string" || !categoryMap[category]?.includes(target.category ?? "")) issues.push("Categoría sin correspondencia.");
  const price = record(source.cost), destinationPrice = target.economy.basePrice;
  if (!destinationPrice || Object.keys(price).some(k => !["quantity", "unit"].includes(k)) || price.quantity !== destinationPrice.quantity || price.unit !== destinationPrice.unit) issues.push("Precio diferente o incompleto.");
  if (source.weight !== undefined && (!target.weight || target.weight.unit !== "lb" || target.weight.value !== source.weight)) issues.push("Peso diferente o incompleto.");
  if (category === "armor") {
    const old = record(source.armor_class), armor = target.armor;
    const categories: Record<string, string> = { Light: "light", Medium: "medium", Heavy: "heavy", Shield: "shield" };
    if (Object.keys(old).some(k => !["base", "dex_bonus", "max_bonus"].includes(k))) issues.push("Perfil de armadura desconocido.");
    if (!armor || armor.category !== categories[String(source.armor_category)] ||
      armor.baseArmorClass !== old.base || armor.armorClassBonus !== 0 ||
      (armor.dexterity !== "none") !== old.dex_bonus ||
      (armor.dexterity === "capped" ? armor.dexterityCap : null) !== (old.max_bonus ?? null) ||
      (armor.strengthMinimum ?? 0) !== (source.str_minimum ?? 0) ||
      armor.stealthDisadvantage !== (source.stealth_disadvantage ?? false)) issues.push("Estadísticas de armadura diferentes.");
  }
  return issues;
}
