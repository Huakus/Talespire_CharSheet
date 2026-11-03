// @vitest-environment happy-dom
import { it, expect } from "vitest";
import { createGuidedWarlock, advanceGuidedWarlock } from "../../src/domain/character/warlock-builder";
import { phbWarlockCreation, completeWarlockChoice } from "../fixtures/phb-warlock-builder";
import { warlockLevelFields } from "../../src/ui/warlock-builder-fields";
import { applyBuilderAvailability } from "../../src/ui/builder-availability";

it("offers Agonizing Blast under recognizable names when replacing a level-ten invocation", async () => {
  const time = "2026-11-02T12:00:00Z";
  let c = await createGuidedWarlock("chr_11111111111111111111111111111111","build_11111111111111111111111111111111",phbWarlockCreation("archfey"),time);
  while (c.identity.level < 9) {
    const choice = completeWarlockChoice(c,"blade");
    if (choice.level === 2) choice.warlock.invocations = ["armor-of-shadows","beast-speech"];
    if (choice.level === 5) choice.warlock.invocations = ["improved-pact-weapon"];
    if (choice.level === 7) choice.warlock.invocations = ["beguiling-influence"];
    if (choice.level === 9) choice.warlock.invocations = ["cloak-of-flies"];
    c = await advanceGuidedWarlock(c,choice,time);
  }
  const choice = completeWarlockChoice(c,"blade"), form = document.createElement("form");
  form.innerHTML = warlockLevelFields(c.builder!,choice);
  expect(form.textContent).toContain("En este nivel no recibís invocaciones nuevas");
  expect(form.querySelector('[name="warlockInvocation0"]')).toBeNull();
  choice.warlock.replaceInvocation = { oldKey: "beast-speech", newKey: "" };
  form.innerHTML = warlockLevelFields(c.builder!,choice);
  applyBuilderAvailability(form,c.builder!.creation,c,choice);
  const option = form.querySelector<HTMLOptionElement>('[name="warlockInvocationNew"] option[value="agonizing-blast"]')!;
  expect(option.disabled).toBe(false); expect(option.textContent).toContain("Agonizing Blast"); expect(option.textContent).toContain("Estallido agonizante");
});
