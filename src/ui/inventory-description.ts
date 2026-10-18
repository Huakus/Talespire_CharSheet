import type { EquipmentDefinitionDraft } from "../domain/equipment/equipment-definition";
import { SRD_51_ATTRIBUTION } from "../domain/equipment/equipment-attribution";

// Whitespace-only equivalence keeps distinct numbers, signs, restrictions and custom wording.
const textKey = (value: string): string => value.replace(/\s+/gu, " ").trim();
const paragraphs = (value: string): string[] => value.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);

const internalParagraph = (text: string): boolean => /^(?:Resolución asistida: aplicar las condiciones y resultados descritos;|Regla custom consolidada por autorización del GM\. Las versiones antiguas discrepaban|Esta ficha aplica la versión Adaptada[^\n]*se corrige el campo antiguo|La ficha registra «[^»]+»\. No aporta una descripción propia)/.test(text.trim());

/** Editorial history stays in the stored definition; player text contains game rules. */
export function inventoryPlayerText(text: string): string {
  return paragraphs(text.replace(/<br\s*\/?\s*>/gi, "\n").replace(/\bRequires\s+attunement\b/gi, "Requiere sintonización")).filter(p => !internalParagraph(p)).join("\n\n");
}

/** Keep supplementary rules once, without changing any stored description or mechanic. */
export function inventorySupplementalText(text: string, displayed: readonly string[] = []): string {
  const seen = new Set(displayed.flatMap(paragraphs).map(textKey));
  return paragraphs(text).filter(paragraph => {
    const key = textKey(paragraph);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join("\n\n");
}

/** The shared card supplies SRD attribution once, alongside its rule status. */
export function inventoryDescriptionText(text: string, definition: EquipmentDefinitionDraft | null): string {
  const attribution = definition?.sources.some(s => s.verified && s.kind === "srd") ? [SRD_51_ATTRIBUTION] : [];
  return inventorySupplementalText(inventoryPlayerText(text), attribution);
}

export function inventoryDescriptionBlocks(definition: EquipmentDefinitionDraft): EquipmentDefinitionDraft["description"] {
  const seen = new Set<string>();
  return definition.description.filter(block => {
    if (block.section === "gm-notes" || block.type === "paragraph" && internalParagraph(block.text)) return false;
    const key = block.type === "paragraph" ? `p:${textKey(block.text)}` : block.type === "list" ? JSON.stringify(["list", block.ordered, block.items.map(textKey)]) : JSON.stringify(["table", block.columns.map(textKey), block.rows.map(row => row.map(textKey))]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
