import { describe,it,expect } from "vitest";
import { druidAt,druidOp as op,druidAtTime as at } from "../fixtures/druid-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCampaignSnapshot,encodeCampaignEnvelope,decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import { editCharacterCore } from "../../src/domain/character/edit-character";
import { CharacterV2Schema } from "../../src/domain/character/character-v2";
import { performDruidAction } from "../../src/domain/character/druid-play";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
const shape = { kind: "wild-shape" as const,name: "Lobo",formKind: "beast" as const,challenge: 0.25,swim: false,fly: false,maximumHp: 11,seenBefore: true as const };
describe("Persistencia de Druida",() => {
  it("crea a nivel 20 y conserva forma/recursos en reintentos, exportaciones y fragmentos",async () => {
    const source = await druidAt(20,"moon"),repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),empty = await app.createCampaign(at),create = { operationId: op,creation: { ...source.builder!.creation,startingLevel: 20 },initialLevels: source.builder!.levels,expectedCampaignChecksum: empty.checksum };
    const initial = await app.createGuidedCharacter(create);expect(await app.createGuidedCharacter(create)).toEqual(initial);const c = Object.values(initial.campaign.characters)[0]!;
    const command = { characterId: c.id,operationId: "druid_00000000000000000000000000000001",expectedCampaignChecksum: initial.checksum,expectedCharacterRevision: c.revision,action: shape };
    const updated = await app.druidAction(command);expect(await app.druidAction(command)).toEqual(updated);await expect(app.druidAction({ ...command,action: { ...shape,maximumHp: 12 } })).rejects.toThrow(/otros datos/);
    expect((await decodeCampaignEnvelope(encodeCampaignEnvelope(await createCampaignSnapshot(updated.campaign)))).campaign).toEqual(updated.campaign);
    const campaign = updated.campaign,character = campaign.characters[c.id]!;const assembled = assembleCampaign({ campaignRevision: campaign.revision,campaignUpdatedAt: campaign.metadata.updatedAt,updatedBy: null,characters: [{ characterId: c.id,revision: character.revision,createdAt: character.metadata.createdAt,updatedAt: character.metadata.updatedAt }],fragments: fragmentCampaign(campaign).map((f) => ({ ...f,revision: 1 })) });expect(assembled.characters[c.id]).toEqual(character);expect(character.spellcasting.druid!.form!.currentHp).toBe(11);
  });
  it("no mezcla transformaciones concurrentes con daño o descansos y permite editar el nombre",async () => {
    const repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),base = await app.createCampaign(at),c = await druidAt(10,"moon");base.campaign.characters[c.id] = c;
    const local = structuredClone(base.campaign),remote = structuredClone(base.campaign);local.characters[c.id] = await performDruidAction(c,"druid_00000000000000000000000000000001",shape,{ expectedRevision: c.revision,updatedAt: at });
    remote.characters[c.id] = applyCharacterResourceCommand(c,{ kind: "damage",amount: 5 },{ expectedRevision: c.revision,updatedAt: at }).character;expect(mergeCampaignChanges(base.campaign,local,remote).conflictPaths).toContain(`characters.${c.id}.spellcasting.druid.actions`);
    remote.characters[c.id] = structuredClone(c);remote.characters[c.id]!.name = "Nuevo nombre";const merged = mergeCampaignChanges(base.campaign,local,remote);expect(merged.campaign!.characters[c.id]!.name).toBe("Nuevo nombre");expect(merged.campaign!.characters[c.id]!.spellcasting.druid!.form!.currentHp).toBe(11);
  });
  it("protege dados guiados y permite abrir fichas previas sin estado de Druida",async () => {
    const c = await druidAt(3);expect(editCharacterCore(c,{ combat: { hitDice: { dieSize: 8 } } },{ expectedRevision: c.revision,updatedAt: at }).combat.hitDice.dieSize).toBe(8);expect(() => editCharacterCore(c,{ combat: { hitDice: { dieSize: 10 } } },{ expectedRevision: c.revision,updatedAt: at })).toThrow(/tutorial/);
    const legacy = structuredClone(c) as unknown as { spellcasting: Record<string,unknown> };delete legacy.spellcasting.druid;expect(CharacterV2Schema.parse(legacy).spellcasting.druid).toBeNull();
  });
});
