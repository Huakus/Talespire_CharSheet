import { describe, expect, it } from "vitest";
import { nativeCombatFixture } from "../fixtures/native-combat";
import { CombatSessionRepository, ACTIVE_COMBAT_ID } from "../../src/infrastructure/persistence/combat-session-repository";
import { EncounterApplication } from "../../src/application/encounter/encounter-application";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
const combat = (s: CampaignSnapshot) => s.campaign.encounters[ACTIVE_COMBAT_ID]!;
const expected = (s: CampaignSnapshot) => ({ encounterId: ACTIVE_COMBAT_ID, expectedEncounterRevision: combat(s).revision, expectedCampaignChecksum: s.checksum });
async function setup() {
  const f = await nativeCombatFixture(), repository = new CombatSessionRepository(f.source), encounter = new EncounterApplication(repository), app = new CampaignApplication(f.source);
  let state = (await repository.load())!;
  state = await encounter.synchronizeTaleSpireInitiative({ ...expected(state), queue: { ...f.queue, retainUnlisted: false } });
  return { ...f, repository, encounter, app, state };
}
describe("direct combat data updates", () => {
  it.each([0, -2, 17])("saves a sheet roll directly without TS transport and preserves existing initiative %s", async value => {
    const f = await setup(), epoch = combat(f.state).initiativeEpoch;
    const before = (await f.source.load())!.campaign.characters[f.character.id];
    const request = { characterId: f.character.id, initiative: value, encounterId: ACTIVE_COMBAT_ID, epoch, rollId: "sheet-roll" };
    const first = (await f.app.recordCharacterInitiative(request))!;
    const repeated = (await f.app.recordCharacterInitiative({ ...request, initiative: 20, rollId: "second-roll" }))!;
    expect(combat(repeated).combatants.find(c => c.kind === "player")?.initiative).toBe(value);
    expect(repeated.checksum).toBe(first.checksum);
    expect(repeated.campaign.characters[f.character.id]).toEqual(before);
  });
  it("ignores a native result after clearing initiative and does not create an out-of-combat participant", async () => {
    const f = await setup(), epoch = combat(f.state).initiativeEpoch;
    const cleared = (await f.encounter.apply({ ...expected(f.state), action: { kind: "clear-initiatives" } })).snapshot;
    await f.app.recordCharacterInitiative({ characterId: f.character.id, initiative: 18, encounterId: ACTIVE_COMBAT_ID, epoch, rollId: "stale-roll" });
    expect(combat((await f.source.load())!).combatants.find(c => c.kind === "player")?.initiative).toBeNull();
    await f.app.recordCharacterInitiative({ characterId: f.character.id, initiative: 18, encounterId: "enc_11111111111111111111111111111111", epoch, rollId: "no-combat" });
    expect(combat((await f.source.load())!).combatants).toEqual(combat(cleared).combatants);
  });
  it("links from GM administration atomically to the sheet, association and existing combat miniature", async () => {
    const f = await setup();
    const base = (await f.source.load())!, character = base.campaign.characters[f.character.id]!;
    const linked = await f.app.linkCharacterMiniature({ characterId: character.id, expectedCharacterRevision: character.revision, expectedCampaignChecksum: base.checksum,
      miniature: { creatureId: "mini-new", displayName: "Guardia de la torre", boardAssetId: "asset-new" } });
    expect(linked.campaign.characters[character.id]!.taleSpire?.creatureId).toBe("mini-new");
    expect(linked.campaign.gm.miniatureAssociations?.["mini-new"]?.characterId).toBe(character.id);
    expect(linked.campaign.gm.miniatureAssociations?.["mini-hero"]?.characterId).toBeNull();
    expect(combat(linked).combatants.find(c => c.taleSpireCreatureId === "mini-new")).toMatchObject({ kind: "player", characterId: character.id, name: character.name });
    expect(combat(linked).combatants.find(c => c.taleSpireCreatureId === "mini-hero")?.kind).toBe("custom");
  });
});
describe("combatant identity", () => {
  it("allocates the smallest free suffix, persists a custom name and keeps it after queue/profile refresh", async () => {
    const f = await setup(); let s = f.state;
    const id = combat(s).combatants.find(c => c.taleSpireCreatureId === "mini-new")!.id;
    const monster = { definitionId: f.monster.id, name: f.monster.name, armorClass: 15, hitPoints: 7 };
    s = await f.encounter.associateMonster({ ...expected(s), combatantId: id, monster });
    expect(combat(s).combatants.find(c => c.id === id)?.name).toBe(`${f.monster.name} 1`);
    s = (await f.encounter.apply({ ...expected(s), action: { kind: "rename-combatant", combatantId: id, name: "Centinela del puente" } })).snapshot;
    expect(s.campaign.gm.miniatureAssociations?.["mini-new"]).toMatchObject({ combatantName: "Centinela del puente", monster: { name: f.monster.name } });
    s = await f.encounter.synchronizeTaleSpireInitiative({ ...expected(s), queue: { ...f.queue, activeItemIndex: 1, retainUnlisted: false } });
    s = await f.encounter.refreshMonsterDefinition(f.monster.id, { ...monster, name: "Goblin revisado" }, s.checksum);
    expect(combat(s).combatants.find(c => c.id === id)).toMatchObject({ name: "Centinela del puente", taleSpireDisplayName: "Guardia de la torre" });
    const hero = combat(s).combatants.find(c => c.kind === "player")!;
    await expect(f.encounter.apply({ ...expected(s), action: { kind: "rename-combatant", combatantId: hero.id, name: "Otro" } })).rejects.toThrow("se toma de su hoja");
  });
});
