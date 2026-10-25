// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { GmApp } from "../../src/ui/gm-app";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { CombatSessionRepository } from "../../src/infrastructure/persistence/combat-session-repository";
import { normalizeMonsterDefinition, type MonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { nativeCombatFixture } from "../fixtures/native-combat";
import { bindMonsterEditor, renderMonsterSpells } from "../../src/ui/monster-editor";

const apps: GmApp[] = [];
afterEach(() => { apps.splice(0).forEach((app) => app.stop()); document.body.replaceChildren(); vi.restoreAllMocks(); });

async function editor() {
  const { source } = await nativeCombatFixture();
  const monster = normalizeMonsterDefinition({ Id: "resonant", Name: "Caballero resonante", Type: "No muerto Mediano", Size: "Mediano",
    Challenge: "5", HP: { Value: 85, Notes: "10d8+40" }, AC: { Value: 17 }, InitiativeModifier: 1, InitiativeAdvantage: true,
    Speed: ["30 ft."], Abilities: { Str: 18, Dex: 12, Con: 18, Int: 6, Wis: 10, Cha: 5 },
    DamageResistances: ["cold", "daño no mágico"], ConditionImmunities: ["frightened", "Estado propio"],
    Traits: [{ Name: "Disciplina | residual", Content: "Primera línea | alternativa\nSegunda línea.", Usage: "1/día" }],
    Actions: [{ Name: "Espada", Content: "1d20+7, daño 1d10+4", Usage: "" }], Spells: ["Conjuro propio"],
  });
  const save = vi.fn(async (_definition: MonsterDefinition, _previousKey: string | null) => undefined);
  const root = document.createElement("main"); document.body.append(root);
  const app = new GmApp(root, new EncounterApplication(new CombatSessionRepository(source)), {
    monsters: [monster], diceRoller: { roll: async () => ({ kind: "rolled", totals: [12], summary: "12" }) },
    loadCustomMonsters: async () => [monster], saveCustomMonster: save,
  });
  apps.push(app); await app.start();
  root.querySelector<HTMLButtonElement>('[data-gm-section="content"]')!.click();
  root.querySelector<HTMLButtonElement>('[data-action="edit-custom-monster"]')!.click();
  const form = () => root.querySelector<HTMLFormElement>('[data-action="save-custom-monster"]')!;
  // Happy DOM's HTML parser does not initialize selected option properties.
  // Match a browser's initial select values before exercising the save flow.
  for (const select of form().querySelectorAll<HTMLSelectElement>("select")) {
    const selected = select.querySelector<HTMLOptionElement>("option[selected]");
    if (selected) select.value = selected.value;
  }
  const submit = () => form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  return { root, app, save, monster, form, submit };
}

function enter(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  control.value = value; control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("monster editor", () => {
  it("round trips multiline descriptions, pipe characters, usage and custom defenses without losing entries", async () => {
    const f = await editor();
    const trait = f.form().querySelector('[data-feature-section="traits"]')!;
    expect(trait.querySelector<HTMLInputElement>('[data-feature-part="name"]')!.value).toBe("Disciplina | residual");
    expect(trait.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("Primera línea | alternativa\nSegunda línea.");
    // Even a committed change without an input event is collected before saving.
    trait.querySelector<HTMLTextAreaElement>("textarea")!.value = "Línea uno | elección\nLínea dos | alternativa";
    const strength = f.form().querySelector<HTMLInputElement>('[name="abilityStr"]')!;
    enter(strength, "20");
    expect(strength.parentElement!.querySelector("output")!.textContent).toBe("+5");
    f.submit();
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(1));
    const [saved, previousKey] = f.save.mock.calls[0]!;
    expect(previousKey).toBe(f.monster.name);
    expect(saved.traits).toEqual([{ name: "Disciplina | residual", content: "Línea uno | elección\nLínea dos | alternativa", usage: "1/día" }]);
    expect(saved.actions).toEqual(f.monster.actions);
    expect(saved.damageResistances).toEqual(f.monster.damageResistances);
    expect(saved.conditionImmunities).toEqual(f.monster.conditionImmunities);
    expect(saved.spells).toEqual(f.monster.spells);
    expect(saved.abilities.Str).toBe(20);
    expect(saved.initiativeAdvantage).toBe(true);
    expect(saved.type).toBe("No muerto Mediano");
    await vi.waitFor(() => expect(f.form()).toBeNull());
  });

  it("keeps added and removed rows across navigation and a failed save", async () => {
    const f = await editor();
    const actions = () => f.form().querySelector('[data-feature-section="actions"]')!;
    actions().querySelector<HTMLButtonElement>("[data-add-feature]")!.click();
    const added = actions().querySelector<HTMLElement>(".gm-monster-feature-row:last-child")!;
    enter(added.querySelector<HTMLInputElement>('[data-feature-part="name"]')!, "Eco nuevo");
    enter(added.querySelector<HTMLTextAreaElement>("textarea")!, "Descripción\ncon dos líneas | y separador");
    actions().querySelector<HTMLButtonElement>("[data-remove-feature]")!.click();
    f.root.querySelector<HTMLButtonElement>('[data-gm-section="notes"]')!.click();
    f.root.querySelector<HTMLButtonElement>('[data-gm-section="content"]')!.click();
    expect(actions().querySelectorAll(".gm-monster-feature-row")).toHaveLength(1);
    expect(actions().querySelector<HTMLInputElement>('[data-feature-part="name"]')!.value).toBe("Eco nuevo");
    f.save.mockRejectedValueOnce(new Error("No se pudo guardar"));
    const submittedForm = f.form();
    f.submit();
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(f.form()).not.toBe(submittedForm));
    expect(actions().querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("Descripción\ncon dos líneas | y separador");
    f.submit();
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(2));
    expect(f.save.mock.calls[1]![0].actions).toEqual([{ name: "Eco nuevo", content: "Descripción\ncon dos líneas | y separador", usage: "" }]);
  });

  it("creates a monster with independent matrix selections and ignores unfilled feature rows", async () => {
    const f = await editor();
    f.form().querySelector<HTMLButtonElement>('[data-action="cancel-custom-monster"]')!.click();
    f.root.querySelector<HTMLButtonElement>('[data-action="new-custom-monster"]')!.click();
    enter(f.form().querySelector<HTMLInputElement>('[name="name"]')!, "Bestia nueva");
    f.form().querySelector<HTMLSelectElement>('[name="type"]')!.value = "Bestia";
    for (const [name, value] of [["vulnerabilities", "fire"], ["resistances", "cold"], ["immunities", "poison"]]) {
      const checkbox = f.form().querySelector<HTMLInputElement>(`[name="${name}"][value="${value}"]`)!;
      checkbox.checked = true; checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(f.form().querySelector("[data-defenses-count]")!.textContent).toBe("3 seleccionadas");
    f.form().querySelector<HTMLButtonElement>('[data-feature-section="actions"] [data-add-feature]')!.click();
    f.submit();
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(1));
    expect(f.save.mock.calls[0]![1]).toBeNull();
    expect(f.save.mock.calls[0]![0]).toMatchObject({ name: "Bestia nueva", damageVulnerabilities: ["fire"], damageResistances: ["cold"], damageImmunities: ["poison"], actions: [] });
  });

  it("filters spells without changing selections, including spells outside the loaded catalog", () => {
    document.body.innerHTML = `<form>${renderMonsterSpells(["Bola de fuego", "Curación", "Escudo"], ["Conjuro propio"])}</form>`;
    const form = document.querySelector("form")!; bindMonsterEditor(form);
    const search = form.querySelector<HTMLInputElement>("[data-monster-spell-search]")!;
    enter(search, "curacion");
    const visible = () => [...form.querySelectorAll<HTMLLabelElement>(".gm-checkbox-group label")].filter((label) => !label.hidden);
    expect(visible().map((label) => label.textContent)).toEqual(["Curación"]);
    const cure = visible()[0]!.querySelector<HTMLInputElement>("input")!;
    cure.checked = true; cure.dispatchEvent(new Event("change", { bubbles: true }));
    enter(search, "");
    const selectedOnly = form.querySelector<HTMLInputElement>("[data-monster-spells-selected]")!;
    selectedOnly.checked = true; selectedOnly.dispatchEvent(new Event("change", { bubbles: true }));
    expect(visible()).toHaveLength(2);
    expect(new FormData(form).getAll("spells")).toEqual(["Conjuro propio", "Curación"]);
    expect(form.querySelector("[data-spell-count]")!.textContent).toBe("2 seleccionados");
  });
});
