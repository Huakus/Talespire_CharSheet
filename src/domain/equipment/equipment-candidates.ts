/** Reviewed name candidates from the legacy catalog, not certified translations. */
const pairs: readonly (readonly [string, string])[] = [
  ["Cloak of Charisma +1", "Capa de Carisma +1"], ["Reaper’s Shadow", "Sombra del Segador"],
  ["Lucent Crystal", "Cristal Luciente"], ["Wizard Amulet", "Amuleto de mago"], ["Jewelry", "Joyas"],
  ["Lucent Core", "Núcleo Luciente"], ["Agati’s Robe", "Túnica de Agati"], ["Staff of Haste", "Bastón de Acelerar"],
  ["Reserve Crystal", "Cristal de Reserva"], ["Crimson Crystal", "Cristal Carmsí"], ["Runed Cloak", "Capa con runas"],
  ["Scholar’s Scroll", "Pergamino de Erudito"], ["Wand of Annoyance", "Varita de molestar"],
];
const token = (value: unknown): string => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export interface EquipmentCandidateIdentity { key: string; name: string; index: unknown }
export function relatedEquipmentKeys(primary: EquipmentCandidateIdentity, rows: readonly EquipmentCandidateIdentity[]): string[] {
  const aliases = new Set([token(primary.name)]);
  for (const [en, es] of pairs) if ([token(en), token(es)].includes(token(primary.name))) { aliases.add(token(en)); aliases.add(token(es)); }
  return rows.filter((row) => row.key !== primary.key &&
    ((primary.index && token(primary.index) === token(row.index)) || aliases.has(token(row.name))),
  ).map((row) => row.key);
}
