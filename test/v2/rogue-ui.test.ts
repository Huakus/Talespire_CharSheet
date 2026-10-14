// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { ROGUE_ARCHETYPES,defaultRogueCreation } from "../../src/domain/character/rogue-catalog";
import type { RogueArchetype } from "../../src/domain/character/rogue-model";
import { rogueAt,rogueChoice } from "../fixtures/rogue-builder";
import { applyBuilderAvailability } from "../../src/ui/builder-availability";
import { rogueInitialFields,rogueLevelFields } from "../../src/ui/rogue-builder-fields";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
const diceRoller = { roll: vi.fn(async () => ({ kind:"submitted" as const,summary:"test",totals:[] })) }, time="2026-10-14T12:00:00Z";
const field=(name:string) => document.querySelector<HTMLInputElement|HTMLSelectElement>(`dialog [name="${name}"]`)!;
async function set(name:string,value:string) { const old=field(name);old.value=value;old.dispatchEvent(new Event("change",{bubbles:true}));if(old instanceof HTMLSelectElement) await vi.waitFor(() => expect(field(name)!==old).toBe(true)); }
const submit=() => document.querySelector("dialog form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
async function next(title:string) { submit();await vi.waitFor(() => expect(document.querySelector('dialog [aria-current="step"]')?.textContent).toContain(title)); }
beforeEach(() => { document.body.innerHTML="";localStorage.clear();HTMLDialogElement.prototype.showModal=function() {this.open=true;};HTMLDialogElement.prototype.close=function() {this.open=false;this.dispatchEvent(new Event("close"));}; });
afterEach(() => { document.querySelector<HTMLButtonElement>("[data-builder-discard]")?.click();document.body.innerHTML=""; });
describe("Rogue tutorial and play controls",() => {
  it.each(Object.keys(ROGUE_ARCHETYPES) as RogueArchetype[])("creates %s at level three through the real tutorial",async (archetype) => {
    const repository=new InMemoryCampaignRepository(),application=new CampaignApplication(repository);let snapshot=await application.createCampaign(time);
    await openCharacterBuilder({campaignId:archetype,name:"Pícaro",diceRoller,onAdvance:vi.fn(),onCreate:async (operationId,creation,initialLevels) => { snapshot=await application.createGuidedCharacter({operationId,creation,initialLevels,expectedCampaignChecksum:snapshot.checksum}); }});
    await set("classKey","rogue");await set("startingLevel","3");await next("Atributos");await next("Formación");
    expect(document.querySelectorAll('dialog select[name^="skill"]').length).toBe(4);expect(field("rogueExpertise1").value).toBe("thieves-tools");
    await next("Equipo");await set("rogueWeapon","shortsword");await set("rogueSecondary","shortsword");await set("roguePack","burglar");await next("Nivel 2");await next("Nivel 3");
    await set("rogueArchetype",archetype);const fixture=rogueChoice(await rogueAt(2),archetype);
    for(const [i,key] of fixture.rogue.tools.entries()) await set(`rogueTool${i}`,key);
    for(const [i,key] of fixture.rogue.languages.entries()) await set(`rogueLanguage${i}`,key);
    for(const [i,key] of fixture.rogue.cantrips.entries()) await set(`rogueCantrip${i}`,key);
    for(const [i,s] of fixture.rogue.learn.entries()) await set(`rogueLearn${i}`,s.key);
    await next("Revisar");submit();await vi.waitFor(() => expect(Object.values(snapshot.campaign.characters)).toHaveLength(1));
    const c=Object.values(snapshot.campaign.characters)[0]!;expect(c.identity.subclass).toBe(ROGUE_ARCHETYPES[archetype]);expect(c.identity.level).toBe(3);expect(c.inventory.filter((i) => i.name==="Espada corta").reduce((n,i) => n+i.quantity,0)).toBe(2);
  });
  it("disables unavailable and repeated expertise with an explanation",async () => {
    const c=defaultRogueCreation("Test"),form=document.createElement("form");form.innerHTML=rogueInitialFields(c);
    for(const select of form.querySelectorAll<HTMLSelectElement>("select")) select.value=select.querySelector<HTMLOptionElement>("[selected]")?.value ?? "";
    applyBuilderAvailability(form,c,null,null);
    expect(form.querySelector<HTMLOptionElement>('[name="rogueExpertise0"] [value="medicine"]')!.disabled).toBe(true);
    expect(form.querySelector<HTMLOptionElement>('[name="rogueExpertise0"] [value="thieves-tools"]')!.title).toContain("otra selección");
    const character=await rogueAt(5),choice=rogueChoice(character);form.innerHTML=rogueLevelFields(character.builder!,choice);
    for(const select of form.querySelectorAll<HTMLSelectElement>("select")) select.value=select.querySelector<HTMLOptionElement>("[selected]")?.value ?? "";
    applyBuilderAvailability(form,character.builder!.creation,character,choice);
    const previous=form.querySelector<HTMLOptionElement>(`[name="rogueExpertise0"] [value="${character.builder!.creation.rogue.expertise[0]}"]`)!;expect(previous.disabled).toBe(true);expect(previous.title).toContain("Ya tenés pericia");
  });
  it("hides repeated arcane trickster spells and respects school filters",async () => {
    const character=await rogueAt(2),choice=rogueChoice(character,"arcane-trickster"),form=document.createElement("form");form.innerHTML=rogueLevelFields(character.builder!,choice);
    for(const select of form.querySelectorAll<HTMLSelectElement>("select")) select.value=select.querySelector<HTMLOptionElement>("[selected]")?.value ?? "";
    applyBuilderAvailability(form,character.builder!.creation,character,choice);
    expect(form.querySelector('[name="rogueCantrip0"] [value="mage-hand"]')).toBeNull();expect(form.querySelector('[name="rogueLearn0"] [value="shield"]')).toBeNull();expect(form.querySelector('[name="rogueLearn2"] [value="shield"]')).not.toBeNull();
    expect(form.querySelector(`[name="rogueLearn1"] [value="${choice.rogue.learn[0]!.key}"]`)).toBeNull();
  });
  it("exposes tool expertise and correct d20 minimum without altering saves",async () => {
    const character=await rogueAt(11),repo=new InMemoryCampaignRepository(),application=new CampaignApplication(repo);let snapshot=await application.createCampaign(time);snapshot.campaign.characters[character.id]=character;snapshot=await repo.save(snapshot.campaign,{kind:"checksum",checksum:snapshot.checksum});
    const root=document.createElement("div");document.body.append(root);const app=new BrowserApp(root,application,{storageLabel:"test",diceRoller});const view=app as unknown as {snapshot:CampaignSnapshot;selectedCharacterId:string;activeSheetTab:string;sheetMode:string;render():void};Object.assign(view,{snapshot,selectedCharacterId:character.id,activeSheetTab:"summary",sheetMode:"play"});view.render();
    expect(root.querySelector("[data-rogue-panel]")).not.toBeNull();const select=root.querySelector<HTMLSelectElement>("[data-rogue-check]")!;select.value=character.builder!.creation.skills[0]!;select.dispatchEvent(new Event("input"));expect(root.querySelector("[data-rogue-check-result]")!.textContent).toContain("1 → 10");
    select.value="medicine";select.dispatchEvent(new Event("input"));expect(root.querySelector("[data-rogue-check-result]")!.textContent).toContain("sin mínimo especial");
    expect(root.querySelector('[data-roll-name="Herramientas de ladrón"]')!.getAttribute("data-roll-expression")).toBe("1d20+11");
  });
});
