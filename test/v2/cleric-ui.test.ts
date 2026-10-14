// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { CLERIC_DOMAINS } from "../../src/domain/character/cleric-catalog";
import type { ClericDomain } from "../../src/domain/character/cleric-model";
import { clericCreation } from "../fixtures/cleric-builder";
import { createGuidedCleric } from "../../src/domain/character/cleric-builder";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
const diceRoller = { roll: vi.fn(async () => ({ kind: "submitted" as const,summary: "test",totals: [] })) }, time = "2026-10-14T00:00:00Z";
const field = (name: string) => document.querySelector<HTMLInputElement | HTMLSelectElement>(`dialog [name="${name}"]`)!;
async function set(name: string,value: string) { const old = field(name); old.value = value; old.dispatchEvent(new Event("change",{ bubbles: true })); if (old instanceof HTMLSelectElement) await vi.waitFor(() => expect(field(name)).not.toBe(old)); }
async function next(title: string) { document.querySelector("dialog form")!.dispatchEvent(new Event("submit",{ bubbles: true,cancelable: true })); await vi.waitFor(() => expect(document.querySelector('dialog [aria-current="step"]')?.textContent).toContain(title)); }
beforeEach(() => { document.body.innerHTML=""; localStorage.clear(); HTMLDialogElement.prototype.showModal = function() { this.open=true; }; HTMLDialogElement.prototype.close = function() { this.open=false; this.dispatchEvent(new Event("close")); }; });
afterEach(() => { document.querySelector<HTMLButtonElement>("[data-builder-discard]")?.click(); document.body.innerHTML=""; });
describe("complete cleric tutorial",() => {
  it.each(Object.keys(CLERIC_DOMAINS) as ClericDomain[])("creates %s through the real tutorial",async (domain) => {
    const repository = new InMemoryCampaignRepository(), application = new CampaignApplication(repository); let snapshot = await application.createCampaign(time);
    await openCharacterBuilder({ campaignId: domain,name: "Clérigo",diceRoller,onAdvance: vi.fn(),onCreate: async (operationId,creation,initialLevels) => { snapshot = await application.createGuidedCharacter({ operationId,creation,initialLevels,expectedCampaignChecksum: snapshot.checksum }); } });
    await set("classKey","cleric"); await set("clericDomain",domain); await next("Atributos"); await next("Formación");
    for (const [i,key] of ["sacred-flame","guidance","thaumaturgy"].entries()) await set(`clericCantrip${i}`,key);
    const c = clericCreation(domain);
    for (const [i,key] of c.cleric.skills.entries()) await set(`clericSkill${i}`,key);
    for (const [i,key] of c.cleric.languages.entries()) await set(`clericLanguage${i}`,key);
    if (domain === "nature") await set("clericNatureCantrip","druidcraft");
    await next("Equipo"); expect(field("clericArmor")).not.toBeNull(); await next("Revisar");
    document.querySelector("dialog form")!.dispatchEvent(new Event("submit",{ bubbles: true,cancelable: true }));
    await vi.waitFor(() => expect(Object.values(snapshot.campaign.characters)).toHaveLength(1));
    const character = Object.values(snapshot.campaign.characters)[0]!; expect(character.builder!.creation.cleric.domain).toBe(domain); expect(character.combat.hitDice.dieSize).toBe(8);
  });
  it("limits daily preparation interactively and casts prepared rituals without slots",async () => {
    const repository = new InMemoryCampaignRepository(), application = new CampaignApplication(repository); let snapshot = await application.createCampaign(time);
    const character = await createGuidedCleric("chr_00000000000000000000000000000001","build_00000000000000000000000000000001",clericCreation("knowledge"),time);
    snapshot.campaign.characters[character.id]=character; snapshot=await repository.save(snapshot.campaign,{ kind: "checksum",checksum: snapshot.checksum });
    const root=document.createElement("div"); document.body.append(root); const app=new BrowserApp(root,application,{ storageLabel: "test",diceRoller });
    const view=app as unknown as { snapshot: CampaignSnapshot; selectedCharacterId: string;activeSheetTab: string;sheetMode: string;render(): void }; Object.assign(view,{ snapshot,selectedCharacterId: character.id,activeSheetTab: "spells",sheetMode: "play" }); view.render();
    expect(root.querySelector("[data-cleric-panel]")).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>('[data-cleric-key="identify"]')!.disabled).toBe(true);
    expect([...root.querySelectorAll<HTMLInputElement>("[data-cleric-key]")].some((i) => !i.checked && i.disabled && i.title.includes("límite"))).toBe(true);
    const check=root.querySelector<HTMLInputElement>('[data-cleric-key="detect-magic"]')!;
    for (const input of root.querySelectorAll<HTMLInputElement>("[data-cleric-key]:checked")) if (!input.disabled) { input.checked=false;input.dispatchEvent(new Event("change",{ bubbles: true })); }
    check.checked=true;check.dispatchEvent(new Event("change",{ bubbles: true }));root.querySelector<HTMLButtonElement>('[data-cleric-action="prepare"]')!.click();
    await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.revision).toBeGreaterThan(0));
    const spell=view.snapshot.campaign.characters[character.id]!.spellcasting.spells.find((s) => s.casting?.key === "detect-magic")!;
    const card=root.querySelector<HTMLElement>(`[data-spell-id="${spell.id}"]`)!;const selector=card.querySelector<HTMLSelectElement>("[data-cast-slot-level]")!;
    expect(selector.querySelector('[value="ritual"]')).not.toBeNull();selector.value="ritual";selector.dispatchEvent(new Event("change",{ bubbles: true }));card.querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.click();
    await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.revision).toBeGreaterThan(1));expect(view.snapshot.campaign.characters[character.id]!.spellcasting.slots["1"]!.used).toBe(0);
  });
});
