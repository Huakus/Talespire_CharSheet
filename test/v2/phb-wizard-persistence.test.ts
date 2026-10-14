import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createGuidedWizard, advanceGuidedWizard } from "../../src/domain/character/wizard-builder";
import { applyWizardAction } from "../../src/domain/character/wizard-play";
import { phbWizardCreation, completeWizardChoice } from "../fixtures/phb-wizard-builder";
import { createCampaignSnapshot, encodeCampaignEnvelope, decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign, assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import { createTestCampaign } from "../fixtures/native-campaign";
const id = "chr_11111111111111111111111111111111", operation = "build_11111111111111111111111111111111", time = "2026-10-14T00:00:00.000Z";
async function build(level: number) { let c = await createGuidedWizard(id,operation,phbWizardCreation(),time); while (c.identity.level < level) c = await advanceGuidedWizard(c,completeWizardChoice(c),time); return c; }
describe("wizard confirmation and persistence", () => {
  it("creates at level five atomically and retries initial decisions after subsequent progression", async () => {
    const source = await build(5), creation = { ...source.builder!.creation,startingLevel: 5 };
    const application = new CampaignApplication(new InMemoryCampaignRepository()), empty = await application.createCampaign(time);
    const command = { operationId: operation,creation,initialLevels: source.builder!.levels,expectedCampaignChecksum: empty.checksum };
    const created = await application.createGuidedCharacter(command), character = Object.values(created.campaign.characters)[0]!;
    expect(character.identity).toMatchObject({ className: "Mago",level: 5 });
    expect(character.combat.hitPoints.current).toBe(character.combat.hitPoints.maximum);
    const advanced = await application.advanceGuidedCharacter({ characterId: character.id,choice: completeWizardChoice(character),expectedCharacterRevision: character.revision,expectedCampaignChecksum: created.checksum });
    expect(await application.createGuidedCharacter(command)).toEqual(advanced);
    const invalid = structuredClone(command); invalid.initialLevels[0]!.subclass = "conjuration";
    await expect(application.createGuidedCharacter(invalid)).rejects.toThrow("niveles iniciales");
  });
  it("preserves copied spells, backups and expenditure through exports and existing fragments", async () => {
    let character = await build(3); character.currency.gold = 500;
    character = await applyWizardAction(character,{ kind: "copy",key: "protection-from-evil-and-good",source: "external" },{ operationId: "wizard_22222222222222222222222222222222",expectedRevision: character.revision,updatedAt: time });
    character = await applyWizardAction(character,{ kind: "backup-book",keys: ["shield"],buyBlankBook: true },{ operationId: "wizard_33333333333333333333333333333333",expectedRevision: character.revision,updatedAt: time });
    character.spellcasting.slots["1"]!.used = 1;
    const campaign = createTestCampaign(); campaign.characters = { [id]: character };
    const snapshot = await createCampaignSnapshot(campaign), decoded = await decodeCampaignEnvelope(encodeCampaignEnvelope(snapshot));
    expect(decoded.campaign.characters[id]).toEqual(character);
    const roundtrip = assembleCampaign({ campaignRevision: campaign.revision,campaignUpdatedAt: campaign.metadata.updatedAt,updatedBy: null,characters: [{ characterId: id,revision: character.revision,createdAt: character.metadata.createdAt,updatedAt: character.metadata.updatedAt }],fragments: fragmentCampaign(campaign).map((f) => ({ ...f,revision: 1 })) });
    expect(roundtrip.characters[id]).toEqual(character);
    expect(fragmentCampaign(campaign).find((f) => f.kind === "character-runtime")!.payload.spellcasting).toHaveProperty("wizard");
  });
  it("rejects competing daily preparations while allowing an independent HP change", async () => {
    const character = await build(1), base = createTestCampaign(); base.characters = { [id]: character };
    const local = structuredClone(base), remote = structuredClone(base);
    local.characters[id] = await applyWizardAction(character,{ kind: "prepare",keys: ["shield"],afterLongRest: true },{ operationId: "wizard_44444444444444444444444444444444",expectedRevision: character.revision,updatedAt: time });
    remote.characters[id] = await applyWizardAction(character,{ kind: "prepare",keys: ["sleep","find-familiar"],afterLongRest: true },{ operationId: "wizard_55555555555555555555555555555555",expectedRevision: character.revision,updatedAt: time });
    expect(mergeCampaignChanges(base,local,remote)).toEqual({ campaign: null,conflictPaths: [`characters.${id}.spellcasting.wizard.preparation`] });
    remote.characters[id] = structuredClone(character); remote.characters[id]!.combat.hitPoints.current = 1;
    const merged = mergeCampaignChanges(base,local,remote);
    expect(merged.conflictPaths).toEqual([]); expect(merged.campaign!.characters[id]!.combat.hitPoints.current).toBe(1);
    expect(merged.campaign!.characters[id]!.spellcasting.spells.filter((s) => s.level > 0 && s.prepared && s.casting?.kind === "wizard")).toHaveLength(1);
  });
  it("retries copying without spending twice and rejects a changed operation payload", async () => {
    const repository = new InMemoryCampaignRepository(), application = new CampaignApplication(repository);
    let snapshot = await application.createCampaign(time), character = await build(1); character.currency.gold = 200;
    snapshot.campaign.characters[id] = character;
    snapshot = await repository.save(snapshot.campaign,{ kind: "checksum",checksum: snapshot.checksum });
    const command = { characterId: id,expectedCharacterRevision: character.revision,expectedCampaignChecksum: snapshot.checksum,operationId: "wizard_66666666666666666666666666666666",action: { kind: "copy" as const,key: "alarm",source: "external" as const } };
    const saved = await application.wizardAction(command);
    expect(saved.campaign.characters[id]!.currency.gold).toBe(150);
    expect(await application.wizardAction(command)).toEqual(saved);
    await expect(application.wizardAction({ ...command,action: { ...command.action,key: "identify" } })).rejects.toThrow("otras elecciones");
  });
});
