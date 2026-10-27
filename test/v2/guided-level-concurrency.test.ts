import { describe, expect, it, vi } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { CampaignRepositoryConflictError } from "../../src/application/ports/campaign-repository";
import { CharacterRevisionConflictError } from "../../src/domain/character/edit-character";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { rogueChoice, rogueCreation } from "../fixtures/rogue-builder";

const at = "2026-10-25T23:00:00.000Z";

async function fixture() {
  const repository = new InMemoryCampaignRepository(), app = new CampaignApplication(repository);
  let base = await app.createCampaign(at);
  const creation = rogueCreation("dragonborn", "charlatan");
  creation.name = "Skitixx Stix Ernesto 02"; creation.origin.ancestry = "copper";
  base = await app.createGuidedCharacter({ operationId: "build_11111111111111111111111111111111", creation, expectedCampaignChecksum: base.checksum, createdAt: at });
  const first = Object.values(base.campaign.characters)[0]!;
  base = await app.advanceGuidedCharacter({ characterId: first.id, choice: rogueChoice(first), expectedCharacterRevision: first.revision, expectedCampaignChecksum: base.checksum, updatedAt: at });
  const second = base.campaign.characters[first.id]!;
  base = await app.editCharacter({ characterId: second.id, expectedCharacterRevision: second.revision, expectedCampaignChecksum: base.checksum, patch: { combat: { hitPoints: { current: 9, temporary: 3 } } }, updatedAt: at });
  const character = base.campaign.characters[first.id]!;
  const command = { characterId: character.id, choice: rogueChoice(character, "arcane-trickster"), expectedCharacterRevision: character.revision, expectedCampaignChecksum: base.checksum, expectedCampaignId: base.campaign.id, updatedAt: at };
  return { repository, app, base, character, command };
}

describe("guided level-up while the campaign changes", () => {
  it("confirms Arcane Trickster 3 with a stale campaign checksum and preserves the other player and spent HP", async () => {
    const { app, base, character, command } = await fixture();
    const changed = await app.createCharacter({ name: "Otro jugador", expectedCampaignChecksum: base.checksum, createdAt: at });
    const other = Object.values(changed.campaign.characters).find(c => c.id !== character.id)!;
    const saved = await app.advanceGuidedCharacter(command), rogue = saved.campaign.characters[character.id]!;
    expect(saved.campaign.characters[other.id]).toEqual(other);
    expect(rogue.identity).toMatchObject({ level: 3, subclass: "Bribón Arcano" });
    expect(rogue.combat.hitPoints).toMatchObject({ current: 9, temporary: 3 });
    expect(rogue.combat.hitPoints.maximum).toBeGreaterThan(character.combat.hitPoints.maximum);
    expect(rogue.inventory).toEqual(character.inventory);
    expect(rogue.spellcasting.spells.some(s => s.casting?.key === "mage-hand")).toBe(true);
    expect(await app.advanceGuidedCharacter(command)).toEqual(saved);
  });

  it("retries a write racing with a campaign setting change without overwriting it", async () => {
    const { app, repository, command } = await fixture(), save = repository.save.bind(repository);
    const spy = vi.spyOn(repository, "save").mockImplementationOnce(async (campaign, expectation) => {
      const latest = (await repository.load())!, concurrent = structuredClone(latest.campaign);
      concurrent.gm.googleDocsUrl = "https://docs.google.com/document/d/concurrent";
      concurrent.revision++;
      await save(concurrent, { kind: "checksum", checksum: latest.checksum });
      return save(campaign, expectation);
    });
    const saved = await app.advanceGuidedCharacter(command);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(saved.campaign.gm.googleDocsUrl).toBe("https://docs.google.com/document/d/concurrent");
    expect(saved.campaign.characters[command.characterId]!.identity.level).toBe(3);
  });

  it("does not apply a level twice when the write succeeds before a conflict response", async () => {
    const { app, repository, character, command } = await fixture(), save = repository.save.bind(repository);
    const spy = vi.spyOn(repository, "save").mockImplementationOnce(async (campaign, expectation) => {
      const saved = await save(campaign, expectation);
      throw new CampaignRepositoryConflictError(command.expectedCampaignChecksum, saved.checksum);
    });
    const saved = await app.advanceGuidedCharacter(command), rogue = saved.campaign.characters[character.id]!;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(rogue.revision).toBe(character.revision + 1);
    expect(rogue.builder!.levels.filter(c => c.operationId === command.choice.operationId)).toHaveLength(1);
    await expect(app.advanceGuidedCharacter({ ...command, choice: { ...command.choice, hpMethod: "rolled", hpBase: 8 } })).rejects.toThrow("otras elecciones");
  });

  it("protects a character changed while its level-up wizard was open", async () => {
    const { app, repository, character, command } = await fixture();
    const changed = await app.editCharacter({ ...command, patch: { combat: { hitPoints: { current: 4 } } } });
    const spy = vi.spyOn(repository, "save");
    await expect(app.advanceGuidedCharacter(command)).rejects.toBeInstanceOf(CharacterRevisionConflictError);
    expect(spy).not.toHaveBeenCalled();
    expect(await repository.load()).toEqual(changed);
    expect(changed.campaign.characters[character.id]!.identity.level).toBe(2);
  });

  it("stops retrying if the same character changes during a competing write", async () => {
    const { app, repository, command } = await fixture(), save = repository.save.bind(repository);
    const spy = vi.spyOn(repository, "save").mockImplementationOnce(async (campaign, expectation) => {
      const latest = (await repository.load())!, concurrent = structuredClone(latest.campaign);
      concurrent.characters[command.characterId]!.combat.hitPoints.current = 4;
      concurrent.characters[command.characterId]!.revision++;
      concurrent.revision++;
      await save(concurrent, { kind: "checksum", checksum: latest.checksum });
      return save(campaign, expectation);
    });
    await expect(app.advanceGuidedCharacter(command)).rejects.toBeInstanceOf(CharacterRevisionConflictError);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await repository.load())!.campaign.characters[command.characterId]!.combat.hitPoints.current).toBe(4);
  });

  it("limits conflict retries and preserves the choices and stored character", async () => {
    const { app, repository, base, command } = await fixture(), original = structuredClone(command);
    const spy = vi.spyOn(repository, "save").mockRejectedValue(new CampaignRepositoryConflictError("old", "new"));
    await expect(app.advanceGuidedCharacter(command)).rejects.toThrow("Tus elecciones siguen guardadas");
    expect(spy).toHaveBeenCalledTimes(4);
    expect(command).toEqual(original);
    expect(await repository.load()).toEqual(base);
  });

  it("does not save to another campaign or retry a storage failure", async () => {
    const { app, repository, command } = await fixture();
    const spy = vi.spyOn(repository, "save").mockRejectedValue(new Error("Almacenamiento no disponible"));
    await expect(app.advanceGuidedCharacter({ ...command, expectedCampaignId: "cmp_22222222222222222222222222222222" })).rejects.toThrow("campaña correcta");
    expect(spy).not.toHaveBeenCalled();
    await expect(app.advanceGuidedCharacter(command)).rejects.toThrow("Almacenamiento no disponible");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
