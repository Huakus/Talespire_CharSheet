// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { BrowserApp } from "../../src/ui/browser-app";
import { rogueCreation } from "../fixtures/rogue-builder";
import { bindDialogSelects } from "../../src/ui/dialog-selects";
import { PHB_SPELLS } from "../../src/domain/character/phb-spells";
import { FEATS } from "../../src/domain/character/phb-fighter-choices";
import { MONK_TRADITIONS, MONK_FEATURES } from "../../src/domain/character/martial-catalog";
import { SORCERER_ORIGINS, SORCERER_FEATURES } from "../../src/domain/character/sorcerer-catalog";
afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });

it("accumulates XP across several thresholds without advancing and opens the level-up tutorial only on request", async () => {
  const repository = new InMemoryCampaignRepository(), app = new CampaignApplication(repository);
  let s = await app.createCampaign();
  s = await app.createGuidedCharacter({ operationId: "build_11111111111111111111111111111111", creation: rogueCreation(), expectedCampaignChecksum: s.checksum });
  const character = Object.values(s.campaign.characters)[0]!;
  const root = document.createElement("div"); document.body.append(root);
  const sheet = new BrowserApp(root, app, { storageLabel: "Test", diceRoller: { roll: async () => ({ kind: "rolled", totals: [12], summary: "12" }) } });
  await sheet.start();
  try {
    for (const [amount, total] of [[7000, 7000], [500, 7500]]) {
      const form = root.querySelector<HTMLFormElement>("[data-gain-experience]")!;
      form.querySelector<HTMLInputElement>("[name=amount]")!.value = String(amount);
      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      await vi.waitFor(async () => expect((await repository.load())!.campaign.characters[character.id]!.identity).toMatchObject({ level: 1, experience: total }));
    }
    expect(root.querySelector(".level-up-ready")).not.toBeNull();
    expect(document.querySelector(".character-builder-dialog")).toBeNull();
    const advance = root.querySelector<HTMLButtonElement>("[data-guided-level-up]")!;
    expect(advance.disabled).toBe(false); advance.click();
    await vi.waitFor(() => expect(document.querySelector("#character-builder-title")?.textContent).toBe("Subir de nivel"));
    document.querySelector<HTMLButtonElement>("[data-builder-discard]")!.click();
    expect((await repository.load())!.campaign.characters[character.id]!.identity).toMatchObject({ level: 1, experience: 7500 });
  } finally { sheet.stop(); }
});

it.each(["wizardLearn0", "clericCantrip0", "bardSpell0", "sorcererSpell0", "druidCantrip0", "rangerSpell0", "warlockSpell0", "ekSpell0"])("previews spell rules before selecting %s", name => {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = `<label>Conjuro<select name="${name}"><option value="">Elegí</option><option value="mage-hand">Mano de mago</option></select></label>`;
  document.body.append(dialog); dialog.showModal(); const controls = bindDialogSelects(dialog);
  dialog.querySelector<HTMLButtonElement>(".dialog-select-button")!.click();
  const option = dialog.querySelector<HTMLOptionElement>('option[value="mage-hand"]')!;
  option.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(dialog.querySelector(".dialog-option-preview")?.textContent).toContain(PHB_SPELLS["mage-hand"]!.description);
  expect(dialog.querySelector("select")!.value).toBe(""); controls.dispose(); dialog.close();
});

it("previews feat rules and unavailable prerequisites before committing", () => {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = '<label>Dote<select name="featKey"><option value="">Elegí</option><option value="alert">Alerta</option><option value="war-caster" disabled title="Requiere lanzar conjuros">Lanzador de Guerra</option></select></label>';
  document.body.append(dialog); dialog.showModal(); const controls = bindDialogSelects(dialog);
  dialog.querySelector<HTMLOptionElement>('option[value="alert"]')!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(dialog.querySelector(".dialog-option-preview")?.textContent).toContain(FEATS.alert.description);
  expect(dialog.querySelector(".dialog-option-catalog")?.textContent).toContain("Requiere lanzar conjuros");
  expect(dialog.querySelector("select")!.value).toBe(""); controls.dispose(); dialog.close();
});

it("keeps class-specific descriptions distinct when catalog keys overlap", () => {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = `<label>Monje<select name="monkSubclass"><option value="shadow">${MONK_TRADITIONS.shadow}</option></select></label><label>Hechicero<select name="sorcererSubclass"><option value="shadow">${SORCERER_ORIGINS.shadow}</option></select></label>`;
  document.body.append(dialog); dialog.showModal(); const controls = bindDialogSelects(dialog);
  expect(dialog.querySelector<HTMLOptionElement>('[name="monkSubclass"] option')!.dataset.description).toContain(MONK_FEATURES.shadow[0]!.description);
  expect(dialog.querySelector<HTMLOptionElement>('[name="sorcererSubclass"] option')!.dataset.description).toContain(SORCERER_FEATURES.shadow[0]!.description);
  controls.dispose(); dialog.close();
});
