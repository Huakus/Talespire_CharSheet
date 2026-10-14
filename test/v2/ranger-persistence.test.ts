import { describe,it,expect } from "vitest";
import { rangerAt,rangerOp as op,rangerTime as at } from "../fixtures/ranger-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCampaignSnapshot,encodeCampaignEnvelope,decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import { editCharacterCore } from "../../src/domain/character/edit-character";
import { CharacterV2Schema } from "../../src/domain/character/character-v2";
import { performRangerAction } from "../../src/domain/character/ranger-play";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
const shape = { kind: "companion-damage" as const,amount: 5 };
describe("Persistencia de Explorador",() => {
  it("crea a nivel 20 y conserva compañero/recursos en reintentos, exportaciones y fragmentos",async () => {
    const source = await rangerAt(20,"beast-master"),repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),empty = await app.createCampaign(at),create = { operationId: op,creation: { ...source.builder!.creation,startingLevel: 20 },initialLevels: source.builder!.levels,expectedCampaignChecksum: empty.checksum };
    const initial = await app.createGuidedCharacter(create);expect(await app.createGuidedCharacter(create)).toEqual(initial);const c = Object.values(initial.campaign.characters)[0]!;
    const command = { characterId: c.id,operationId: "ranger_00000000000000000000000000000001",expectedCampaignChecksum: initial.checksum,expectedCharacterRevision: c.revision,action: shape };
    const updated = await app.rangerAction(command);expect(await app.rangerAction(command)).toEqual(updated);await expect(app.rangerAction({ ...command,action: { ...shape,amount: 6 } })).rejects.toThrow(/otros datos/);
    expect((await decodeCampaignEnvelope(encodeCampaignEnvelope(await createCampaignSnapshot(updated.campaign)))).campaign).toEqual(updated.campaign);
    const campaign = updated.campaign,character = campaign.characters[c.id]!;const assembled = assembleCampaign({ campaignRevision: campaign.revision,campaignUpdatedAt: campaign.metadata.updatedAt,updatedBy: null,characters: [{ characterId: c.id,revision: character.revision,createdAt: character.metadata.createdAt,updatedAt: character.metadata.updatedAt }],fragments: fragmentCampaign(campaign).map((f) => ({ ...f,revision: 1 })) });expect(assembled.characters[c.id]).toEqual(character);expect(character.spellcasting.ranger!.companionHp).toBe(75);
  });
  it("no mezcla acciones concurrentes con daño o descansos y permite editar el nombre",async () => {
    const repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),base = await app.createCampaign(at),c = await rangerAt(10,"beast-master");base.campaign.characters[c.id] = c;
    const local = structuredClone(base.campaign),remote = structuredClone(base.campaign);local.characters[c.id] = await performRangerAction(c,"ranger_00000000000000000000000000000001",shape,{ expectedRevision: c.revision,updatedAt: at });
    remote.characters[c.id] = applyCharacterResourceCommand(c,{ kind: "damage",amount: 5 },{ expectedRevision: c.revision,updatedAt: at }).character;expect(mergeCampaignChanges(base.campaign,local,remote).conflictPaths).toContain(`characters.${c.id}.spellcasting.ranger.actions`);
    remote.characters[c.id] = structuredClone(c);remote.characters[c.id]!.name = "Nuevo nombre";const merged = mergeCampaignChanges(base.campaign,local,remote);expect(merged.campaign!.characters[c.id]!.name).toBe("Nuevo nombre");expect(merged.campaign!.characters[c.id]!.spellcasting.ranger!.companionHp).toBe(7);
  });
  it("protege dados guiados y permite abrir fichas previas sin estado de Explorador",async () => {
    const c = await rangerAt(3);expect(editCharacterCore(c,{ combat: { hitDice: { dieSize: 10 } } },{ expectedRevision: c.revision,updatedAt: at }).combat.hitDice.dieSize).toBe(10);expect(() => editCharacterCore(c,{ combat: { hitDice: { dieSize: 8 } } },{ expectedRevision: c.revision,updatedAt: at })).toThrow(/tutorial/);
    const legacy = structuredClone(c) as unknown as { spellcasting: Record<string,unknown> };delete legacy.spellcasting.ranger;expect(CharacterV2Schema.parse(legacy).spellcasting.ranger).toBeNull();
  });
  it("no pierde espacios al sincronizar Conciencia Primitiva con un lanzamiento o descanso",async () => {
    const repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),base = await app.createCampaign(at),c = await rangerAt(5);base.campaign.characters[c.id] = c;
    const local = structuredClone(base.campaign),remote = structuredClone(base.campaign);local.characters[c.id] = await performRangerAction(c,"ranger_00000000000000000000000000000001",{ kind: "primeval-awareness",slot: 1 },{ expectedRevision: c.revision,updatedAt: at });const spell = c.spellcasting.spells.find((s) => s.casting?.source === "builder:ranger" && s.level === 1)!;remote.characters[c.id] = castCharacterSpell(c,spell.id,1,{ expectedRevision: c.revision,updatedAt: at });expect(mergeCampaignChanges(base.campaign,local,remote).conflictPaths).toContain(`characters.${c.id}.spellcasting.ranger.actions`);
    c.spellcasting.slots["1"]!.used = 1;base.campaign.characters[c.id] = c;local.characters[c.id] = await performRangerAction(c,"ranger_00000000000000000000000000000002",{ kind: "primeval-awareness",slot: 1 },{ expectedRevision: c.revision,updatedAt: at });remote.characters[c.id] = applyCharacterResourceCommand(c,{ kind: "long-rest" },{ expectedRevision: c.revision,updatedAt: at }).character;expect(mergeCampaignChanges(base.campaign,local,remote).campaign).toBeNull();
  });
});
