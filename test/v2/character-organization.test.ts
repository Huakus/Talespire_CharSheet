import { describe, expect, it, vi } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { organizeCharacters, type CharacterOrganizationAction } from "../../src/application/gm/character-organization";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { CampaignRepositoryConflictError } from "../../src/application/ports/campaign-repository";
import { assembleCampaign, fragmentCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import { GmWorkspaceSchema } from "../../src/domain/gm/gm-workspace";

const groupId = "cgr_11111111111111111111111111111111";
async function setup() {
  const source = new InMemoryCampaignRepository(), app = new CampaignApplication(source);
  let snapshot = await app.createCampaign();
  snapshot = await app.createCharacter({ name: "Uno", expectedCampaignChecksum: snapshot.checksum });
  snapshot = await app.createCharacter({ name: "Dos", expectedCampaignChecksum: snapshot.checksum });
  const [one, two] = Object.keys(snapshot.campaign.characters) as [string, string];
  const execute = (action: CharacterOrganizationAction) => organizeCharacters(source, { expectedCampaignId: snapshot.campaign.id, action });
  await execute({ kind: "create-group", groupId, name: "Equipo" });
  await execute({ kind: "move-character", characterId: one, groupId, expectedGroupId: null });
  return { source, app, one, two, execute, campaignId: snapshot.campaign.id };
}

describe("GM character groups", () => {
  it("refuses generic merges that could duplicate membership across two groups", async () => {
    const f = await setup(), base = (await f.source.load())!.campaign;
    const second = "cgr_22222222222222222222222222222222", third = "cgr_33333333333333333333333333333333";
    base.gm.characterGroups!.push({ id: second, name: "Segundo", revision: 0, characterIds: [] }, { id: third, name: "Tercero", revision: 0, characterIds: [] });
    const left = structuredClone(base), right = structuredClone(base);
    left.gm.characterGroups![0]!.characterIds = []; left.gm.characterGroups![1]!.characterIds = [f.one];
    right.gm.characterGroups![0]!.characterIds = []; right.gm.characterGroups![2]!.characterIds = [f.one];
    expect(mergeCampaignChanges(base, left, right)).toMatchObject({ campaign: null, conflictPaths: ["gm.characterGroups"] });
    right.gm.characterGroups = structuredClone(base.gm.characterGroups!);
    right.characters[f.two]!.identity.playerName = "Edición ajena";
    expect(mergeCampaignChanges(base, left, right).campaign?.characters[f.two]!.identity.playerName).toBe("Edición ajena");
    expect(() => GmWorkspaceSchema.parse({ ...base.gm, characterGroups: [{ ...base.gm.characterGroups![0]!, characterIds: [f.one] }, { ...base.gm.characterGroups![1]!, characterIds: [f.one] }] })).toThrow("Una hoja sólo puede pertenecer a un grupo");
  });

  it("persists groups through granular remote fragments and leaves legacy campaigns readable", async () => {
    const f = await setup(), snapshot = (await f.source.load())!;
    const assembled = assembleCampaign({ campaignRevision: snapshot.campaign.revision, campaignUpdatedAt: snapshot.campaign.metadata.updatedAt, updatedBy: null,
      characters: Object.values(snapshot.campaign.characters).map(c => ({ characterId: c.id, revision: c.revision, createdAt: c.metadata.createdAt, updatedAt: c.metadata.updatedAt })),
      fragments: fragmentCampaign(snapshot.campaign).map(fragment => ({ ...fragment, revision: 0 })) });
    expect(assembled.gm.characterGroups).toEqual(snapshot.campaign.gm.characterGroups);
  });

  it("changes every group member's visibility in one save, preserving other sheets and combat data", async () => {
    const f = await setup();
    await f.execute({ kind: "move-character", characterId: f.two, groupId, expectedGroupId: null });
    const before = (await f.source.load())!;
    const save = vi.spyOn(f.source, "save");
    const after = await f.execute({ kind: "set-group-hidden", groupId, expectedRevision: before.campaign.gm.characterGroups![0]!.revision, hidden: true });
    expect(save).toHaveBeenCalledOnce();
    expect(Object.values(after.campaign.characters).every(c => c.archived)).toBe(true);
    expect(after.campaign.encounters).toEqual(before.campaign.encounters);
    for (const id of [f.one, f.two]) expect(after.campaign.characters[id]!.combat).toEqual(before.campaign.characters[id]!.combat);
  });

  it("rebases visibility after an unrelated concurrent sheet edit", async () => {
    const f = await setup(), originalSave = f.source.save.bind(f.source);
    vi.spyOn(f.source, "save").mockImplementationOnce(async (_campaign, _expected) => {
      const latest = (await f.source.load())!, campaign = structuredClone(latest.campaign);
      campaign.characters[f.one]!.identity.playerName = "Jugador actualizado"; campaign.characters[f.one]!.revision++; campaign.revision++;
      const concurrent = await originalSave(campaign, { kind: "checksum", checksum: latest.checksum });
      throw new CampaignRepositoryConflictError(latest.checksum, concurrent.checksum);
    });
    const after = await f.execute({ kind: "set-group-hidden", groupId, expectedRevision: 1, hidden: true });
    expect(after.campaign.characters[f.one]).toMatchObject({ archived: true, identity: { playerName: "Jugador actualizado" } });
    expect(after.campaign.characters[f.two]!.archived).toBe(false);
  });

  it("refuses bulk actions when membership has changed and prevents stale moves", async () => {
    const f = await setup();
    await f.execute({ kind: "move-character", characterId: f.two, groupId, expectedGroupId: null });
    await expect(f.execute({ kind: "set-group-hidden", groupId, expectedRevision: 1, hidden: true })).rejects.toThrow("El grupo cambió");
    await expect(f.execute({ kind: "move-character", characterId: f.one, groupId: null, expectedGroupId: null })).rejects.toThrow("cambió de grupo");
    expect(Object.values((await f.source.load())!.campaign.characters).every(c => !c.archived)).toBe(true);
  });

  it("cleans up deleted membership and dissolves a group without deleting its sheets", async () => {
    const f = await setup();
    await f.execute({ kind: "move-character", characterId: f.two, groupId, expectedGroupId: null });
    let snapshot = (await f.source.load())!;
    snapshot = await f.app.administerCharacter({ characterId: f.one, expectedCharacterRevision: snapshot.campaign.characters[f.one]!.revision, expectedCampaignId: f.campaignId, action: "delete" });
    expect(snapshot.campaign.gm.characterGroups![0]!.characterIds).toEqual([f.two]);
    const after = await f.execute({ kind: "remove-group", groupId, expectedRevision: snapshot.campaign.gm.characterGroups![0]!.revision });
    expect(after.campaign.characters[f.two]).toEqual(snapshot.campaign.characters[f.two]);
    expect(after.campaign.gm.characterGroups).toEqual([]);
  });

  it("rejects duplicate names and campaign switches", async () => {
    const f = await setup();
    await expect(f.execute({ kind: "create-group", groupId: "cgr_22222222222222222222222222222222", name: "equipo" })).rejects.toThrow("Ya existe");
    await expect(organizeCharacters(f.source, { expectedCampaignId: "other", action: { kind: "remove-group", groupId, expectedRevision: 1 } })).rejects.toThrow("La campaña cambió");
  });
});
