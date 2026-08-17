import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";

const time = "2026-08-01T12:00:00.000Z";

describe("EncounterApplication", () => {
  it("creates, mutates and deletes persisted encounters with checksum expectations", async () => {
    const repository = new InMemoryCampaignRepository();
    const campaigns = new CampaignApplication(repository);
    const encounters = new EncounterApplication(repository);
    const empty = await campaigns.createCampaign(time);
    const created = await encounters.createEncounter("Prueba", empty.checksum, time);
    const encounter = Object.values(created.campaign.encounters)[0]!;
    const withCombatant = await encounters.addCombatant({
      encounterId: encounter.id,
      expectedEncounterRevision: encounter.revision,
      expectedCampaignChecksum: created.checksum,
      updatedAt: time,
      combatant: {
        kind: "custom",
        name: "Objetivo",
        initiative: 10,
        armorClass: 12,
        hitPoints: { current: 5, maximum: 5, temporary: 0 },
        conditions: [],
        visibleToPlayers: true,
      },
    });
    const updatedEncounter = withCombatant.campaign.encounters[encounter.id]!;
    const combatantId = updatedEncounter.combatants[0]!.id;
    const damaged = await encounters.apply({
      encounterId: encounter.id,
      expectedEncounterRevision: updatedEncounter.revision,
      expectedCampaignChecksum: withCombatant.checksum,
      updatedAt: time,
      action: { kind: "damage", combatantId, amount: 3 },
    });
    expect(damaged.snapshot.campaign.encounters[encounter.id]?.combatants[0]?.hitPoints.current).toBe(2);
    const damagedEncounter = damaged.snapshot.campaign.encounters[encounter.id]!;
    const conditioned = await encounters.addCondition({
      encounterId: encounter.id,
      combatantId,
      key: "prone",
      label: "Derribado",
      expectedEncounterRevision: damagedEncounter.revision,
      expectedCampaignChecksum: damaged.snapshot.checksum,
      updatedAt: time,
    });
    expect(conditioned.campaign.encounters[encounter.id]?.combatants[0]?.conditions[0]).toMatchObject({ key: "prone", label: "Derribado" });
    const conditionedEncounter = conditioned.campaign.encounters[encounter.id]!;
    const withoutCombatant = await encounters.apply({
      encounterId: encounter.id,
      expectedEncounterRevision: conditionedEncounter.revision,
      expectedCampaignChecksum: conditioned.checksum,
      updatedAt: time,
      action: { kind: "remove-combatant", combatantId },
    });
    expect(withoutCombatant.snapshot.campaign.encounters[encounter.id]?.combatants).toEqual([]);
    expect((await repository.load())?.campaign.encounters[encounter.id]?.combatants).toEqual([]);
    const deleted = await encounters.deleteEncounter(encounter.id, withoutCombatant.snapshot.checksum, time);
    expect(deleted.campaign.encounters).toEqual({});
  });

  it("persists the TaleSpire initiative link through the campaign repository", async () => {
    const repository = new InMemoryCampaignRepository();
    const campaigns = new CampaignApplication(repository);
    const application = new EncounterApplication(repository);
    const empty = await campaigns.createCampaign(time);
    const created = await application.createEncounter("Cola nativa", empty.checksum, time);
    const encounter = Object.values(created.campaign.encounters)[0]!;
    const withGoblin = await application.addCombatant({
      encounterId: encounter.id,
      expectedEncounterRevision: encounter.revision,
      expectedCampaignChecksum: created.checksum,
      updatedAt: time,
      combatant: {
        kind: "monster",
        monsterDefinitionId: "goblin",
        name: "Goblin",
        initiative: 14,
        armorClass: 15,
        hitPoints: { current: 7, maximum: 7, temporary: 0 },
        conditions: [],
        visibleToPlayers: true,
      },
    });
    const current = withGoblin.campaign.encounters[encounter.id]!;
    const linked = await application.associateMiniature({
      encounterId: encounter.id,
      combatantId: current.combatants[0]!.id,
      miniature: { creatureId: "creature-goblin", displayName: "Goblin mini", boardAssetId: "asset-goblin" },
      expectedEncounterRevision: current.revision,
      expectedCampaignChecksum: withGoblin.checksum,
      updatedAt: time,
    });
    const linkedEncounter = linked.campaign.encounters[encounter.id]!;
    await application.synchronizeTaleSpireInitiative({
      encounterId: encounter.id,
      expectedEncounterRevision: linkedEncounter.revision,
      expectedCampaignChecksum: linked.checksum,
      updatedAt: time,
      queue: {
        items: [{ id: "creature-goblin", name: "Goblin", kind: "creature" }],
        activeItemIndex: 0,
        roundDelta: 1,
      },
    });
    const persisted = (await repository.load())!.campaign.encounters[encounter.id]!;
    expect(persisted.activeCombatantId).toBe(persisted.combatants[0]?.id);
    expect(persisted.round).toBe(2);
    expect(persisted.combatants[0]).toMatchObject({
      taleSpireCreatureId: "creature-goblin",
      initiative: 14,
      hitPoints: { current: 7, maximum: 7, temporary: 0 },
    });
    expect((await repository.load())!.campaign.gm.miniatureAssociations["creature-goblin"]).toMatchObject({
      displayName: "Goblin mini",
      monster: { definitionId: "goblin" },
    });
    const beforeEdit = (await repository.load())!;
    const refreshed = await application.refreshMonsterDefinition("goblin", {
      definitionId: "goblin-editado",
      name: "Goblin editado",
      armorClass: 17,
      hitPoints: 9,
    }, beforeEdit.checksum, time);
    expect(refreshed.campaign.encounters[encounter.id]?.combatants[0]).toMatchObject({
      name: "Goblin editado",
      monsterDefinitionId: "goblin-editado",
      armorClass: 17,
      hitPoints: { current: 9, maximum: 9 },
    });
    expect(refreshed.campaign.gm.miniatureAssociations["creature-goblin"]?.monster?.definitionId).toBe("goblin-editado");
  });

  it("refreshes linked character hit points, armor class and conditions from the sheet", async () => {
    const repository = new InMemoryCampaignRepository();
    const campaigns = new CampaignApplication(repository);
    const application = new EncounterApplication(repository);
    const empty = await campaigns.createCampaign(time);
    const withCharacter = await campaigns.createCharacter({ name: "Heroína", expectedCampaignChecksum: empty.checksum, createdAt: time });
    const character = Object.values(withCharacter.campaign.characters)[0]!;
    const withEncounter = await application.createEncounter("Personajes", withCharacter.checksum, time);
    const encounter = Object.values(withEncounter.campaign.encounters)[0]!;
    const withCombatant = await application.addCombatant({
      encounterId: encounter.id,
      expectedEncounterRevision: encounter.revision,
      expectedCampaignChecksum: withEncounter.checksum,
      updatedAt: time,
      combatant: {
        kind: "player",
        characterId: character.id,
        taleSpireClientId: null,
        name: character.name,
        initiative: null,
        armorClass: character.combat.armorClass,
        hitPoints: character.combat.hitPoints,
        conditions: [],
        visibleToPlayers: true,
      },
    });
    const edited = await campaigns.editCharacter({
      characterId: character.id,
      expectedCharacterRevision: character.revision,
      expectedCampaignChecksum: withCombatant.checksum,
      patch: { combat: { armorClass: 18, hitPoints: { current: 4, maximum: 12, temporary: 2 } } },
      updatedAt: time,
    });
    const synchronized = await application.synchronizeCharacters(edited.checksum, time);
    expect(synchronized.campaign.encounters[encounter.id]?.combatants[0]).toMatchObject({
      armorClass: 18,
      hitPoints: { current: 4, maximum: 12, temporary: 2 },
    });
  });

  it("restores encounter and GM workspace state for GM undo/redo", async () => {
    const repository = new InMemoryCampaignRepository();
    const campaigns = new CampaignApplication(repository);
    const application = new EncounterApplication(repository);
    const empty = await campaigns.createCampaign(time);
    const created = await application.createEncounter("Reversible", empty.checksum, time);
    const encounterId = Object.keys(created.campaign.encounters)[0]!;
    const restored = await application.restoreGmControlState({
      expectedCampaignChecksum: created.checksum,
      encounters: {},
      workspace: {
        noteGroups: [{ id: "gmg_11111111111111111111111111111111", title: "Log", notes: [] }],
        randomTables: [],
        googleDocsUrl: "",
      },
      updatedAt: time,
    });
    expect(restored.campaign.encounters[encounterId]).toBeUndefined();
    expect(restored.campaign.gm.noteGroups[0]?.title).toBe("Log");
    expect(restored.campaign.revision).toBe(created.campaign.revision + 1);
  });
});
