import { normalizeEquipmentDefinition, EQUIPMENT_CATEGORIES } from "./equipment-catalog";
import { EQUIPMENT_TAG_LABELS } from "./equipment-tags";

export interface EquipmentClassificationRow {
  content_key: string;
  name: string;
  origin: string;
  tags: string[];
  payload: Record<string, unknown>;
}

const token = (value: unknown): string => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const managedTags = new Set(Object.keys(EQUIPMENT_TAG_LABELS));
// Explicitly authored definitions, not an inference that every import/GM row is homebrew.
const campaignDefinitions = new Set([
  "gm:equipment:1b428562-bbef-4bec-8445-a76f7e16f854",
  "gm:equipment:f92abc1a-849e-47e0-995b-0602c7156af8",
  "gm:equipment:ece-collar-hablar-con-los-muertos",
]);

export function equipmentRowLanguage(row: EquipmentClassificationRow): "es" | "en" | "unknown" {
  const markers = [...row.tags, ...row.content_key.split(":"), row.payload.language, row.payload.lang, row.payload.locale].map(token);
  if (markers.some((m) => ["en", "eng", "english", "ingles", "enus", "engb"].includes(m))) return "en";
  if (markers.some((m) => ["es", "esp", "spa", "spanish", "espanol", "eses", "esar"].includes(m))) return "es";
  return campaignDefinitions.has(row.content_key) ? "es" : "unknown";
}

/** Object order must not turn equivalent JSON into a local variant. */
export function stableEquipmentJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableEquipmentJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${stableEquipmentJson(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export function classifyEquipment(
  rows: readonly EquipmentClassificationRow[],
  shared: readonly EquipmentClassificationRow[] = [],
  /** Reviewed name correspondences propose candidates; they do not certify completeness. */
  translationCandidates: Readonly<Record<string, string>> = {},
): { row: EquipmentClassificationRow; tags: string[]; spanishCandidates: string[]; reasons: string[] }[] {
  const base = new Map(shared.map((row) => [row.content_key, row]));
  const spanish = rows.filter((row) => equipmentRowLanguage(row) === "es");
  const normalized = new Map(rows.map((row) => {
    try { return [row.content_key, normalizeEquipmentDefinition(row.payload)] as const; }
    catch { return [row.content_key, null] as const; }
  }));
  const mechanics = (row: EquipmentClassificationRow): string => {
    const value = normalized.get(row.content_key);
    if (!value) return stableEquipmentJson(row.payload);
    const { name: _name, description: _description, catalog: _catalog, ...rules } = value;
    return stableEquipmentJson(rules);
  };
  return rows.map((row) => {
    const tags = row.tags.filter((tag) => !managedTags.has(tag) || tag === "custom");
    const reasons: string[] = [];
    const add = (tag: keyof typeof EQUIPMENT_TAG_LABELS, reason: string): void => { tags.push(tag); reasons.push(reason); };
    const source = token(row.payload.source);
    const phb = row.tags.includes("phb") || /manualdeljugador|playershandbook/.test(source);
    const xge = row.tags.includes("xge") || /xanathar/.test(source);
    if (campaignDefinitions.has(row.content_key) || row.tags.includes("custom")) add("custom", "Contenido de campaña identificado explícitamente.");
    else if (phb && !xge) add("manual_jugador", "Fuente declarada en los datos; texto aún sin cotejar.");
    else if (xge && !phb) add("xanathar", "Fuente declarada en los datos; texto aún sin cotejar.");
    else add("fuente_pendiente", "Sin una fuente bibliográfica inequívoca; origin no demuestra procedencia.");

    const language = equipmentRowLanguage(row);
    const spanishCandidates = language !== "en" ? [] : spanish.filter((candidate) =>
      (row.payload.index && token(row.payload.index) === token(candidate.payload.index)) ||
      token(row.name) === token(candidate.name) ||
      (translationCandidates[row.name] && token(translationCandidates[row.name]) === token(candidate.name)),
    ).map((candidate) => candidate.content_key);
    if (language === "en") add(spanishCandidates.length ? "revisar_equivalencia" : "pendiente_traduccion", spanishCandidates.length ? "Posible correspondencia española; falta confirmar que esté completa antes de retirar el inglés." : "Sin correspondencia española identificada.");
    const value = normalized.get(row.content_key);
    if (!value) add("revisar_datos", "La definición no puede normalizarse.");
    else {
      const text = value.description;
      if (!text.trim()) add("descripcion_pendiente", "Descripción vacía.");
      if (/<\/?(?:br|p|div|span|table|tr|td|th|b|i|ul|li|strong|em|a|h[1-6])\b|&(?:nbsp|amp|lt|gt|quot|#\d+);|\[object Object\]|\{\s*"|\\[nrt]|\\u[0-9a-f]{4}|�|Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|â€/i.test(text)) add("revisar_descripcion", "HTML, serialización, escapes o codificación visibles.");
      if (row.payload.description !== undefined && row.payload.desc !== undefined && stableEquipmentJson(row.payload.description) !== stableEquipmentJson(row.payload.desc)) add("revisar_descripcion", "Hay dos campos de descripción distintos.");
      if (!(EQUIPMENT_CATEGORIES as readonly string[]).includes(value.category) || (value.weapon && /\/|\bor\b|\bo\b|,/.test(value.weapon.damageExpression)) || (value.charges && !value.charges.reset)) add("revisar_datos", "Categoría no canónica, daño ambiguo o recuperación sin especificar.");
      if ((/\bcharges?\b|\bcargas?\b/i.test(text) && !value.charges) || (/\bspell|conjur|hechiz|lanzar\b/i.test(text) && !value.features.length)) add("revisar_funciones", "El texto menciona cargas sin recurso o conjuros sin capacidades; es una señal de revisión, no una concesión de conjuro ni una prueba de fallo.");
    }
    if (rows.some((other) => other.content_key !== row.content_key && equipmentRowLanguage(other) === language && token(other.name) === token(row.name) && mechanics(other) !== mechanics(row))) add("conflicto_version", "Mismo nombre e idioma con datos de reglas diferentes.");
    const original = base.get(row.content_key);
    if (original && (original.name !== row.name || stableEquipmentJson(original.payload) !== stableEquipmentJson(row.payload))) add("version_local", "La definición de campaña difiere del catálogo compartido; no se presupone que sea intencional.");
    return { row, tags: [...new Set(tags)], spanishCandidates, reasons };
  });
}
