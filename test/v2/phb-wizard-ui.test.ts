// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createGuidedWizard, advanceGuidedWizard } from "../../src/domain/character/wizard-builder";
import { phbWizardCreation, completeWizardChoice } from "../fixtures/phb-wizard-builder";
import { WIZARD_SCHOOLS,wizardTraditionName } from "../../src/domain/character/wizard-catalog";
import type { WizardSchool } from "../../src/domain/character/character-builder-model";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import type { DiceRollRequest } from "../../src/application/ports/dice-roller";
import { BrowserApp } from "../../src/ui/browser-app";
const time = "2026-10-14T00:00:00.000Z", id = "chr_11111111111111111111111111111111", operation = "build_11111111111111111111111111111111";
const diceRoller = { roll: vi.fn(async (_request: DiceRollRequest) => ({ kind: "rolled" as const,totals: [5],summary: "d6: 5" })) };
const dialog = () => document.querySelector<HTMLDialogElement>(".character-builder-dialog")!;
const field = (name: string) => dialog().querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
async function set(name: string,value: string) { const previous = field(name); previous.value = value; previous.dispatchEvent(new Event("change",{ bubbles: true })); await vi.waitFor(() => { if (previous instanceof HTMLSelectElement) expect(field(name)).not.toBe(previous); expect(field(name)?.value).toBe(value); }); }
const submit = () => dialog().querySelector("form")!.dispatchEvent(new Event("submit",{ bubbles: true,cancelable: true }));
const stage = (title: string) => vi.waitFor(() => expect(dialog().querySelector('[aria-current="step"]')?.textContent,dialog().querySelector('[role="alert"]')?.textContent ?? "").toContain(title));
async function next(title: string) { submit(); await stage(title); }
async function initialMagic() {
  for (const [i,key] of ["fire-bolt","mage-hand","minor-illusion"].entries()) await set(`wizardCantrip${i}`,key);
  for (const [i,key] of ["mage-armor","shield","magic-missile","detect-magic","find-familiar","sleep"].entries()) await set(`wizardLearn${i}`,key);
}
async function build(level: number,school: WizardSchool = "evocation") { let c = await createGuidedWizard(id,operation,phbWizardCreation(),time); while (c.identity.level < level) c = await advanceGuidedWizard(c,completeWizardChoice(c,school),time); return c; }
async function mount(character: CharacterV2) {
  const repository = new InMemoryCampaignRepository(), application = new CampaignApplication(repository);
  let snapshot = await application.createCampaign(time); snapshot.campaign.characters[character.id] = character;
  snapshot = await repository.save(snapshot.campaign,{ kind: "checksum",checksum: snapshot.checksum });
  const root = document.createElement("div"); document.body.append(root);
  const app = new BrowserApp(root,application,{ storageLabel: "test",diceRoller });
  const view = app as unknown as { snapshot: CampaignSnapshot; selectedCharacterId: string; activeSheetTab: string; sheetMode: string; render(): void };
  view.snapshot = snapshot; view.selectedCharacterId = character.id; view.activeSheetTab = "spells"; view.render();
  const current = () => view.snapshot.campaign.characters[id]!;
  const cast = (key: string) => { const spell = current().spellcasting.spells.find((s) => s.casting?.kind === "wizard" && s.casting.key === key)!; return root.querySelector<HTMLElement>(`[data-spell-id="${spell.id}"]`)!; };
  async function click(selector: string) { const revision = current().revision; root.querySelector<HTMLButtonElement>(selector)!.click(); await vi.waitFor(() => expect(current().revision).toBe(revision+1)); await vi.waitFor(() => expect(root.querySelector("[data-wizard-panel]")).not.toBeNull()); }
  return { root,view,current,cast,click };
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(async () => { dialog()?.close(); await new Promise((resolve) => setTimeout(resolve,0)); document.body.replaceChildren(); });

describe("wizard tutorial and play controls", () => {
  it.each(Object.keys(WIZARD_SCHOOLS) as WizardSchool[])("creates a level-two %s wizard and resumes every choice from a draft", async (school) => {
    const application = new CampaignApplication(new InMemoryCampaignRepository()); let snapshot = await application.createCampaign(time);
    const onCreate = vi.fn(async (operationId,creation,initialLevels) => { snapshot = await application.createGuidedCharacter({ operationId,creation,initialLevels,expectedCampaignChecksum: snapshot.checksum }); });
    const options = { campaignId: snapshot.campaign.id,name: "Merlín",diceRoller,onCreate,onAdvance: vi.fn() };
    await openCharacterBuilder(options); await set("classKey","wizard"); await set("startingLevel","2");
    await next("Atributos"); await next("Formación"); expect(field("style")).toBeNull(); await initialMagic();
    await next("Equipo"); expect(field("wizardWeapon")).not.toBeNull(); expect(dialog().textContent).toContain("libro de conjuros");
    await next("Nivel 2");
    expect((field("subclass") as HTMLSelectElement).options.length).toBe(10);
    await set("subclass",school); await set("wizardLearn0","alarm"); await set("wizardLearn1","burning-hands");
    if (school === "illusion") await set("wizardBonusCantrip","acid-splash");
    await set("hpMethod","rolled"); dialog().querySelector<HTMLButtonElement>("[data-builder-roll]")!.click();
    await vi.waitFor(() => expect(field("hpBase").value).toBe("5"));
    expect(diceRoller.roll.mock.calls[0]![0].expressions).toEqual(["1d6"]);
    dialog().querySelector<HTMLButtonElement>("[data-builder-close]")!.click(); await vi.waitFor(() => expect(dialog()).toBeNull());
    await openCharacterBuilder(options); await stage("Nivel 2"); expect(field("subclass").value).toBe(school); expect(field("wizardLearn1").value).toBe("burning-hands");
    await next("Revisar"); expect(dialog().textContent).toContain(wizardTraditionName(school));
    expect(Object.keys(snapshot.campaign.characters)).toHaveLength(0);
    submit(); await vi.waitFor(() => { expect(onCreate).toHaveBeenCalledTimes(1); expect(Object.keys(snapshot.campaign.characters)).toHaveLength(1); });
    const character = Object.values(snapshot.campaign.characters)[0]!;
    expect(character.identity).toMatchObject({ className: "Mago",level: 2,subclass: wizardTraditionName(school) });
    expect(character.combat.hitDice.dieSize).toBe(6);
  });
  it("casts an unprepared book ritual, blocks rituals with a lost book and still casts prepared spells", async () => {
    const { current,cast,click } = await mount(await build(1));
    expect(cast("find-familiar").querySelector<HTMLSelectElement>("[data-cast-slot-level]")!.value).toBe("ritual");
    await click(`[data-spell-id="${current().spellcasting.spells.find((s) => s.casting?.key === "find-familiar")!.id}"] [data-spell-action="cast"]`);
    expect(current().spellcasting.slots["1"]!.used).toBe(0);
    await click('[data-wizard-action="book-access"]');
    await vi.waitFor(() => expect(cast("find-familiar").querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.disabled).toBe(true));
    const shieldId = current().spellcasting.spells.find((s) => s.casting?.key === "shield")!.id;
    await click(`[data-spell-id="${shieldId}"] [data-spell-action="cast"]`);
    expect(current().spellcasting.slots["1"]!.used).toBe(1);
  });
  it("copies a spell, creates a backup book and changes the active book through the actual sheet", async () => {
    const character = await build(1); character.currency.gold = 300;
    const { root,current,click } = await mount(character);
    const key = root.querySelector<HTMLSelectElement>('[data-wizard-field="copy-key"]')!; key.value = "alarm"; key.dispatchEvent(new Event("change",{ bubbles: true }));
    expect(root.querySelector("[data-wizard-copy-cost]")!.textContent).toContain("50 po");
    await click('[data-wizard-action="copy"]'); expect(current().currency.gold).toBe(250);
    expect(current().spellcasting.spells.find((s) => s.casting?.kind === "wizard" && s.casting.key === "alarm")!.prepared).toBe(false);
    await click('[data-wizard-action="backup-book"]'); expect(current().spellcasting.wizard!.backups).toHaveLength(1);
    const backupId = current().spellcasting.wizard!.backups[0]!.id;
    await click('[data-wizard-action="book-access"]');
    await click(`[data-wizard-action="use-backup-${backupId}"]`);
    expect(current().spellcasting.wizard!.bookAvailable).toBe(true); expect(current().spellcasting.wizard!.book).toContain("alarm");
  });
  it("exposes Mastery and Signature modes and spends their own resources instead of slots", async () => {
    const { current,cast,click } = await mount(await build(20));
    const mastered = current().spellcasting.wizard!.mastery[0]!;
    const masteredSpell = current().spellcasting.spells.find((s) => s.casting?.kind === "wizard" && s.casting.key === mastered)!;
    expect(cast(mastered).querySelector<HTMLSelectElement>("[data-cast-slot-level]")!.value,cast(mastered).querySelector<HTMLSelectElement>("[data-cast-slot-level]")!.outerHTML).toBe("mastery");
    await click(`[data-spell-id="${masteredSpell.id}"] [data-spell-action="cast"]`); expect(current().spellcasting.slots["1"]!.used).toBe(0);
    const signature = current().builder!.levels.at(-1)!.wizard.signature[0]!, signatureSpell = current().spellcasting.spells.find((s) => s.casting?.key === signature)!;
    expect(cast(signature).querySelector<HTMLSelectElement>("[data-cast-slot-level]")!.value).toBe("signature");
    await click(`[data-spell-id="${signatureSpell.id}"] [data-spell-action="cast"]`); expect(current().spellcasting.slots["3"]!.used).toBe(0);
    await vi.waitFor(() => expect(cast(signature).querySelector<HTMLOptionElement>('option[value="signature"]')!.disabled).toBe(true));
  });
  it("shows only d6 for a managed wizard in the core editor", async () => {
    const { root,view } = await mount(await build(1)); view.sheetMode = "edit"; view.activeSheetTab = "summary"; view.render();
    const options = root.querySelectorAll<HTMLOptionElement>('[name="hitDieSize"] option');
    expect(Array.from(options).filter((o) => !o.disabled).map((o) => o.value)).toEqual(["6"]);
  });
});
