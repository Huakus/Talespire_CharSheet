// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { CombatSessionRepository, ACTIVE_COMBAT_ID } from "../../src/infrastructure/persistence/combat-session-repository";
afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });

it("routes the sheet header initiative roll with its character and combat epoch", async () => {
  const source = new InMemoryCampaignRepository(), application = new CampaignApplication(source);
  let s = await application.createCampaign();
  s = await application.createCharacter({ name: "Kai", expectedCampaignChecksum: s.checksum });
  const character = Object.values(s.campaign.characters)[0]!;
  const repository = new CombatSessionRepository(source), combat = new EncounterApplication(repository);
  let state = (await repository.load())!, encounter = state.campaign.encounters[ACTIVE_COMBAT_ID]!;
  state = await combat.synchronizeTaleSpireInitiative({ encounterId: encounter.id, expectedEncounterRevision: encounter.revision, expectedCampaignChecksum: state.checksum,
    queue: { items: [{ id: "mini", name: "Kai", kind: "creature" }], activeItemIndex: 0, retainUnlisted: false } });
  encounter = state.campaign.encounters[ACTIVE_COMBAT_ID]!;
  state = await combat.associateCharacter({ encounterId: encounter.id, combatantId: encounter.combatants[0]!.id, characterId: character.id, expectedEncounterRevision: encounter.revision, expectedCampaignChecksum: state.checksum });
  const roll = vi.fn(async () => ({ kind: "submitted" as const, totals: [], summary: "Bandeja" })), sendInitiative = vi.fn();
  const root = document.createElement("div"); document.body.append(root);
  const sheet = new BrowserApp(root, application, { storageLabel: "Test", diceRoller: { roll }, sendInitiative });
  await sheet.start();
  try {
    const button = root.querySelector<HTMLButtonElement>(".hero-initiative"); expect(button).not.toBeNull(); button!.click();
    await vi.waitFor(() => expect(roll).toHaveBeenCalledOnce());
    expect(roll).toHaveBeenCalledWith(expect.objectContaining({ characterId: character.id, purpose: "initiative", encounterId: ACTIVE_COMBAT_ID,
      initiativeEpoch: state.campaign.encounters[ACTIVE_COMBAT_ID]!.initiativeEpoch, correlationId: expect.any(String), expressions: ["1d20+0"] }));
    expect(sendInitiative).not.toHaveBeenCalled(); // Native dice have not resolved yet.
  } finally { sheet.stop(); }
});
