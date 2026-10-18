// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCharacterBuilder } from "../../src/ui/character-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createGuidedFighter, advanceGuidedFighter } from "../../src/domain/character/fighter-builder";
import { phbFighterCreation, completeFighterChoice } from "../fixtures/phb-fighter-builder";
import { BrowserApp } from "../../src/ui/browser-app";
import type { DiceRollRequest } from "../../src/application/ports/dice-roller";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";

const time = "2026-10-13T00:00:00.000Z", id = "chr_11111111111111111111111111111111", operation = "build_11111111111111111111111111111111";
const diceRoller = { roll: vi.fn(async (_request: DiceRollRequest) => ({ kind: "rolled" as const, summary: "4d6", totals: [6,5,4,1] })) };
const dialog = () => document.querySelector<HTMLDialogElement>(".character-builder-dialog")!;
const field = (name: string) => dialog().querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
async function set(name: string, value: string) {
  const previous = field(name);
  field(name).value = value;
  field(name).dispatchEvent(new Event("change", { bubbles: true }));
  await vi.waitFor(() => { if (previous instanceof HTMLSelectElement) expect(field(name)).not.toBe(previous); expect(field(name)?.value).toBe(value); });
}
const submit = () => dialog().querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
const stage = async (title: string) => vi.waitFor(() => expect(dialog().querySelector('[aria-current="step"]')?.textContent, dialog().querySelector('[role="alert"]')?.textContent ?? "").toContain(title));
async function next(title: string) { submit(); await stage(title); }
async function basePages() { await next("Atributos"); await next("Formación"); }
async function levelThree(subclass: "battle-master" | "eldritch-knight") {
  await set("subclass", subclass);
  if (subclass === "battle-master") {
    await set("artisanTool", "Herramientas de carpintero");
    await set("maneuver0", "parry"); await set("maneuver1", "riposte"); await set("maneuver2", "trip-attack");
  } else {
    await set("magicCantrip0", "fire-bolt"); await set("magicCantrip1", "ray-of-frost");
    await set("magicLearn0", "shield"); await set("magicLearn1", "magic-missile"); await set("magicLearn2", "find-familiar");
  }
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(async () => { dialog()?.close(); await new Promise((resolve) => setTimeout(resolve,0)); document.body.replaceChildren(); });

describe("PHB fighter tutorial", () => {
  it.each(["battle-master", "eldritch-knight"] as const)("creates and resumes a level-three %s through the real tutorial", async (subclass) => {
    const application = new CampaignApplication(new InMemoryCampaignRepository());
    let snapshot = await application.createCampaign(time);
    const onCreate = vi.fn(async (operationId, creation, initialLevels) => { snapshot = await application.createGuidedCharacter({ operationId, creation, initialLevels, expectedCampaignChecksum: snapshot.checksum }); });
    const options = { campaignId: snapshot.campaign.id, name: "Ada", diceRoller, onCreate, onAdvance: vi.fn() };
    await openCharacterBuilder(options);
    expect((field("race") as HTMLSelectElement).options).toHaveLength(15);
    await set("startingLevel", "3");
    await basePages();
    expect((field("backgroundPreset") as HTMLSelectElement).options).toHaveLength(18);
    await set("backgroundPreset", "knight");
    await next("Equipo"); await next("Nivel 2"); await next("Nivel 3");
    await levelThree(subclass);
    dialog().querySelector<HTMLButtonElement>("[data-builder-close]")!.click();
    await vi.waitFor(() => expect(dialog()).toBeNull());
    await openCharacterBuilder(options); await stage("Nivel 3");
    expect(field("subclass").value).toBe(subclass);
    expect(field(subclass === "battle-master" ? "maneuver2" : "magicLearn2").value).toBe(subclass === "battle-master" ? "trip-attack" : "find-familiar");
    await next("Revisar");
    expect(dialog().textContent).toContain(subclass === "battle-master" ? "Maestro de batalla" : "Caballero arcano");
    expect(Object.keys(snapshot.campaign.characters)).toHaveLength(0);
    submit(); await vi.waitFor(() => { expect(onCreate).toHaveBeenCalledTimes(1); expect(Object.keys(snapshot.campaign.characters)).toHaveLength(1); });
    const character = Object.values(snapshot.campaign.characters)[0]!;
    expect(character.identity).toMatchObject({ level: 3, background: "Caballero" });
    expect(character.builder!.levels).toHaveLength(2);
    if (subclass === "battle-master") expect(character.proficiencies.tools).toContain("Herramientas de carpintero");
    else expect(character.spellcasting.spells.map((spell) => spell.name)).toContain("Encontrar familiar");
  });
  it("selects a variant human racial skill and a feat, with variable racial increases", async () => {
    const onCreate = vi.fn();
    await openCharacterBuilder({ campaignId: "variant", name: "Ada", diceRoller, onCreate, onAdvance: vi.fn() });
    await set("race", "human-variant"); await next("Atributos");
    await set("originAbility1", "constitution"); await next("Formación");
    await set("originSkill0", "stealth"); await set("initialFeatKey", "alert");
    await next("Equipo"); await next("Revisar");
    expect(dialog().textContent).toContain("Alerta");
    submit(); await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0]![1]).toMatchObject({ origin: { abilities: ["strength","constitution"], skills: ["stealth"] }, initialFeat: { key: "alert" } });
  });
  it("offers rolled abilities and adds the three greatest individual dice", async () => {
    await openCharacterBuilder({ campaignId: "rolled", name: "Ada", diceRoller, onCreate: vi.fn(), onAdvance: vi.fn() });
    await next("Atributos"); await set("abilityMethod", "rolled");
    await set("ability_strength", "3");
    dialog().querySelector<HTMLButtonElement>('[data-builder-ability-roll="strength"]')!.click();
    await vi.waitFor(() => expect(field("ability_strength").value).toBe("15"));
    expect(diceRoller.roll.mock.calls[0]![0]).toMatchObject({ expressions: ["1d6","1d6","1d6","1d6"] });
    await next("Formación");
  });
  it("validates the gold budget and equips purchased equipment before review", async () => {
    const onCreate = vi.fn();
    await openCharacterBuilder({ campaignId: "shop", name: "Ada", diceRoller, onCreate, onAdvance: vi.fn() });
    await basePages(); await next("Equipo"); await set("equipmentMethod", "gold");
    await set("purchaseKey", "plate-armor");
    dialog().querySelector<HTMLButtonElement>("[data-builder-add-purchase]")!.click();
    await vi.waitFor(() => expect(field("purchaseQty0")).not.toBeNull());
    submit(); await vi.waitFor(() => expect(dialog().querySelector('[role="alert"]')?.textContent).toContain("superan"));
    dialog().querySelector<HTMLButtonElement>('[data-builder-remove-purchase="0"]')!.click();
    await vi.waitFor(() => expect(field("purchaseQty0")).toBeNull());
    await set("purchaseKey", "longsword");
    dialog().querySelector<HTMLButtonElement>("[data-builder-add-purchase]")!.click();
    await vi.waitFor(() => expect(field("purchaseEquip0")).not.toBeNull());
    (field("purchaseEquip0") as HTMLInputElement).checked = true;
    field("purchaseEquip0").dispatchEvent(new Event("change", { bubbles: true }));
    await next("Revisar"); expect(dialog().textContent).toContain("85 po iniciales");
    submit(); await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0]![1].equipment.purchases).toEqual([{ key: "longsword", quantity: 1, equipped: true }]);
  });
  it("chooses Magic Initiate and all nested spell choices instead of a level-four ability increase", async () => {
    let character = await createGuidedFighter(id,operation,phbFighterCreation(),time);
    while (character.identity.level < 3) character = await advanceGuidedFighter(character,completeFighterChoice(character),time);
    const onAdvance = vi.fn(async (choice) => { character = await advanceGuidedFighter(character,choice,time); });
    await openCharacterBuilder({ campaignId: "feat", character, diceRoller, onCreate: vi.fn(), onAdvance });
    await set("asiMode", "feat"); await set("levelFeatKey", "magic-initiate"); await set("levelFeatClass", "druid");
    await set("levelFeatSpell0", "guidance"); await set("levelFeatSpell1", "shillelagh"); await set("levelFeatSpell2", "goodberry");
    await next("Revisar"); submit(); await vi.waitFor(() => expect(onAdvance).toHaveBeenCalledTimes(1));
    await onAdvance.mock.results[0]!.value;
    expect(character.identity.level).toBe(4);
    expect(character.builder!.levels.at(-1)!.abilityIncrease).toBeNull();
    expect(character.spellcasting.spells.find((spell) => spell.name === "Buenas bayas")!.casting).toMatchObject({ ability: "wisdom", kind: "innate", level: 1 });
  });
  it("casts racial magic using its pool and keeps known EK ritual spells on spell slots", async () => {
    let character = await createGuidedFighter(id,operation,phbFighterCreation("tiefling"),time);
    while (character.identity.level < 3) character = await advanceGuidedFighter(character,completeFighterChoice(character,"eldritch-knight"),time);
    character.spellcasting.spells.forEach((spell) => { spell.prepared = false; });
    const repository = new InMemoryCampaignRepository(), application = new CampaignApplication(repository);
    let snapshot = await application.createCampaign(time);
    snapshot.campaign.characters[character.id] = character;
    snapshot = await repository.save(snapshot.campaign, { kind: "checksum", checksum: snapshot.checksum });
    const root = document.createElement("div"); document.body.append(root);
    const app = new BrowserApp(root,application,{ storageLabel: "test", diceRoller });
    const view = app as unknown as { snapshot: CampaignSnapshot; selectedCharacterId: string; activeSheetTab: string; render(): void };
    view.snapshot = snapshot; view.selectedCharacterId = character.id; view.activeSheetTab = "spells"; view.render();
    const racial = character.spellcasting.spells.find((spell) => spell.name === "Reprensión infernal")!;
    const arcane = character.spellcasting.spells.find((spell) => spell.casting?.source === "builder:eldritch-knight" && spell.level === 1 && spell.definition?.ritual)!;
    const card = (spellId: string) => root.querySelector<HTMLElement>(`[data-spell-id="${spellId}"]`)!;
    expect(card(racial.id).querySelector('[data-spell-casting="source"]')!.textContent).toBe("Magia racial");
    expect(card(racial.id).querySelector('[data-spell-casting="ability"]')!.textContent).toBe("CAR");
    expect(card(racial.id).querySelector('[data-spell-action="prepare"]')).toBeNull();
    expect(card(arcane.id).querySelector('option[value="ritual"]')).toBeNull();
    expect(card(arcane.id).querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.disabled).toBe(false);
    card(racial.id).querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.click();
    await vi.waitFor(() => expect(view.snapshot.campaign.characters[id]!.revision).toBe(character.revision+1));
    expect(view.snapshot.campaign.characters[id]!.spellcasting.slots["1"]!.used).toBe(0);
    expect(view.snapshot.campaign.characters[id]!.traits.flatMap((g) => g.traits).find((t) => t.id === racial.casting!.traitId)!.uses.used).toBe(1);
    await vi.waitFor(() => expect(card(racial.id).querySelector<HTMLButtonElement>('[data-spell-action="cast"]')!.disabled).toBe(true));
  });
});
