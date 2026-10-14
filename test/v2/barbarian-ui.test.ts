// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { BARBARIAN_PATHS,barbarianTotem,barbarianStorm } from "../../src/domain/character/barbarian-catalog";
import type { BarbarianPath } from "../../src/domain/character/barbarian-model";
import { barbarianAt,barbarianChoice } from "../fixtures/barbarian-builder";
import { advanceGuidedBarbarian } from "../../src/domain/character/barbarian-builder";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
const diceRoller={roll:vi.fn(async () => ({kind:"rolled" as const,summary:"12",totals:[12]}))},time="2026-10-14T16:00:00Z";
const field=(name:string) => document.querySelector<HTMLInputElement|HTMLSelectElement>(`dialog [name="${name}"]`)!;
async function set(name:string,value:string){const old=field(name);old.value=value;old.dispatchEvent(new Event("change",{bubbles:true}));if(old instanceof HTMLSelectElement)await vi.waitFor(() => expect(field(name)!==old).toBe(true));}
const submit=() => document.querySelector("dialog form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
async function next(title:string){submit();await vi.waitFor(() => expect(document.querySelector('dialog [aria-current="step"]')?.textContent).toContain(title));}
beforeEach(() => {document.body.innerHTML="";localStorage.clear();vi.clearAllMocks();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event("close"));};});
afterEach(() => {document.querySelector<HTMLButtonElement>("[data-builder-discard]")?.click();document.body.innerHTML="";});
describe("Barbarian tutorial and live UI",() => {
  it.each(Object.keys(BARBARIAN_PATHS) as BarbarianPath[])("creates %s with all required choices from the actual tutorial",async (path) => {
    const repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo);let snapshot=await app.createCampaign(time);
    await openCharacterBuilder({campaignId:path,name:"Bárbaro",diceRoller,onAdvance:vi.fn(),onCreate:async(operationId,creation,initialLevels) => {snapshot=await app.createGuidedCharacter({operationId,creation,initialLevels,expectedCampaignChecksum:snapshot.checksum});}});
    await set("classKey","barbarian");await set("startingLevel","3");await next("Atributos");await next("Formación");expect(document.querySelectorAll('dialog select[name^="skill"]').length).toBe(2);expect(field("style")).toBeNull();
    await next("Equipo");expect(field("barbarianWeapon").querySelector('[value="longbow"]')).toBeNull();await set("barbarianWeapon","greatsword");await set("barbarianSecondary","javelin");await next("Nivel 2");await set("hpMethod","rolled");document.querySelector<HTMLButtonElement>("[data-builder-roll]")!.click();await vi.waitFor(() => expect(field("hpBase").value).toBe("12"));expect(diceRoller.roll).toHaveBeenCalledWith(expect.objectContaining({expressions:["1d12"]}));await next("Nivel 3");
    await set("barbarianPath",path);if(path==="totem-warrior")await set("barbarianTotem","eagle");if(path==="storm-herald")await set("barbarianStorm","tundra");if(path==="zealot")await set("barbarianDivineDamage","necrotic");
    await next("Revisar");submit();await vi.waitFor(() => expect(Object.values(snapshot.campaign.characters)).toHaveLength(1));const c=Object.values(snapshot.campaign.characters)[0]!;expect(c.identity.subclass).toBe(`Senda del ${BARBARIAN_PATHS[path]}`);expect(c.combat.hitDice.dieSize).toBe(12);expect(c.inventory.filter((i) => i.name==="Jabalina").reduce((n,i) => n+i.quantity,0)).toBe(5);
  });
  it("chooses an independent level six totem and changes storm environments on a later level",async () => {
    let c=await barbarianAt(5,"totem-warrior",{totem:"bear"});await openCharacterBuilder({campaignId:"totem-six",character:c,diceRoller,onCreate:vi.fn(),onAdvance:async(step) => {c=await advanceGuidedBarbarian(c,step,time);}});await set("barbarianTotem","wolf");await next("Revisar");submit();await vi.waitFor(() => expect(c.identity.level).toBe(6));expect(barbarianTotem(c.builder!,3)).toBe("bear");expect(barbarianTotem(c.builder!,6)).toBe("wolf");
    c=await barbarianAt(3,"storm-herald",{storm:"desert"});await openCharacterBuilder({campaignId:"storm-four",character:c,diceRoller,onCreate:vi.fn(),onAdvance:async(step) => {c=await advanceGuidedBarbarian(c,step,time);}});await set("barbarianStorm","sea");await next("Revisar");submit();await vi.waitFor(() => expect(c.identity.level).toBe(4));expect(barbarianStorm(c.builder!)).toBe("sea");
  });
  it("shows exactly two initial gold dice",async () => {
    await openCharacterBuilder({campaignId:"gold",name:"Bárbaro",diceRoller,onCreate:vi.fn(),onAdvance:vi.fn()});await set("classKey","barbarian");await next("Atributos");await next("Formación");await next("Equipo");await set("equipmentMethod","gold");expect(document.querySelectorAll('dialog [name^="goldDie"]').length).toBe(2);expect(document.querySelector("[data-builder-gold-roll]")!.textContent).toContain("2d4");
  });
  it("starts and ends frenzy through the application, charges exhaustion and hides the generic rage bypass",async () => {
    const character=await barbarianAt(6),repo=new InMemoryCampaignRepository(),application=new CampaignApplication(repo);let snapshot=await application.createCampaign(time);snapshot.campaign.characters[character.id]=character;snapshot=await repo.save(snapshot.campaign,{kind:"checksum",checksum:snapshot.checksum});const root=document.createElement("div");document.body.append(root);const app=new BrowserApp(root,application,{storageLabel:"test",diceRoller});const view=app as unknown as {snapshot:CampaignSnapshot;selectedCharacterId:string;activeSheetTab:string;sheetMode:string;render():void};Object.assign(view,{snapshot,selectedCharacterId:character.id,activeSheetTab:"summary",sheetMode:"play"});view.render();
    expect(root.querySelector('[data-toggle-condition="raging"]')).toBeNull();root.querySelector<HTMLInputElement>("[data-barbarian-frenzy]")!.checked=true;root.querySelector<HTMLButtonElement>('[data-barbarian-action="rage"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.spellcasting.barbarian!.raging).toBe(true));expect(root.textContent).toContain("No podés lanzar conjuros");root.querySelector<HTMLButtonElement>('[data-barbarian-action="end-rage"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.combat.exhaustion).toBe(1));
  });
  it("casts totem rituals through the domain and disables them in rage",async () => {
    const character=await barbarianAt(3,"totem-warrior"),repo=new InMemoryCampaignRepository(),application=new CampaignApplication(repo);let snapshot=await application.createCampaign(time);snapshot.campaign.characters[character.id]=character;snapshot=await repo.save(snapshot.campaign,{kind:"checksum",checksum:snapshot.checksum});const root=document.createElement("div");document.body.append(root);const app=new BrowserApp(root,application,{storageLabel:"test",diceRoller});const view=app as unknown as {snapshot:CampaignSnapshot;selectedCharacterId:string;activeSheetTab:string;sheetMode:string;render():void};Object.assign(view,{snapshot,selectedCharacterId:character.id,activeSheetTab:"spells",sheetMode:"play"});view.render();
    const spell=character.spellcasting.spells.find((s) => s.casting?.key==="speak-with-animals")!,card=root.querySelector<HTMLElement>(`[data-spell-id="${spell.id}"]`)!;expect(card.textContent).toContain("Conjuro de senda");card.querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.revision).toBe(character.revision+1));
    root.querySelector<HTMLButtonElement>('[data-barbarian-action="rage"]')!.click();await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.spellcasting.barbarian!.raging).toBe(true));expect(root.querySelector<HTMLButtonElement>(`[data-spell-id="${spell.id}"] [data-spell-action="cast"]`)!.disabled).toBe(true);
  });
});
