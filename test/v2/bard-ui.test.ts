// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { BARD_COLLEGES } from "../../src/domain/character/bard-catalog";
import type { BardCollege } from "../../src/domain/character/bard-model";
import { bardAt,bardAtTime as time } from "../fixtures/bard-builder";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
const diceRoller = { roll: vi.fn(async () => ({ kind: "rolled" as const,summary: "6",totals: [6] })) };
const field = (name: string) => document.querySelector<HTMLInputElement|HTMLSelectElement>(`dialog [name="${name}"]`)!;
async function set(name: string,value: string) { const old = field(name);old.value = value;old.dispatchEvent(new Event("change",{ bubbles: true }));if (old instanceof HTMLSelectElement) await vi.waitFor(() => expect(field(name) !== old).toBe(true)); }
const submit = () => document.querySelector("dialog form")!.dispatchEvent(new Event("submit",{ bubbles: true,cancelable: true }));
async function next(title: string) { submit();await vi.waitFor(() => expect(document.querySelector('dialog [aria-current="step"]')?.textContent).toContain(title)); }
async function available(name: string) { const select = field(name) as HTMLSelectElement;await set(name,[...select.options].find((o) => o.value && !o.disabled)!.value); }
beforeEach(() => { document.body.innerHTML = "";localStorage.clear();vi.clearAllMocks();HTMLDialogElement.prototype.showModal = function() { this.open = true; };HTMLDialogElement.prototype.close = function() { this.open = false;this.dispatchEvent(new Event("close")); }; });
afterEach(() => { document.querySelector<HTMLButtonElement>("[data-builder-discard]")?.click();document.body.innerHTML = ""; });
describe("Tutorial y ficha de Bardo",() => {
  it.each(Object.keys(BARD_COLLEGES) as BardCollege[])("crea %s con elecciones reales del tutorial",async (college) => {
    const repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo);let snapshot = await app.createCampaign(time);
    await openCharacterBuilder({ campaignId: college,name: "Bardo",diceRoller,onAdvance: vi.fn(),onCreate: async (operationId,creation,initialLevels) => { snapshot = await app.createGuidedCharacter({ operationId,creation,initialLevels,expectedCampaignChecksum: snapshot.checksum }); } });
    await set("classKey","bard");await set("startingLevel","3");await next("Atributos");await next("Formación");expect(document.querySelectorAll('dialog select[name^="skill"]').length).toBe(3);expect(field("style")).toBeNull();
    await set("bardCantrip0","vicious-mockery");expect(field("bardCantrip1").querySelector('[value="vicious-mockery"]')).toBeNull();await available("bardCantrip1");
    for (let i=0;i<4;i++) await available(`bardLearn${i}`);
    await next("Equipo");await set("bardWeapon","longsword");await set("bardPack","entertainer");await next("Nivel 2");await available("bardLearn0");await next("Nivel 3");await set("bardCollege",college);
    if (college === "lore") {
      const trained = [...(field("bardSkill0") as HTMLSelectElement).options].find((o) => o.value === "performance")!;expect(trained.disabled).toBe(true);expect(trained.title).toContain("competencia");
      for (let i=0;i<3;i++) await available(`bardSkill${i}`);
    }
    if (college === "swords") await set("bardStyle","two-weapon");
    await available("bardExpertise0");const chosen = field("bardExpertise0").value;expect((field("bardExpertise1") as HTMLSelectElement).querySelector<HTMLOptionElement>(`[value="${chosen}"]`)!.disabled).toBe(true);await available("bardExpertise1");await available("bardLearn0");
    await next("Revisar");submit();await vi.waitFor(() => expect(Object.values(snapshot.campaign.characters)).toHaveLength(1));const c = Object.values(snapshot.campaign.characters)[0]!;expect(c.identity.subclass).toBe(BARD_COLLEGES[college]);expect(c.inventory.some((i) => i.name === "Paquete de actor")).toBe(true);expect(c.checks.skills[c.builder!.levels[1]!.bard.expertise[0] as keyof typeof c.checks.skills].proficiency).toBe(2);
  });
  it("ofrece los Secretos adicionales de Conocimiento y oculta conocidos y selecciones repetidas",async () => {
    const c = await bardAt(5);await openCharacterBuilder({ campaignId: "secrets",character: c,diceRoller,onCreate: vi.fn(),onAdvance: vi.fn() });
    expect(field("bardSecret0")).not.toBeNull();expect(field("bardSecret0").querySelector('[value="vicious-mockery"]')).toBeNull();await set("bardSecret0","counterspell");expect(field("bardSecret1").querySelector('[value="counterspell"]')).toBeNull();expect(field("bardSecret1").textContent).toContain("Bola de fuego");
  });
  it("gasta inspiración mediante el panel real y lanza rituales conocidos sin consumir espacios",async () => {
    const character = await bardAt(6),repo = new InMemoryCampaignRepository(),application = new CampaignApplication(repo);let snapshot = await application.createCampaign(time);snapshot.campaign.characters[character.id] = character;snapshot = await repo.save(snapshot.campaign,{ kind: "checksum",checksum: snapshot.checksum });
    const root = document.createElement("div");document.body.append(root);const app = new BrowserApp(root,application,{ storageLabel: "test",diceRoller });const view = app as unknown as { snapshot: CampaignSnapshot;selectedCharacterId: string;activeSheetTab: string;sheetMode: string;render(): void };Object.assign(view,{ snapshot,selectedCharacterId: character.id,activeSheetTab: "summary",sheetMode: "play" });view.render();
    root.querySelector<HTMLInputElement>("[data-bard-confirm]")!.checked = true;root.querySelector<HTMLButtonElement>('[data-bard-use="cutting-words"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.spellcasting.bard!.actions).toHaveLength(1));
    view.activeSheetTab = "spells";view.render();const spell = character.spellcasting.spells.find((s) => s.casting?.key === "detect-magic")!,card = root.querySelector<HTMLElement>(`[data-spell-id="${spell.id}"]`)!;
    const slot = card.querySelector<HTMLSelectElement>("[data-cast-slot-level]")!;expect(slot.querySelector('[value="ritual"]')).not.toBeNull();slot.value = "ritual";slot.dispatchEvent(new Event("change",{ bubbles: true }));card.querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.revision).toBe(character.revision+2));expect(view.snapshot.campaign.characters[character.id]!.spellcasting.slots["1"]!.used).toBe(0);
  });
});
