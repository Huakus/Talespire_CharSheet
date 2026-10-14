import { describe,it,expect } from "vitest";
import { bardAt,bardOp as op,bardAtTime as at } from "../fixtures/bard-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCampaignSnapshot,encodeCampaignEnvelope,decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import { editCharacterCore } from "../../src/domain/character/edit-character";
import { CharacterV2Schema } from "../../src/domain/character/character-v2";
import { performBardAction } from "../../src/domain/character/bard-play";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
describe("Persistencia de Bardo",() => {
  it("crea a nivel 20, reintenta sin duplicar recursos y conserva exportaciones y fragmentos",async () => {
    const source = await bardAt(20),repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),empty = await app.createCampaign(at),create = { operationId: op,creation: { ...source.builder!.creation,startingLevel: 20 },initialLevels: source.builder!.levels,expectedCampaignChecksum: empty.checksum };
    const initial = await app.createGuidedCharacter(create);expect(await app.createGuidedCharacter(create)).toEqual(initial);
    const c = Object.values(initial.campaign.characters)[0]!,command = { characterId: c.id,operationId: "bard_00000000000000000000000000000001",expectedCampaignChecksum: initial.checksum,expectedCharacterRevision: c.revision,action: { kind: "inspiration" as const,use: "inspire" as const,requirementsConfirmed: true as const } };
    const updated = await app.bardAction(command);expect(await app.bardAction(command)).toEqual(updated);await expect(app.bardAction({ ...command,action: { ...command.action,use: "peerless" } })).rejects.toThrow(/otros datos/);
    expect((await decodeCampaignEnvelope(encodeCampaignEnvelope(await createCampaignSnapshot(updated.campaign)))).campaign).toEqual(updated.campaign);
    const campaign = updated.campaign,character = campaign.characters[c.id]!;
    const assembled = assembleCampaign({ campaignRevision: campaign.revision,campaignUpdatedAt: campaign.metadata.updatedAt,updatedBy: null,characters: [{ characterId: c.id,revision: character.revision,createdAt: character.metadata.createdAt,updatedAt: character.metadata.updatedAt }],fragments: fragmentCampaign(campaign).map((f) => ({ ...f,revision: 1 })) });expect(assembled.characters[c.id]).toEqual(character);
    expect(character.combat.hitPoints.current).toBe(character.combat.hitPoints.maximum);
  });
  it("detecta gasto concurrente con descanso y permite cambios independientes de nombre",async () => {
    const repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),base = await app.createCampaign(at),c = await bardAt(10);base.campaign.characters[c.id] = c;
    const local = structuredClone(base.campaign),remote = structuredClone(base.campaign);
    local.characters[c.id] = await performBardAction(c,"bard_00000000000000000000000000000001",{ kind: "inspiration",use: "inspire",requirementsConfirmed: true },{ expectedRevision: c.revision,updatedAt: at });
    // Start with a spent pool so the remote rest has an observable resource effect.
    const pool = c.traits.flatMap((g) => g.traits).find((t) => t.id === c.spellcasting.bard!.inspirationId)!;pool.uses.used = 1;base.campaign.characters[c.id] = c;
    local.characters[c.id] = await performBardAction(c,"bard_00000000000000000000000000000001",{ kind: "inspiration",use: "inspire",requirementsConfirmed: true },{ expectedRevision: c.revision,updatedAt: at });
    remote.characters[c.id] = applyCharacterResourceCommand(c,{ kind: "short-rest" },{ expectedRevision: c.revision,updatedAt: at }).character;expect(mergeCampaignChanges(base.campaign,local,remote).conflictPaths).toContain(`characters.${c.id}.spellcasting.bard.actions`);
    remote.characters[c.id] = structuredClone(c);remote.characters[c.id]!.name = "Nuevo nombre";const merged = mergeCampaignChanges(base.campaign,local,remote);expect(merged.campaign!.characters[c.id]!.name).toBe("Nuevo nombre");expect(merged.campaign!.characters[c.id]!.spellcasting.bard!.actions).toHaveLength(1);
  });
  it("conserva compatibilidad de fichas anteriores y protege el dado de golpe guiado",async () => {
    const c = await bardAt(3);expect(editCharacterCore(c,{ combat: { hitDice: { dieSize: 8 } } },{ expectedRevision: c.revision,updatedAt: at }).combat.hitDice.dieSize).toBe(8);
    expect(() => editCharacterCore(c,{ combat: { hitDice: { dieSize: 10 } } },{ expectedRevision: c.revision,updatedAt: at })).toThrow(/tutorial/);
    const legacy = structuredClone(c) as unknown as { spellcasting: Record<string,unknown> };delete legacy.spellcasting.bard;expect(CharacterV2Schema.parse(legacy).spellcasting.bard).toBeNull();
  });
});
