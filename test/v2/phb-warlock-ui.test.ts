// @vitest-environment happy-dom
import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createGuidedWarlock,advanceGuidedWarlock } from "../../src/domain/character/warlock-builder";
import { phbWarlockCreation,completeWarlockChoice } from "../fixtures/phb-warlock-builder";
import type { WarlockPatron,PactBoon } from "../../src/domain/character/warlock-model";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
const time = "2026-10-14T00:00:00.000Z",id = "chr_11111111111111111111111111111111",operation = "build_11111111111111111111111111111111";
const diceRoller = { roll: vi.fn(async () => ({ kind: "rolled" as const,totals: [7],summary: "d8: 7" })) };
const dialog = () => document.querySelector<HTMLDialogElement>(".character-builder-dialog")!;
const field = (name: string) => dialog().querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`)!;
async function set(name: string,value: string) { const old = field(name); old.value = value; old.dispatchEvent(new Event("change",{ bubbles: true })); await vi.waitFor(() => { if (old instanceof HTMLSelectElement) expect(field(name)).not.toBe(old); expect(field(name).value).toBe(value); }); }
const submit = () => dialog().querySelector("form")!.dispatchEvent(new Event("submit",{ bubbles: true,cancelable: true }));
const stage = (name: string) => vi.waitFor(() => expect(dialog().querySelector('[aria-current="step"]')!.textContent,dialog().querySelector('[role="alert"]')!.textContent ?? "").toContain(name));
async function next(name: string) { submit(); await stage(name); }
async function build(level: number,boon: PactBoon = "tome") { let c = await createGuidedWarlock(id,operation,phbWarlockCreation(),time); while (c.identity.level < level) c = await advanceGuidedWarlock(c,completeWarlockChoice(c,boon),time); return c; }
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(async () => { dialog()?.close(); await new Promise((r) => setTimeout(r,0)); document.body.replaceChildren(); });
describe("warlock tutorial and sheet", () => {
  it.each((["archfey","fiend","great-old-one"] as WarlockPatron[]).flatMap((patron) => (["blade","chain","tome"] as PactBoon[]).map((boon) => ({ patron,boon }))))("creates $patron / $boon at level three through the actual tutorial", async ({ patron,boon }) => {
    const application = new CampaignApplication(new InMemoryCampaignRepository()); let snapshot = await application.createCampaign(time);
    const onCreate = vi.fn(async (operationId,creation,initialLevels) => { snapshot = await application.createGuidedCharacter({ operationId,creation,initialLevels,expectedCampaignChecksum: snapshot.checksum }); });
    const options = { campaignId: snapshot.campaign.id,name: "Wyll",diceRoller,onCreate,onAdvance: vi.fn() };
    await openCharacterBuilder(options); await set("classKey","warlock"); await set("warlockPatron",patron); await set("startingLevel","3");
    await next("Atributos"); expect(field("ability_charisma").value).toBe("15");
    await next("Formación"); expect(field("style")).toBeNull();
    await set("warlockCantrip0","eldritch-blast"); await set("warlockCantrip1","mage-hand"); await set("warlockLearn0","armor-of-agathys"); await set("warlockLearn1","hex");
    await next("Equipo"); expect(field("warlockPrimary")).not.toBeNull(); await next("Nivel 2");
    await set("warlockLearn0","charm-person"); await set("warlockInvocation0","agonizing-blast"); await set("warlockInvocation1","armor-of-shadows");
    await set("hpMethod","rolled"); dialog().querySelector<HTMLButtonElement>("[data-builder-roll]")!.click(); await vi.waitFor(() => expect(field("hpBase").value).toBe("7"));
    await next("Nivel 3"); await set("warlockLearn0","darkness"); await set("warlockBoon",boon);
    if (boon === "blade") await set("warlockPactWeapon","longsword");
    if (boon === "tome") { for (const [i,key] of ["guidance","thorn-whip","vicious-mockery"].entries()) await set(`warlockTome${i}`,key); await set("warlockInvocationOld","armor-of-shadows"); await set("warlockInvocationNew","book-of-ancient-secrets"); await set("warlockRitual0","find-familiar"); await set("warlockRitual1","identify"); }
    dialog().querySelector<HTMLButtonElement>("[data-builder-close]")!.click(); await vi.waitFor(() => expect(dialog()).toBeNull());
    await openCharacterBuilder(options); await stage("Nivel 3"); expect(field("warlockBoon").value).toBe(boon);
    await next("Revisar"); expect(dialog().textContent).toContain("Brujo"); expect(Object.keys(snapshot.campaign.characters)).toHaveLength(0);
    submit(); await vi.waitFor(() => expect(Object.keys(snapshot.campaign.characters)).toHaveLength(1));
    const character = Object.values(snapshot.campaign.characters)[0]!; expect(character.builder!.classKey).toBe("warlock"); expect(character.identity.level).toBe(3); expect(character.combat.hitDice.dieSize).toBe(8);
  });
  it("shows pact-known casting, free invocation casting and the book availability controls", async () => {
    const repository = new InMemoryCampaignRepository(),application = new CampaignApplication(repository),character = await build(3);
    let snapshot = await application.createCampaign(time); snapshot.campaign.characters[character.id] = character; snapshot = await repository.save(snapshot.campaign,{ kind: "checksum",checksum: snapshot.checksum });
    const root = document.createElement("div"); document.body.append(root); const app = new BrowserApp(root,application,{ storageLabel: "test",diceRoller });
    const view = app as unknown as { snapshot: CampaignSnapshot; selectedCharacterId: string;activeSheetTab: string;sheetMode: string;render(): void };
    Object.assign(view,{ snapshot,selectedCharacterId: character.id,activeSheetTab: "spells",sheetMode: "play" }); view.render();
    expect(root.querySelector("[data-warlock-panel]")).not.toBeNull();
    const card = (key: string,source = "known") => { const s = view.snapshot.campaign.characters[character.id]!.spellcasting.spells.find((s) => s.casting?.key === key && s.casting.source === `builder:warlock:${source}`)!; return root.querySelector<HTMLElement>(`[data-spell-id="${s.id}"]`)!; };
    expect(card("hex").querySelector<HTMLSelectElement>("[data-cast-slot-level]")!.value).toBe("2");
    const revision = character.revision; card("hex").querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.click(); await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.revision).toBeGreaterThan(revision));
    expect(view.snapshot.campaign.characters[character.id]!.spellcasting.slots["2"]!.used).toBe(1);
    root.querySelector<HTMLButtonElement>('[data-warlock-action="book-access"]')!.click(); await vi.waitFor(() => expect(view.snapshot.campaign.characters[character.id]!.spellcasting.warlock!.bookAvailable).toBe(false));
    expect(card("guidance","tome").querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.disabled).toBe(true);
    expect(card("find-familiar","ritual").querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.disabled).toBe(true);
  });
  it("provides at-will casting with all pact slots spent and arcanum choices at the proper level", async () => {
    const character = await build(10,"blade"),onAdvance = vi.fn();
    await openCharacterBuilder({ campaignId: "arcanum-ui",character,diceRoller,onCreate: vi.fn(),onAdvance });
    expect(field("warlockArcanum")).not.toBeNull(); const choice = completeWarlockChoice(character,"blade");
    await set("warlockLearn0",choice.warlock.learn[0]!); await set("warlockArcanum",choice.warlock.arcanum);
    await next("Revisar"); submit(); await vi.waitFor(() => expect(onAdvance).toHaveBeenCalledTimes(1)); expect(onAdvance.mock.calls[0]![0].warlock.arcanum).toBe(choice.warlock.arcanum);
    character.spellcasting.slots["5"]!.used = 2;
    const root = document.createElement("div"); document.body.append(root); const app = new BrowserApp(root,new CampaignApplication(new InMemoryCampaignRepository()),{ storageLabel: "test",diceRoller });
    const repository = new InMemoryCampaignRepository(); let snap = await new CampaignApplication(repository).createCampaign(time); snap.campaign.characters[character.id] = character;
    const view = app as unknown as { snapshot: CampaignSnapshot;selectedCharacterId: string;sheetMode: string;activeSheetTab: string;render(): void };
    Object.assign(view,{ snapshot: snap,selectedCharacterId: character.id,sheetMode: "play",activeSheetTab: "spells" }); view.render();
    const armor = character.spellcasting.spells.find((s) => s.casting?.source === "builder:warlock:invocation-armor-of-shadows")!,card = root.querySelector(`[data-spell-id="${armor.id}"]`)!;
    expect(card.querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.disabled).toBe(false); expect(card.querySelector("[data-cast-slot-level]")!.textContent).toContain("A voluntad");
  });
});
