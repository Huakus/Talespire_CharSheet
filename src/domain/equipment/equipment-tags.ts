/** Review labels are findings to investigate, never certification of rules or automation. */
export const EQUIPMENT_TAG_LABELS = {
  manual_jugador: "Manual del Jugador",
  xanathar: "Xanathar",
  custom: "Contenido de campaña",
  fuente_pendiente: "Fuente pendiente",
  pendiente_traduccion: "Traducción pendiente",
  revisar_equivalencia: "Revisar equivalencia en español",
  descripcion_pendiente: "Sin descripción",
  revisar_descripcion: "Revisar descripción",
  revisar_datos: "Revisar datos",
  revisar_funciones: "Revisar funciones",
  conflicto_version: "Conflicto de versión",
  version_local: "Versión local",
  revisado: "Revisado",
  texto_revisado: "Texto revisado",
  reglas_2014: "Reglas 2014",
  revision_pendiente: "Revisión pendiente",
} as const;

export function equipmentTagLabel(tag: string): string {
  return EQUIPMENT_TAG_LABELS[tag as keyof typeof EQUIPMENT_TAG_LABELS] ?? tag;
}

// Retain these legacy metadata markers in storage: language controls catalog visibility.
const INTERNAL_TAGS = new Set(["favorite", "official", "gm", "imported", "legacy", "es", "esp", "spa", "espanol", "spanish", "en", "eng", "ingles", "english", "phb", "xge", "fuente_pendiente", "pendiente_traduccion", "revisar_equivalencia", "descripcion_pendiente", "revisar_descripcion", "revisar_datos", "revisar_funciones", "conflicto_version", "version_local", "revisado", "texto_revisado", "reglas_2014", "revision_pendiente"]);
export function visibleEquipmentTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => {
    const value = tag.trim();
    // Older campaigns keep their original metadata; expose the same source filter there.
    return value.toLowerCase() === "phb" ? "manual_jugador" : value.toLowerCase() === "xge" ? "xanathar" : value;
  }).filter((tag) => tag && !INTERNAL_TAGS.has(tag.toLowerCase())))];
}
