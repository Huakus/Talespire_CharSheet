// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { combatModifierStyle, renderMonsterAbilitySaves, renderMonsterDefensesSummary, renderMonsterActionShortcuts } from "../../src/ui/monster-combat-summary";
it("places each saving throw under its matching ability with an independent modifier tint", () => {
  const monster = normalizeMonsterDefinition({ Name: "Centinela", Abilities: { Str: 18, Dex: 14, Con: 16, Int: 8, Wis: 12, Cha: 10 }, Saves: ["FUE +6", "DES +1"] });
  const root = document.createElement("div"); root.innerHTML = renderMonsterAbilitySaves(monster, "Centinela 2");
  const pairs = root.querySelectorAll(".gm-ability-save-pair"); expect(pairs).toHaveLength(6);
  expect(pairs[0]!.querySelector(".gm-roll")?.getAttribute("data-roll-expression")).toBe("1d20+4");
  expect(pairs[0]!.querySelector(".gm-save-roll")?.getAttribute("data-roll-expression")).toBe("1d20+6");
  expect(pairs[1]!.querySelector(".gm-save-roll")?.getAttribute("data-check-value")).toBe("1");
  expect(pairs[0]!.querySelector(".gm-save-roll")?.textContent).toBe("+6");
  expect(pairs[0]!.querySelector(".gm-save-roll")?.getAttribute("aria-label")).toContain("Salvación");
  expect(pairs[0]!.querySelector(".gm-roll")?.getAttribute("style")).toContain("--check-strength:40%");
  expect(pairs[0]!.querySelector(".gm-save-roll")?.getAttribute("style")).toContain("--check-strength:60%");
});
it("uses the neutral style at zero and saturates each end of the text scale at ten", () => {
  expect(combatModifierStyle(0)).toBe("");
  expect(combatModifierStyle(5)).toContain("--check-strength:50%");
  expect(combatModifierStyle(-5)).toContain("--check-strength:50%");
  expect(combatModifierStyle(10)).toBe(combatModifierStyle(30));
  expect(combatModifierStyle(-10)).toBe(combatModifierStyle(-30));
  expect(combatModifierStyle(10)).not.toBe(combatModifierStyle(-10));
});
it("exposes attack/damage shortcuts and distinguishes defensive types using text and color classes", () => {
  const monster = normalizeMonsterDefinition({ Name: "Centinela", Actions: [{ Name: "Espada", Content: "Ataque: +7 al impacto. Daño: 2d6+4 cortante." }], DamageVulnerabilities: ["fire"], DamageResistances: ["cold"], DamageImmunities: ["poison"] });
  const root = document.createElement("div"); root.innerHTML = renderMonsterActionShortcuts(monster, "Centinela 2") + renderMonsterDefensesSummary(monster);
  expect(root.querySelector('[data-roll-expression="1d20+7"]')?.getAttribute("data-roll-name")).toContain("Centinela 2");
  expect(root.querySelector('[data-roll-expression="2d6+4"]')).not.toBeNull();
  expect(root.querySelector(".vulnerable")?.textContent).toContain("Vulnerable");
  expect(root.querySelector(".resistant")?.textContent).toContain("Resiste");
  expect(root.querySelector(".immune")?.textContent).toContain("Inmune");
});
