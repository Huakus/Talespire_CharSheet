import { describe,it,expect } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createGuidedWarlock,advanceGuidedWarlock } from "../../src/domain/character/warlock-builder";
import { phbWarlockCreation,completeWarlockChoice } from "../fixtures/phb-warlock-builder";
import { createCampaignSnapshot,encodeCampaignEnvelope,decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { createTestCampaign } from "../fixtures/native-campaign";
const id = "chr_11111111111111111111111111111111",operation = "build_11111111111111111111111111111111",time = "2026-10-14T00:00:00.000Z";
async function build(level: number) { let c = await createGuidedWarlock(id,operation,phbWarlockCreation(),time); while (c.identity.level < level) c = await advanceGuidedWarlock(c,completeWarlockChoice(c),time); return c; }
describe("warlock application and persistence", () => {
  it("creates at level 20 atomically, preserves the initial history and supports idempotent retries", async () => {
    const source = await build(20),application = new CampaignApplication(new InMemoryCampaignRepository()),empty = await application.createCampaign(time);
    const command = { operationId: operation,creation: { ...source.builder!.creation,startingLevel: 20 },initialLevels: source.builder!.levels,expectedCampaignChecksum: empty.checksum };
    const created = await application.createGuidedCharacter(command),c = Object.values(created.campaign.characters)[0]!;
    expect(c.identity.level).toBe(20); expect(c.combat.hitPoints.current).toBe(c.combat.hitPoints.maximum); expect(c.spellcasting.warlock).not.toBeNull(); expect(await application.createGuidedCharacter(command)).toEqual(created);
    const bad = structuredClone(command); bad.initialLevels[0]!.warlock.invocations[0] = "beast-speech"; await expect(application.createGuidedCharacter(bad)).rejects.toThrow();
  });
  it("persists copied rituals and expenses once across retries, exports and the existing resource fragment", async () => {
    const repository = new InMemoryCampaignRepository(),application = new CampaignApplication(repository); let snapshot = await application.createCampaign(time),character = await build(3); character.currency.gold = 200;
    snapshot.campaign.characters[id] = character; snapshot = await repository.save(snapshot.campaign,{ kind: "checksum",checksum: snapshot.checksum });
    const command = { characterId: id,expectedCharacterRevision: character.revision,expectedCampaignChecksum: snapshot.checksum,operationId: "warlock_22222222222222222222222222222222",action: { kind: "copy-ritual" as const,key: "augury",sourceAvailable: true as const } };
    const updated = await application.warlockAction(command); expect(updated.campaign.characters[id]!.currency.gold).toBe(100); expect(await application.warlockAction(command)).toEqual(updated);
    character = updated.campaign.characters[id]!;
    const campaign = createTestCampaign(); campaign.characters[id] = character;
    const encoded = encodeCampaignEnvelope(await createCampaignSnapshot(campaign)); expect((await decodeCampaignEnvelope(encoded)).campaign.characters[id]).toEqual(character);
    expect(assembleCampaign({ campaignRevision: campaign.revision,campaignUpdatedAt: campaign.metadata.updatedAt,updatedBy: null,characters: [{ characterId: id,revision: character.revision,createdAt: character.metadata.createdAt,updatedAt: character.metadata.updatedAt }],fragments: fragmentCampaign(campaign).map((f) => ({ ...f,revision: 1 })) }).characters[id]).toEqual(character);
    await expect(application.warlockAction({ ...command,action: { ...command.action,key: "gentle-repose" } })).rejects.toThrow();
  });
});
