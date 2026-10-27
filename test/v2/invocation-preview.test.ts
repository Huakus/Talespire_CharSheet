// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createGuidedWarlock } from "../../src/domain/character/warlock-builder";
import { FighterLevelChoiceSchema } from "../../src/domain/character/character-builder-model";
import { phbWarlockCreation } from "../fixtures/phb-warlock-builder";
import { warlockLevelFields } from "../../src/ui/warlock-builder-fields";
import { applyBuilderAvailability } from "../../src/ui/builder-availability";
import { bindDialogSelects } from "../../src/ui/dialog-selects";
import { INVOCATIONS } from "../../src/domain/character/warlock-catalog";

afterEach(() => document.body.replaceChildren());
describe("invocation details before choosing", () => {
  it("shows an option's rules on hover and keyboard preview without committing or changing the build", async () => {
    const c = await createGuidedWarlock("chr_11111111111111111111111111111111", "build_11111111111111111111111111111111", phbWarlockCreation(), "2026-10-26T12:00:00Z");
    const choice = FighterLevelChoiceSchema.parse({ operationId: "build_22222222222222222222222222222222", level: 2, hpMethod: "fixed", hpBase: 5, abilityIncrease: null, subclass: null, additionalStyle: null });
    const original = JSON.stringify(choice), dialog = document.createElement("dialog");
    dialog.innerHTML = `<form>${warlockLevelFields(c.builder!, choice)}</form>`; document.body.append(dialog); dialog.showModal();
    applyBuilderAvailability(dialog.querySelector("form")!, c.builder!.creation, c, choice);
    const controls = bindDialogSelects(dialog), select = dialog.querySelector<HTMLSelectElement>('[name="warlockInvocation0"]')!;
    const button = dialog.querySelector<HTMLButtonElement>('[data-dialog-select="warlockInvocation0"]')!;
    button.click();
    const option = [...select.options].find(o => o.dataset.description && !o.disabled)!;
    option.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const preview = dialog.querySelector('[data-option-preview="warlockInvocation0"]')!;
    expect(preview.textContent).toContain(INVOCATIONS[option.value]!.description);
    expect(preview.textContent).toContain("Brujo"); expect(select.value).toBe(""); expect(JSON.stringify(choice)).toBe(original);
    select.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); await Promise.resolve();
    expect(preview.textContent).toContain(INVOCATIONS[select.value]!.description);
    select.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); expect(select.value).toBe("");
    const catalog = select.closest(".dialog-select-field")!.querySelector(".dialog-option-catalog")!;
    const disabled = [...select.options].find(o => o.disabled && o.dataset.description)!;
    expect(catalog.textContent).toContain(disabled.dataset.description!); expect(catalog.textContent).toContain(disabled.title);
    controls.dispose(); dialog.close();
  });
});
