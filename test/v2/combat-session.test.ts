import { describe, expect, it, vi } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { GmWorkspaceApplication } from "../../src/application/gm/gm-workspace-application";
import { ACTIVE_COMBAT_ID, CombatSessionRepository } from "../../src/infrastructure/persistence/combat-session-repository";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import { createCharacter } from "../../src/domain/character/create-character";
import { diffCampaignFragments, fragmentCampaign } from "../../src/infrastructure/remote/campaign-fragments";

const now = "2026-10-20T12:00:00Z";
const characterId = "chr_11111111111111111111111111111111";
const monster = { definitionId: "goblin", name: "Goblin", armorClass: 15, hitPoints: 7 };
const entry = (id: string) => ({ id, name: `Mini ${id}`, kind: "creature" });
const combat = (snapshot: CampaignSnapshot) => Object.values(snapshot.campaign.encounters)[0]!;
const expected = (snapshot: CampaignSnapshot) => ({
  encounterId: combat(snapshot).id, expectedEncounterRevision: combat(snapshot).revision,
  expectedCampaignChecksum: snapshot.checksum,
});

async function setup() {
  const source = new InMemoryCampaignRepository();
  const initial = await new CampaignApplication(source).createCampaign(now);
  initial.campaign.characters[characterId] = createCharacter(characterId, "Delerion", now);
  await source.save(initial.campaign, { kind: "checksum", checksum: initial.checksum });
  const repository = new CombatSessionRepository(source);
  const application = new EncounterApplication(repository);
  return { source, repository, application, snapshot: (await repository.load())! };
}

describe("native combat session", () => {
  it("automatically saves one active combat and restores initiative, HP and conditions after reopening", async () => {
    const { source, application, snapshot } = await setup();
    const save = vi.spyOn(source, "save");
    let next = await application.synchronizeTaleSpireInitiative({ ...expected(snapshot),
      queue: { items: [entry("a")], activeItemIndex: 0, retainUnlisted: false } });
    const id = combat(next).combatants[0]!.id;
    next = (await application.apply({ ...expected(next), action: { kind: "set-initiative", combatantId: id, initiative: 18 } })).snapshot;
    expect(save).toHaveBeenCalled();
    next = await application.associateMonster({ ...expected(next), combatantId: id, monster });
    next = (await application.apply({ ...expected(next), action: { kind: "set-initiative", combatantId: id, initiative: 18 } })).snapshot;
    next = (await application.apply({ ...expected(next), action: { kind: "damage", combatantId: id, amount: 2 } })).snapshot;
    next = (await application.apply({ ...expected(next), action: { kind: "grant-temporary-hit-points", combatantId: id, amount: 3 } })).snapshot;
    next = await application.addCondition({ ...expected(next), combatantId: id, key: "prone", label: "Derribado" });
    const stored = (await source.load())!;
    expect(Object.keys(stored.campaign.encounters)).toEqual([ACTIVE_COMBAT_ID]);
    expect(stored.campaign.gm.miniatureAssociations?.a?.monster?.definitionId).toBe("goblin");
    const reopened = new CombatSessionRepository(source);
    const fresh = (await reopened.load())!;
    expect(combat(fresh)).toEqual(combat(next));
    const restored = await new EncounterApplication(reopened).synchronizeTaleSpireInitiative({ ...expected(fresh),
      queue: { items: [entry("a")], activeItemIndex: 0, retainUnlisted: false } });
    expect(combat(restored).combatants[0]).toMatchObject({ kind: "monster", monsterDefinitionId: "goblin", initiative: 18,
      hitPoints: { current: 5, maximum: 7, temporary: 3 }, conditions: [expect.objectContaining({ key: "prone" })] });
  });

  it("preserves live statistics on reorders and removes exactly the entries removed from TS", async () => {
    const { application, snapshot } = await setup();
    let next = await application.synchronizeTaleSpireInitiative({ ...expected(snapshot),
      queue: { items: [entry("a"), entry("b")], activeItemIndex: 0, retainUnlisted: false } });
    const id = combat(next).combatants[0]!.id;
    next = await application.associateMonster({ ...expected(next), combatantId: id, monster });
    next = (await application.apply({ ...expected(next), action: { kind: "damage", combatantId: id, amount: 3 } })).snapshot;
    next = await application.addCondition({ ...expected(next), combatantId: id, key: "prone", label: "Derribado" });
    next = (await application.apply({ ...expected(next), action: { kind: "set-initiative", combatantId: id, initiative: 19 } })).snapshot;
    next = await application.synchronizeTaleSpireInitiative({ ...expected(next),
      queue: { items: [entry("b"), entry("a")], activeItemIndex: 1, retainUnlisted: false } });
    const kept = combat(next).combatants.find((item) => item.id === id)!;
    expect(kept).toMatchObject({ initiative: 19, order: 1, hitPoints: { current: 4 } });
    expect(kept.conditions[0]?.key).toBe("prone");
    expect(combat(next).activeCombatantId).toBe(id);
    next = await application.synchronizeTaleSpireInitiative({ ...expected(next),
      queue: { items: [entry("b")], activeItemIndex: 0, retainUnlisted: false } });
    expect(combat(next).combatants.map((item) => item.taleSpireCreatureId)).toEqual(["b"]);
    next = await application.synchronizeTaleSpireInitiative({ ...expected(next),
      queue: { items: [], activeItemIndex: -1, retainUnlisted: false } });
    expect(combat(next).combatants).toEqual([]);
    expect(combat(next).activeCombatantId).toBeNull();
  });

  it("replaces monster/character associations and keeps an explicitly cleared link cleared", async () => {
    const { source, application, snapshot } = await setup();
    let next = await application.synchronizeTaleSpireInitiative({ ...expected(snapshot),
      queue: { items: [entry("a")], activeItemIndex: 0, retainUnlisted: false } });
    const combatantId = combat(next).combatants[0]!.id;
    next = await application.associateMonster({ ...expected(next), combatantId, monster });
    next = await application.associateCharacter({ ...expected(next), combatantId, characterId });
    expect(combat(next).combatants[0]).toMatchObject({ kind: "player", characterId, name: "Delerion" });
    expect((await source.load())!.campaign.gm.miniatureAssociations?.a).toMatchObject({ characterId, monster: null });
    next = await application.clearCombatantAssociation({ ...expected(next), combatantId });
    next = await application.synchronizeTaleSpireInitiative({ ...expected(next),
      queue: { items: [entry("a")], activeItemIndex: 0, retainUnlisted: false } });
    expect(combat(next).combatants[0]?.kind).toBe("custom");
    expect((await source.load())!.campaign.gm.miniatureAssociations?.a).toMatchObject({ characterId: null, monster: null });
  });

  it("saves notes and the active combat without deleting legacy encounters and rejects stale writes", async () => {
    const { source } = await setup();
    const base = (await source.load())!;
    const archived = await new EncounterApplication(source).createEncounter("Archivo", base.checksum, now);
    const repository = new CombatSessionRepository(source);
    const application = new EncounterApplication(repository);
    const snapshot = (await repository.load())!;
    let next = await application.synchronizeTaleSpireInitiative({ ...expected(snapshot),
      queue: { items: [entry("a")], activeItemIndex: 0, retainUnlisted: false } });
    const workspace = new GmWorkspaceApplication(repository);
    next = await workspace.save({ ...next.campaign.gm, googleDocsUrl: "https://example.com/notes" }, next.checksum);
    expect(combat(next).combatants).toHaveLength(1);
    const saved = (await source.load())!;
    for (const [id, encounter] of Object.entries(archived.campaign.encounters)) expect(saved.campaign.encounters[id]).toEqual(encounter);
    expect(saved.campaign.encounters[ACTIVE_COMBAT_ID]).toEqual(combat(next));
    expect(Object.keys(next.campaign.encounters)).toEqual([ACTIVE_COMBAT_ID]);
    expect((await source.load())!.campaign.gm.googleDocsUrl).toBe("https://example.com/notes");
    await expect(application.apply({ ...expected(snapshot), action: { kind: "clear-initiatives" } })).rejects.toThrow();
  });

  it("refreshes character state from its sheet while keeping its saved initiative", async () => {
    const { source, application, snapshot } = await setup();
    let next = await application.synchronizeTaleSpireInitiative({ ...expected(snapshot),
      queue: { items: [entry("a")], activeItemIndex: 0, retainUnlisted: false } });
    const combatantId = combat(next).combatants[0]!.id;
    next = await application.associateCharacter({ ...expected(next), combatantId, characterId });
    next = (await application.apply({ ...expected(next), action: { kind: "set-initiative", combatantId, initiative: 22 } })).snapshot;
    const base = (await source.load())!;
    base.campaign.characters[characterId]!.combat.hitPoints = { current: 4, maximum: 15, temporary: 2 };
    await source.save(base.campaign, { kind: "checksum", checksum: base.checksum });
    const reopened = new EncounterApplication(new CombatSessionRepository(source));
    const restored = (await reopened.loadCampaign())!;
    const refreshed = await reopened.synchronizeCharacters(restored.checksum);
    expect(combat(refreshed).combatants[0]).toMatchObject({ initiative: 22, hitPoints: { current: 4, maximum: 15, temporary: 2 } });
  });

  it("updates only the active encounter fragment and keeps the last saved state if storage fails", async () => {
    const { source, application, snapshot } = await setup();
    let next = await application.synchronizeTaleSpireInitiative({ ...expected(snapshot),
      queue: { items: [entry("a")], activeItemIndex: 0, retainUnlisted: false } });
    const combatantId = combat(next).combatants[0]!.id;
    next = await application.associateMonster({ ...expected(next), combatantId, monster });
    const before = (await source.load())!;
    next = (await application.apply({ ...expected(next), action: { kind: "damage", combatantId, amount: 2 } })).snapshot;
    const after = (await source.load())!;
    const diff = diffCampaignFragments(before.campaign, after.campaign,
      fragmentCampaign(before.campaign).map((fragment) => ({ ...fragment, revision: 4 })));
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0]).toMatchObject({ kind: "encounter", entityId: ACTIVE_COMBAT_ID, operation: "upsert", expectedRevision: 4 });
    expect(diff.characterChanges).toEqual([]);
    vi.spyOn(source, "save").mockRejectedValueOnce(new Error("storage offline"));
    await expect(application.apply({ ...expected(next), action: { kind: "damage", combatantId, amount: 1 } })).rejects.toThrow("storage offline");
    const reopened = (await new CombatSessionRepository(source).load())!;
    expect(combat(reopened).combatants[0]!.hitPoints.current).toBe(5);
  });
});
