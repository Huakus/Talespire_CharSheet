import type { InventoryViewItem } from "./inventory-view";
import { inventoryEquipmentDefinition, equipmentPlainDescription } from "../domain/equipment/equipment-live";
import { equipmentRecoveryLabel } from "../domain/equipment/equipment-resource-runtime";
import { inventoryDescriptionBlocks, inventoryPlayerText, inventorySupplementalText } from "./inventory-description";
import { renderCollapsibleInventoryDescription, renderInventoryRichText } from "./inventory-description-view";
import { inventoryFeatureKindLabel } from "./inventory-capability-editor";

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Stock/catalog inspection has no character bearer; it offers rules and rolls without spending resources. */
export function renderInventoryItemPreview(item: InventoryViewItem, options: {
  key: string;
  expanded: boolean;
  showDescriptions: boolean;
  catalogDefinition?: InventoryViewItem | null;
}): string {
  const definition = inventoryEquipmentDefinition(item) ?? (options.catalogDefinition ? inventoryEquipmentDefinition(options.catalogDefinition) : null);
  const description = definition ? equipmentPlainDescription(definition) : item.description.trim() || options.catalogDefinition?.description.trim() || "";
  const displayed = [description, ...(definition ? inventoryDescriptionBlocks(definition).map(block => block.type === "paragraph" ? block.text : block.type === "list" ? block.items.join("\n") : block.rows.map(row => row.join(" · ")).join("\n")) : [])];
  const descriptionHtml = options.showDescriptions && description ? renderCollapsibleInventoryDescription(description, options.key, definition, options.expanded) : "";
  const notes = definition ? inventoryPlayerText(inventorySupplementalText([item.description, item.rules?.personalDescription ?? ""].join("\n\n"), displayed)) : "";
  displayed.push(notes);
  const features = [...item.features].sort((a, b) => a.order - b.order).map(feature => {
    const extra = inventoryPlayerText(inventorySupplementalText(feature.description, displayed));
    displayed.push(extra);
    const resources = [feature.uses ? `${feature.uses.current}/${feature.uses.maximum} usos` : "", feature.chargeCost ? `${feature.chargeCost} cargas por uso` : "", feature.active ? "Activo" : ""].filter(Boolean);
    return `<article class="inventory-feature-capability ${feature.active ? "active" : ""}"><header><div><span class="card-kicker">${escape(inventoryFeatureKindLabel(feature.kind))}</span><h4>${escape(feature.name)}</h4></div>${resources.length ? `<span class="card-badge">${escape(resources.join(" · "))}</span>` : ""}</header>
      ${options.showDescriptions && extra ? `<div class="rich-inventory-text">${renderInventoryRichText(extra, `${item.name}: ${feature.name}`)}</div>` : ""}
      ${feature.rolls.length ? `<div class="inventory-feature-controls">${feature.rolls.map(roll => `<button type="button" class="roll-button" data-roll-name="${escape(`${item.name}: ${roll.label}`)}" data-roll-expression="${escape(roll.expression)}" data-roll-mode="${roll.mode}">${escape(roll.label)} <strong>${escape(roll.expression)}</strong></button>`).join("")}</div>` : ""}</article>`;
  }).join("");
  const effect = inventoryPlayerText(inventorySupplementalText(item.effect.description, displayed));
  const recovery = definition?.resources.length ? `<details class="inventory-preview-recovery"><summary>Recursos y recuperación</summary>${definition.resources.map(resource => `<p><strong>${escape(resource.name)}${resource.maximum === null ? "" : ` · máximo ${resource.maximum}`}</strong><br>${escape(equipmentRecoveryLabel(resource))}</p>`).join("")}</details>` : "";
  return `${descriptionHtml}${options.showDescriptions && notes ? `<div class="inventory-preview-notes rich-inventory-text"><strong>Notas del objeto</strong>${renderInventoryRichText(notes, item.name)}</div>` : ""}
    ${features ? `<div class="inventory-capability-groups inventory-capability-preview"><section><h4>Capacidades</h4>${features}</section></div>` : ""}
    ${options.showDescriptions && effect ? `<div class="inventory-preview-notes rich-inventory-text"><strong>Efecto adicional${item.effect.active ? " · activo" : ""}</strong>${renderInventoryRichText(effect, item.name)}</div>` : ""}${options.showDescriptions ? recovery : ""}`;
}
