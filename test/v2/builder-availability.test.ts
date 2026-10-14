// @vitest-environment happy-dom
import { describe,it,expect } from "vitest";
import { applyBuilderAvailability } from "../../src/ui/builder-availability";
import { phbWizardCreation } from "../fixtures/phb-wizard-builder";
import { defaultClericCreation } from "../../src/domain/character/cleric-catalog";
import { wizardInitialFields } from "../../src/ui/wizard-builder-fields";
import { clericEquipmentFields } from "../../src/ui/cleric-builder-fields";
import { localizedCharacter,localizedSpellDefinition } from "../../src/ui/localized-spells";
import { PHB_SPELLS } from "../../src/domain/character/phb-spells";
import { createGuidedWizard } from "../../src/domain/character/wizard-builder";
describe("tutorial option availability",() => {
  it("preserves explicitly authored GM spell variants when localizing official references",() => {
    const definition = { ...PHB_SPELLS["fire-bolt"]!,name: "Fire Bolt",damageExpression: "9d20",catalog: { contentKey: "gm:test",origin: "gm" as const,tags: [],revision: 1 } };
    expect(localizedSpellDefinition(definition)).toEqual(definition);
  });
  it("removes selected spells from every other learning selector while preserving each own choice",() => {
    const c = phbWizardCreation(), form = document.createElement("form"); form.innerHTML = wizardInitialFields(c);
    form.querySelectorAll<HTMLSelectElement>("select").forEach((select) => { select.value = select.querySelector<HTMLOptionElement>("[selected]")?.value ?? ""; });
    applyBuilderAvailability(form,c,null,null);
    for (let i=0;i<6;i++) {
      const control = form.querySelector<HTMLSelectElement>(`[name="wizardLearn${i}"]`)!;
      expect(control.value).toBe(c.wizard.learn[i]);
      for (const [j,key] of c.wizard.learn.entries()) expect(!!control.querySelector(`option[value="${key}"]`)).toBe(i===j);
    }
    c.race = "forest-gnome";c.wizard.cantrips = ["fire-bolt","mage-hand","acid-splash"];form.innerHTML = wizardInitialFields(c);
    applyBuilderAvailability(form,c,null,null);
    expect(form.querySelector('option[value="minor-illusion"]')).toBeNull();
  });
  it("disables background skills already granted by class and explains the source",() => {
    const c = phbWizardCreation(), form = document.createElement("form"); c.skills = ["arcana","history"];
    form.innerHTML = '<label>Trasfondo<select name="backgroundSkill0"><option value="arcana">Arcano</option><option value="athletics" selected>Atletismo</option></select></label>';
    applyBuilderAvailability(form,c,null,null);
    const option = form.querySelector<HTMLOptionElement>('[value="arcana"]')!; expect(option.disabled).toBe(true); expect(option.textContent).toContain("por tu clase"); expect(option.title).toContain("por tu clase");
  });
  it("disables unavailable cleric equipment and racial feat prerequisites",() => {
    const c = defaultClericCreation(); c.cleric.domain = "knowledge";
    const form = document.createElement("form"); form.innerHTML = clericEquipmentFields(c)+'<select name="levelFeatKey"><option value="dragon-hide">Piel de Dragón</option><option value="alert">Alerta</option></select>';
    applyBuilderAvailability(form,c,null,null);
    expect(form.querySelector<HTMLOptionElement>('[value="warhammer"]')!.disabled).toBe(true);
    expect(form.querySelector<HTMLOptionElement>('[value="chain-mail"]')!.disabled).toBe(true);
    expect(form.querySelector<HTMLOptionElement>('[value="dragon-hide"]')!.disabled).toBe(true);
    expect(form.querySelector<HTMLOptionElement>('[value="alert"]')!.disabled).toBe(false);
  });
  it("localizes existing managed spells for display without mutating campaign data",async () => {
    const c = await createGuidedWizard("chr_00000000000000000000000000000001","build_00000000000000000000000000000001",phbWizardCreation(),"2026-10-14T00:00:00Z");
    const spell = c.spellcasting.spells.find((s) => s.casting?.key === "fire-bolt")!; spell.name = "Fire Bolt"; spell.definition!.name = "Fire Bolt"; spell.definition!.description = "Old English text";
    const original = JSON.stringify(c), rendered = localizedCharacter(c);
    expect(rendered.spellcasting.spells.find((s) => s.id===spell.id)!.name).toBe("Saeta de fuego");
    expect(rendered.spellcasting.spells.find((s) => s.id===spell.id)!.definition!.description).not.toContain("Old English");
    expect(JSON.stringify(c)).toBe(original);
  });
});
