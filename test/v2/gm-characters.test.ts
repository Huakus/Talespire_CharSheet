// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { CombatSessionRepository, ACTIVE_COMBAT_ID } from "../../src/infrastructure/persistence/combat-session-repository";
import { GmApp } from "../../src/ui/gm-app";
import { BrowserApp } from "../../src/ui/browser-app";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";

const diceRoller = { roll: async () => ({ kind: "rolled" as const, totals: [12], summary: "12" }) };
const apps: GmApp[] = [];
afterEach(() => { apps.splice(0).forEach(app => app.stop()); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); localStorage.clear(); });
async function fixture() {
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
  const app = new GmApp(root, combat, { diceRoller, monsters: [], manageCharacter: manage, openCharacter: vi.fn(async () => {}) });
  apps.push(app); await app.start();
  root.querySelector<HTMLButtonElement>('[data-gm-section="characters"]')!.click();
  return { source, application, character, other, root, manage };
}

describe("GM character administration", () => {
  it("archives/restores a sheet and removes an already selected archived character from the player selector", async () => {
    const f = await fixture();
    const playerRoot = document.createElement("div"); document.body.append(playerRoot);
    let refresh: (snapshot: CampaignSnapshot) => void = () => {};
    const player = new BrowserApp(playerRoot, f.application, { diceRoller, storageLabel: "test", subscribeCampaignChanges: listener => { refresh = listener; return () => {}; } });
    await player.start();
    const select = playerRoot.querySelector<HTMLSelectElement>("#character-title-select")!;
    select.value = f.character.id; select.dispatchEvent(new Event("change", { bubbles: true }));
    f.root.querySelector<HTMLButtonElement>(`[data-managed-character="${f.character.id}"] [data-character-action="archive"]`)!.click();
    await vi.waitFor(() => expect(f.root.querySelector(`[data-managed-character="${f.character.id}"]`)?.textContent).toContain("Archivado"));
    refresh((await f.source.load())!);
    expect([...playerRoot.querySelectorAll<HTMLOptionElement>("#character-title-select option")].map(o => o.value)).toEqual([f.other.id]);
    f.root.querySelector<HTMLButtonElement>(`[data-managed-character="${f.character.id}"] [data-character-action="restore"]`)!.click();
    await vi.waitFor(async () => expect((await f.source.load())!.campaign.characters[f.character.id]!.archived).toBe(false));
    player.stop();
  });
  it("requires confirmation and deletes only the selected sheet while clearing combat and miniature references", async () => {
    const f = await fixture(), confirm = vi.fn(() => false); vi.stubGlobal("confirm", confirm);
    const button = () => f.root.querySelector<HTMLButtonElement>(`[data-managed-character="${f.character.id}"] [data-character-action="delete"]`)!;
    button().click(); expect(confirm).toHaveBeenCalled(); expect(f.manage).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); button().click();
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
