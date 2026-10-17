import { describe,it,expect } from "vitest";
import { sorcererAt,sorcererOp as op,sorcererTime as at } from "../fixtures/sorcerer-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCampaignSnapshot,encodeCampaignEnvelope,decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import { CharacterV2Schema } from "../../src/domain/character/character-v2";
import { performSorcererAction,sorceryPoints } from "../../src/domain/character/sorcerer-play";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
const action = { kind: "create-slot" as const,level: 5 };
describe("Persistencia de Hechicero",() => {
  it("crea a nivel 20 y conserva puntos/espacios temporales en reintentos, exportación y fragmentos",async () => {
    const source = await sorcererAt(20,"divine-soul"),repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),empty = await app.createCampaign(at),create = { operationId: op,creation: { ...source.builder!.creation,startingLevel: 20 },initialLevels: source.builder!.levels,expectedCampaignChecksum: empty.checksum },initial = await app.createGuidedCharacter(create);expect(await app.createGuidedCharacter(create)).toEqual(initial);const c = Object.values(initial.campaign.characters)[0]!,command = { characterId: c.id,operationId: "sorcerer_00000000000000000000000000000001",expectedCampaignChecksum: initial.checksum,expectedCharacterRevision: c.revision,action };
    const updated = await app.sorcererAction(command);expect(await app.sorcererAction(command)).toEqual(updated);await expect(app.sorcererAction({ ...command,action: { ...action,level: 4 } })).rejects.toThrow(/otros datos/);expect(sorceryPoints(updated.campaign.characters[c.id]!)).toBe(13);expect((await decodeCampaignEnvelope(encodeCampaignEnvelope(await createCampaignSnapshot(updated.campaign)))).campaign).toEqual(updated.campaign);
    const campaign = updated.campaign,character = campaign.characters[c.id]!,assembled = assembleCampaign({ campaignRevision: campaign.revision,campaignUpdatedAt: campaign.metadata.updatedAt,updatedBy: null,characters: [{ characterId: c.id,revision: character.revision,createdAt: character.metadata.createdAt,updatedAt: character.metadata.updatedAt }],fragments: fragmentCampaign(campaign).map((f) => ({ ...f,revision: 1 })) });expect(assembled.characters[c.id]).toEqual(character);
  });
  it("no mezcla gasto concurrente de metamagia, conversión, descanso y conjuros; admite cambios de nombre",async () => {
    const repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo),base = await app.createCampaign(at),c = await sorcererAt(5,"draconic",["subtle","empowered"]);base.campaign.characters[c.id] = c;const local = structuredClone(base.campaign),remote = structuredClone(base.campaign),s = c.spellcasting.spells.find((s) => s.casting?.key === "magic-missile")!;
    local.characters[c.id] = castCharacterSpell(c,s.id,1,{ expectedRevision: c.revision,updatedAt: at,metamagic: ["subtle"],metamagicConfirmed: true });remote.characters[c.id] = await performSorcererAction(c,"sorcerer_00000000000000000000000000000001",{ kind: "create-slot",level: 3 },{ expectedRevision: c.revision,updatedAt: at });expect(mergeCampaignChanges(base.campaign,local,remote).conflictPaths).toContain(`characters.${c.id}.spellcasting.sorcerer.actions`);
    remote.characters[c.id] = castCharacterSpell(c,s.id,1,{ expectedRevision: c.revision,updatedAt: at,metamagic: ["subtle"],metamagicConfirmed: true });expect(mergeCampaignChanges(base.campaign,local,remote).campaign).toBeNull();remote.characters[c.id] = structuredClone(c);remote.characters[c.id]!.name = "Nuevo";expect(mergeCampaignChanges(base.campaign,local,remote).campaign!.characters[c.id]!.name).toBe("Nuevo");
    remote.characters[c.id] = applyCharacterResourceCommand(c,{ kind: "long-rest" },{ expectedRevision: c.revision,updatedAt: at }).character;expect(mergeCampaignChanges(base.campaign,local,remote).campaign).toBeNull();
  });
  it("abre fichas anteriores sin estado y el lanzamiento de aplicación gasta metamagia una sola vez",async () => {
    const c = await sorcererAt(5,"shadow",["subtle","empowered"]),repo = new InMemoryCampaignRepository(),app = new CampaignApplication(repo);let base = await app.createCampaign(at);base.campaign.characters[c.id] = c;base = await repo.save(base.campaign,{ kind: "checksum",checksum: base.checksum });const s = c.spellcasting.spells.find((s) => s.casting?.key === "magic-missile")!,command = { characterId: c.id,spellId: s.id,slotLevel: 1,expectedCampaignChecksum: base.checksum,expectedCharacterRevision: c.revision,metamagic: ["subtle" as const],metamagicConfirmed: true };
    const cast = await app.castCharacterSpell(command);expect(sorceryPoints(cast.campaign.characters[c.id]!)).toBe(4);await expect(app.castCharacterSpell(command)).rejects.toThrow();const legacy = structuredClone(c) as unknown as { spellcasting: Record<string,unknown> };delete legacy.spellcasting.sorcerer;expect(CharacterV2Schema.parse(legacy).spellcasting.sorcerer).toBeNull();
  });
});
