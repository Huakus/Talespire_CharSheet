import { organizeCharacters } from "../../src/application/gm/character-organization";
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { CombatSessionRepository, ACTIVE_COMBAT_ID } from "../../src/infrastructure/persistence/combat-session-repository";
import { GmApp } from "../../src/ui/gm-app";
import { BrowserApp } from "../../src/ui/browser-app";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import { createGuidedFighter } from "../../src/domain/character/fighter-builder";
import { defaultFighterCreation } from "../../src/domain/character/fighter-builder-catalog";

const diceRoller = { roll: async () => ({ kind: "rolled" as const, totals: [12], summary: "12" }) };
const apps: GmApp[] = [];
afterEach(() => { apps.splice(0).forEach(app => app.stop()); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); localStorage.clear(); });
async function fixture(configure?: (snapshot: CampaignSnapshot) => void) {
  const source = new InMemoryCampaignRepository(), application = new CampaignApplication(source);
  let s = await application.createCampaign();
  s = await application.createCharacter({ name: "Kai", expectedCampaignChecksum: s.checksum });
  const character = Object.values(s.campaign.characters)[0]!;
  s = await application.createCharacter({ name: "Otro personaje", expectedCampaignChecksum: s.checksum });
  const other = Object.values(s.campaign.characters).find(c => c.id !== character.id)!;
  const root = document.createElement("div"); document.body.append(root);
  const repository = new CombatSessionRepository(source), combat = new EncounterApplication(repository);
  let state = (await repository.load())!, encounter = state.campaign.encounters[ACTIVE_COMBAT_ID]!;
  state = await combat.synchronizeTaleSpireInitiative({ encounterId: encounter.id, expectedEncounterRevision: encounter.revision, expectedCampaignChecksum: state.checksum, queue: { items: [{ id: "mini-kai", name: "Kai", kind: "creature" }], activeItemIndex: 0, retainUnlisted: false } });
  encounter = state.campaign.encounters[ACTIVE_COMBAT_ID]!;
  await combat.associateCharacter({ encounterId: encounter.id, combatantId: encounter.combatants[0]!.id, characterId: character.id, expectedEncounterRevision: encounter.revision, expectedCampaignChecksum: state.checksum });
  const manage = vi.fn((command: Parameters<CampaignApplication["administerCharacter"]>[0]) => application.administerCharacter(command));
  if (configure) { const snapshot = (await source.load())!; configure(snapshot); await source.save(snapshot.campaign, { kind: "checksum", checksum: snapshot.checksum }); }
  const organize = vi.fn((command: Parameters<typeof organizeCharacters>[1]) => organizeCharacters(source, command));
  const open = vi.fn(async () => {});
  const app = new GmApp(root, combat, { diceRoller, monsters: [], manageCharacter: manage, organizeCharacters: organize, openCharacter: open });
  apps.push(app); await app.start();
  root.querySelector<HTMLButtonElement>('[data-gm-section="characters"]')!.click();
  return { source, application, character, other, root, manage, organize, open };
}

describe("GM character administration", () => {
  it("sorts visible sheets before hidden sheets and alphabetizes each state", async () => {
    const f = await fixture(snapshot => {
      const characters = Object.values(snapshot.campaign.characters);
      characters[0]!.name = "Ana"; characters[0]!.archived = true;
      characters[1]!.name = "Zoe";
    });
    expect([...f.root.querySelectorAll('[data-managed-character] > summary > strong')].map(e => e.textContent)).toEqual(["Zoe", "Ana"]);
    expect(f.root.textContent).toContain("Sin registro de tutorial");
    expect(f.root.textContent).not.toContain("Archivado");
  });

  it("identifies guided creation from the stored builder record", async () => {
    const guided = await createGuidedFighter("chr_33333333333333333333333333333333", "build_33333333333333333333333333333333", defaultFighterCreation("Tutorial"), "2026-10-30T12:00:00Z");
    const f = await fixture(snapshot => { snapshot.campaign.characters[guided.id] = guided; });
    const card = f.root.querySelector<HTMLDetailsElement>(`[data-managed-character="${guided.id}"]`)!;
    expect(card.querySelector(".gm-character-origin")!.textContent).toBe("Creado con tutorial");
    expect(card.open).toBe(false);
  });

  it("creates collapsible groups, moves sheets and applies group visibility together", async () => {
    const f = await fixture();
    const name = f.root.querySelector<HTMLInputElement>('[data-character-new-group] input')!;
    name.value = "Aventureros"; name.dispatchEvent(new Event("input", { bubbles: true }));
    f.root.querySelector<HTMLFormElement>('[data-character-new-group]')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(f.root.querySelector('[data-character-group] > summary')?.textContent).toContain("Aventureros"));
    const id = (await f.source.load())!.campaign.gm.characterGroups![0]!.id;
    for (const character of [f.character, f.other]) {
      const card = f.root.querySelector<HTMLDetailsElement>(`[data-managed-character="${character.id}"]`)!;
      card.open = true;
      const select = card.querySelector<HTMLSelectElement>('[data-character-move]')!;
      select.value = id; select.dispatchEvent(new Event("change", { bubbles: true }));
      await vi.waitFor(async () => expect((await f.source.load())!.campaign.gm.characterGroups![0]!.characterIds).toContain(character.id));
      await vi.waitFor(() => expect(f.root.querySelector<HTMLSelectElement>(`[data-managed-character="${character.id}"] [data-character-move]`)!.disabled).toBe(false));
    }
    expect(f.root.querySelectorAll('[data-character-group] [data-managed-character]')).toHaveLength(2);
    f.root.querySelector<HTMLButtonElement>('[data-group-action="hide"]')!.click();
    expect(f.organize.mock.calls.at(-1)?.[0].action.kind).toBe("set-group-hidden");
    await vi.waitFor(async () => expect(Object.values((await f.source.load())!.campaign.characters).every(c => c.archived)).toBe(true));
    await vi.waitFor(() => expect(f.root.querySelector<HTMLButtonElement>('[data-group-action="show"]')!.disabled).toBe(false));
    expect(f.root.querySelector('[data-character-group] > summary')!.textContent).toContain("2 ocultas");
    f.root.querySelector<HTMLButtonElement>('[data-group-action="show"]')!.click();
    await vi.waitFor(async () => expect(Object.values((await f.source.load())!.campaign.characters).every(c => !c.archived)).toBe(true));
  });

  it("starts with collapsed name-only cards and opens a sheet without expanding its card", async () => {
    const f = await fixture();
    const card = f.root.querySelector<HTMLDetailsElement>(`[data-managed-character="${f.character.id}"]`)!;
    expect(card.open).toBe(false);
    expect(card.querySelector(":scope > summary")!.textContent).toBe("KaiAbrir");
    expect(card.querySelector('[data-character-action="link"]')).toBeNull();
    expect(card.querySelector('[data-character-action="unlink"]')).toBeNull();
    card.querySelector<HTMLButtonElement>('[data-character-action="open"]')!.click();
    await vi.waitFor(() => expect(f.open).toHaveBeenCalledWith(f.character.id));
    expect(f.root.querySelector<HTMLDetailsElement>(`[data-managed-character="${f.character.id}"]`)!.open).toBe(false);
  });
  it("archives/restores a sheet and removes an already selected archived character from the player selector", async () => {
    const f = await fixture();
    const playerRoot = document.createElement("div"); document.body.append(playerRoot);
    let refresh: (snapshot: CampaignSnapshot) => void = () => {};
    const player = new BrowserApp(playerRoot, f.application, { diceRoller, storageLabel: "test", subscribeCampaignChanges: listener => { refresh = listener; return () => {}; } });
    await player.start();
    const select = playerRoot.querySelector<HTMLSelectElement>("#character-title-select")!;
    select.value = f.character.id; select.dispatchEvent(new Event("change", { bubbles: true }));
    f.root.querySelector<HTMLButtonElement>(`[data-managed-character="${f.character.id}"] [data-character-action="archive"]`)!.click();
    await vi.waitFor(() => expect(f.root.querySelector(`[data-managed-character="${f.character.id}"]`)?.textContent).toContain("Oculto"));
    expect(f.root.querySelector(`[data-managed-character="${f.character.id}"]`)?.getAttribute("data-character-archived")).toBe("true");
    refresh((await f.source.load())!);
    expect([...playerRoot.querySelectorAll<HTMLOptionElement>("#character-title-select option")].map(o => o.value)).toEqual([f.other.id]);
    f.root.querySelector<HTMLButtonElement>(`[data-managed-character="${f.character.id}"] [data-character-action="restore"]`)!.click();
    await vi.waitFor(async () => expect((await f.source.load())!.campaign.characters[f.character.id]!.archived).toBe(false));
    player.stop();
  });
  it("requires confirmation and deletes only the selected sheet while clearing combat and miniature references", async () => {
    const f = await fixture(), confirm = vi.fn(() => { throw new Error("Native confirm unavailable"); }); vi.stubGlobal("confirm", confirm);
    const button = () => f.root.querySelector<HTMLButtonElement>(`[data-managed-character="${f.character.id}"] [data-character-action="delete"]`)!;
    button().click(); expect(confirm).not.toHaveBeenCalled(); expect(f.manage).not.toHaveBeenCalled();
    expect(document.querySelector(".confirm-action-dialog")?.textContent).toContain(f.character.name);
    document.querySelector<HTMLButtonElement>(".confirm-action-dialog footer button")!.click();
    await vi.waitFor(() => expect(button().disabled).toBe(false));
    button().click(); document.querySelector<HTMLButtonElement>("[data-confirm-action]")!.click();
    await vi.waitFor(async () => expect((await f.source.load())!.campaign.characters[f.character.id]).toBeUndefined());
    const saved = (await f.source.load())!;
    expect(saved.campaign.characters[f.other.id]).toEqual(f.other);
    expect(saved.campaign.gm.miniatureAssociations?.["mini-kai"]?.characterId).toBeNull();
    expect(saved.campaign.encounters[ACTIVE_COMBAT_ID]!.combatants[0]).toMatchObject({ kind: "custom", initiative: null, taleSpireCreatureId: "mini-kai" });
  });
  it("refuses stale administration rather than overwriting a changed sheet", async () => {
    const f = await fixture();
    let s = (await f.source.load())!;
    s = await f.application.editCharacter({ characterId: f.character.id, expectedCharacterRevision: f.character.revision, expectedCampaignChecksum: s.checksum, patch: { name: "Nombre actualizado" } });
    await expect(f.application.administerCharacter({ characterId: f.character.id, expectedCharacterRevision: f.character.revision, expectedCampaignId: s.campaign.id, action: "archive" })).rejects.toThrow("La hoja cambió");
    expect((await f.source.load())!.campaign.characters[f.character.id]!.name).toBe("Nombre actualizado");
  });
});
