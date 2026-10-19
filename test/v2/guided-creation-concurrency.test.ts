import { describe, expect, it, vi } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { CampaignRepositoryConflictError } from "../../src/application/ports/campaign-repository";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { rogueCreation } from "../fixtures/rogue-builder";

const at = "2026-10-18T21:00:00.000Z", operationId = "build_11111111111111111111111111111111";
async function fixture() {
  const repository = new InMemoryCampaignRepository(), app = new CampaignApplication(repository);
  const base = await app.createCampaign(at), creation = rogueCreation("dragonborn", "charlatan");
  creation.name = "Skitixx Stix Ernesto 02"; creation.origin.ancestry = "copper";
  const command = { operationId, creation, expectedCampaignChecksum: base.checksum, expectedCampaignId: base.campaign.id, createdAt: at };
  return { repository, app, base, command };
}

describe("guided creation while the campaign changes", () => {
  it("creates the dragonborn charlatan rogue after the tutorial's starting checksum becomes stale", async () => {
    const { app, base, command } = await fixture();
    const changed = await app.createCharacter({ name: "Otro personaje", expectedCampaignChecksum: base.checksum, createdAt: at });
    const other = Object.values(changed.campaign.characters)[0]!;
    const saved = await app.createGuidedCharacter(command);
    expect(Object.values(saved.campaign.characters)).toHaveLength(2);
    expect(saved.campaign.characters[other.id]).toEqual(other);
    const rogue = Object.values(saved.campaign.characters).find(c => c.builder?.creationOperationId === operationId)!;
    expect(rogue.name).toBe(command.creation.name); expect(rogue.builder!.classKey).toBe("rogue");
    expect(rogue.builder!.creation.origin.ancestry).toBe("copper");
    expect(rogue.builder!.creation.background.equipment).toBe("charlatan");
    expect(await app.createGuidedCharacter(command)).toEqual(saved);
  });

  it("retries an intervening write without overwriting another character's edits", async () => {
    const { app, repository, base, command } = await fixture();
    const changed = await app.createCharacter({ name: "Otro personaje", expectedCampaignChecksum: base.checksum, createdAt: at });
    const otherId = Object.keys(changed.campaign.characters)[0]!, save = repository.save.bind(repository);
    const spy = vi.spyOn(repository, "save").mockImplementationOnce(async (campaign, expectation) => {
      const latest = (await repository.load())!, concurrent = structuredClone(latest.campaign);
      concurrent.characters[otherId]!.name = "Nombre cambiado durante la creación";
      concurrent.characters[otherId]!.combat.hitPoints.current = 0;
      concurrent.revision++;
      await save(concurrent, { kind: "checksum", checksum: latest.checksum });
      return save(campaign, expectation);
    });
    const saved = await app.createGuidedCharacter(command);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(Object.keys(saved.campaign.characters)).toHaveLength(2);
    expect(saved.campaign.characters[otherId]!.name).toBe("Nombre cambiado durante la creación");
    expect(saved.campaign.characters[otherId]!.combat.hitPoints.current).toBe(0);
  });

  it("does not duplicate a creation whose write succeeded before a conflict response", async () => {
    const { app, repository, command } = await fixture(), save = repository.save.bind(repository);
    const spy = vi.spyOn(repository, "save").mockImplementationOnce(async (campaign, expectation) => {
      const saved = await save(campaign, expectation);
      throw new CampaignRepositoryConflictError(command.expectedCampaignChecksum, saved.checksum);
    });
    const saved = await app.createGuidedCharacter(command);
    expect(spy).toHaveBeenCalledTimes(1); expect(Object.keys(saved.campaign.characters)).toHaveLength(1);
    await expect(app.createGuidedCharacter({ ...command, creation: { ...command.creation, name: "Otra elección" } })).rejects.toThrow("otras elecciones");
  });

  it("limits conflict retries and leaves the draft choices intact", async () => {
    const { app, repository, command } = await fixture(), original = structuredClone(command);
    const spy = vi.spyOn(repository, "save").mockRejectedValue(new CampaignRepositoryConflictError("old", "new"));
    await expect(app.createGuidedCharacter(command)).rejects.toThrow("Tus elecciones siguen guardadas");
    expect(spy).toHaveBeenCalledTimes(4); expect(command).toEqual(original);
    expect(Object.keys((await repository.load())!.campaign.characters)).toHaveLength(0);
  });

  it("does not retry a storage failure or create in a different campaign", async () => {
    const { app, repository, command } = await fixture();
    const spy = vi.spyOn(repository, "save").mockRejectedValue(new Error("Almacenamiento no disponible"));
    await expect(app.createGuidedCharacter({ ...command, expectedCampaignId: "cmp_22222222222222222222222222222222" })).rejects.toThrow("campaña correcta");
    expect(spy).not.toHaveBeenCalled();
    await expect(app.createGuidedCharacter(command)).rejects.toThrow("Almacenamiento no disponible");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
