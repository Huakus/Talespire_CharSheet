import type { EquipmentDefinitionDraft } from "../domain/equipment/equipment-definition";
import { equipmentPlainDescription } from "../domain/equipment/equipment-live";
import { inventoryDescriptionBlocks, inventoryDescriptionText } from "./inventory-description";
import { normalizeRollShortcut } from "../domain/dice/dice-expression";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function renderCollapsibleInventoryDescription(description: string, key: string, definition: EquipmentDefinitionDraft | null = null, expanded = false): string {
  const structured = definition && description === equipmentPlainDescription(definition);
  const html = structured ? inventoryDescriptionBlocks(definition).map((block) => block.type === "paragraph" ? renderInventoryRichText(block.text, "Tirada") : block.type === "list" ? `<${block.ordered ? "ol" : "ul"}>${block.items.map((text) => `<li>${renderInventoryRichText(text, "Tirada")}</li>`).join("")}</${block.ordered ? "ol" : "ul"}>` : `<div class="inventory-rule-table"><table><thead><tr>${block.columns.map((text) => `<th>${escapeHtml(text)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((text) => `<td>${renderInventoryRichText(text, "Tirada")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`).join("") : renderInventoryRichText(inventoryDescriptionText(description, definition), "Tirada");
  return `<div class="spell-description inventory-description ${expanded ? "expanded" : ""}" data-inventory-description="${escapeHtml(key)}"><div class="card-description rich-inventory-text">${html}</div><button type="button" class="spell-description-more" data-toggle-inventory-description aria-expanded="${expanded}">${expanded ? "Leer menos" : "Leer más"}</button></div>`;
}

export function renderInventoryRichText(description: string, rollName: string): string {
  const dice = /\b(?:\d+)?d\d+(?:\s*[+-]\s*(?:(?:\d+)?d\d+|\d+))*/gi;
  return description.split(/\r?\n\s*\r?\n/).filter((paragraph) => paragraph.trim()).map((paragraph) => {
    let cursor = 0;
    let html = "";
    for (const match of paragraph.matchAll(dice)) {
      const index = match.index ?? 0;
      html += escapeHtml(paragraph.slice(cursor, index)).replace(/\r?\n/g, "<br>");
      try {
        const expression = normalizeRollShortcut(match[0]);
        html += `<button type="button" class="roll-button inline-dice-roll" data-roll-name="${escapeHtml(rollName)}" data-roll-expression="${escapeHtml(expression)}" data-roll-mode="normal">${escapeHtml(expression)}</button>`;
      } catch {
        html += escapeHtml(match[0]);
      }
      cursor = index + match[0].length;
    }
    html += escapeHtml(paragraph.slice(cursor)).replace(/\r?\n/g, "<br>");
    return `<p>${html}</p>`;
  }).join("");
}

export function bindInventoryDescriptions(root: ParentNode, expandedDescriptions: Set<string>): void {
  root.querySelectorAll<HTMLButtonElement>("[data-toggle-inventory-description]").forEach((button) => {
    const container = button.closest<HTMLElement>("[data-inventory-description]");
    const description = container?.querySelector<HTMLElement>(".card-description");
    if (!container || !description) return;
    const key = container.dataset.inventoryDescription;
    if (!container.classList.contains("expanded") && description.clientHeight > 0 && description.scrollHeight <= description.clientHeight + 1) button.hidden = true;
    button.addEventListener("click", () => {
      const expanded = !container.classList.contains("expanded");
      container.classList.toggle("expanded", expanded);
      button.textContent = expanded ? "Leer menos" : "Leer más";
      button.setAttribute("aria-expanded", String(expanded));
      if (key) {
        if (expanded) expandedDescriptions.add(key);
        else expandedDescriptions.delete(key);
      }
    });
  });
}
