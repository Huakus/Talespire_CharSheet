import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { expect, it } from "vitest";
import { combatModifierStyle } from "../../src/ui/monster-combat-summary";
import { renderSpellEditor, renderEquipmentEditor } from "../../src/ui/gm-content-editors";

const css = readFileSync(new URL("../../src/ui/design-system/tokens.css", import.meta.url), "utf8")
  + readFileSync(new URL("../../src/ui/design-system/primitives.css", import.meta.url), "utf8")
  + readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8").replace(/@import[^;]+;/g, "");

it("keeps content-editor checkboxes compact and conditional sections hidden under the real GM stylesheet", () => {
  const window = new Window(), document = window.document;
  try {
    const style = document.createElement("style"); style.textContent = css; document.head.append(style);
    const meta = { contentKey: "", origin: "gm" as const, tags: [], revision: 0 };
    document.body.innerHTML = `<section class="gm-shell">${renderSpellEditor(null, meta)}${renderEquipmentEditor(null, meta)}</section>`;
    for (const input of document.querySelectorAll('input[type="checkbox"]')) {
      const computed = window.getComputedStyle(input);
      expect(computed.width).toBe("14px"); expect(computed.height).toBe("14px");
    }
    const hidden = document.querySelector('[data-equipment-section="weapon"]')!;
    expect(window.getComputedStyle(hidden).display).toBe("none");
    expect(window.getComputedStyle(document.querySelector(".gm-content-editor-toolbar")!).position).toBe("sticky");
  } finally { window.close(); }
});

it.each(["dark", "light"])("colors only modifier text and preserves button colors in %s mode", mode => {
  const window = new Window(), document = window.document;
  try {
    document.documentElement.dataset.v2Theme = mode;
    const style = document.createElement("style"); style.textContent = css; document.head.append(style);
    document.body.innerHTML = `<section class="gm-shell" style="--character-color:rgb(217,189,115);--ui-accent-surface:rgb(51,45,32)"><span class="gm-ability-save-pair">${[0, 5, 10, -5, -10].map(value => `<button type="button" class="gm-roll gm-stat-roll" data-check-value="${value}" style="${combatModifierStyle(value)}"><small>FUE</small><strong>20</strong><em class="gm-modifier-value">${value}</em></button><button type="button" class="gm-roll gm-stat-roll gm-save-roll" data-check-value="${value}" style="${combatModifierStyle(value)}"><span class="gm-modifier-value">${value}</span></button>`).join("")}</span></section>`;
    const abilities = [...document.querySelectorAll("button:not(.gm-save-roll)")];
    const saves = [...document.querySelectorAll(".gm-save-roll")];
    for (const buttons of [abilities, saves]) {
      const neutral = window.getComputedStyle(buttons[0]!);
      for (const button of buttons.slice(1)) {
        const actual = window.getComputedStyle(button);
        expect(actual.background).toBe(neutral.background);
        expect(actual.borderColor).toBe(neutral.borderColor);
        expect(actual.color).toBe(neutral.color);
      }
      const colors = buttons.map(button => window.getComputedStyle(button.querySelector(".gm-modifier-value")!).color);
      expect(new Set(colors).size).toBe(5);
      expect(colors[2]).toBe(mode === "dark" ? "rgb(65, 205, 100)" : "rgb(16, 120, 45)");
      expect(colors[4]).toBe(mode === "dark" ? "rgb(245, 85, 90)" : "rgb(185, 30, 40)");
    }
    expect(new Set(abilities.map(button => window.getComputedStyle(button.querySelector("strong")!).color)).size).toBe(1);
    expect(new Set(abilities.map(button => window.getComputedStyle(button.querySelector("small")!).color)).size).toBe(1);
  } finally { window.close(); }
});

it("emphasizes the archived status in red and bold over the default identity styling", () => {
  const window = new Window(), document = window.document;
  try {
    const style = document.createElement("style"); style.textContent = css; document.head.append(style);
    document.documentElement.style.setProperty("--ui-danger", "rgb(220,60,60)");
    document.body.innerHTML = '<article class="gm-character-row" data-character-archived="true"><div class="gm-character-identity"><span class="gm-character-availability">Archivado</span></div></article>';
    const status = window.getComputedStyle(document.querySelector(".gm-character-availability")!);
    expect(status.color).toBe("rgb(220, 60, 60)");
    expect(status.fontWeight).toBe("800");
  } finally { window.close(); }
});

it("unclamps the expanded shop item description under the real GM stylesheet", () => {
  const window = new Window(), document = window.document;
  try {
    const style = document.createElement("style"); style.textContent = css; document.head.append(style);
    document.body.innerHTML = '<section class="gm-shell"><section class="gm-shop-inventory"><article class="inventory-row"><div class="spell-description inventory-description expanded"><div class="card-description rich-inventory-text"><p>Texto completo</p></div></div></article></section></section>';
    const actual = window.getComputedStyle(document.querySelector(".card-description")!);
    expect(actual.display).toBe("block");
    expect(actual.overflow).toBe("visible");
    expect(actual.maxHeight).toBe("none");
  } finally { window.close(); }
});

it("shows only the character summary while collapsed and restores details on expansion", () => {
  const window = new Window(), document = window.document;
  try {
    const style = document.createElement("style"); style.textContent = css; document.head.append(style);
    document.body.innerHTML = '<section class="gm-shell"><section class="gm-character-manager"><details class="gm-character-row"><summary class="gm-managed-character-summary"><strong>Nombre</strong><button>Abrir</button></summary><div class="gm-managed-character-body">Estado y acciones</div></details></section></section>';
    const details = document.querySelector("details")!, body = document.querySelector(".gm-managed-character-body")!;
    expect(window.getComputedStyle(body).display).toBe("none");
    expect(window.getComputedStyle(document.querySelector("summary")!).display).toBe("grid");
    details.open = true;
    expect(window.getComputedStyle(body).display).toBe("grid");
  } finally { window.close(); }
});
