import { describe,it,expect } from "vitest";
import { barbarianAt,barbarianChoice } from "../fixtures/barbarian-builder";
import { advanceGuidedBarbarian } from "../../src/domain/character/barbarian-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCampaignSnapshot,encodeCampaignEnvelope,decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
import { editCharacterCore } from "../../src/domain/character/edit-character";
import { CharacterV2Schema } from "../../src/domain/character/character-v2";
import { performBarbarianAction } from "../../src/domain/character/barbarian-play";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
const op="build_00000000000000000000000000000001",at="2026-10-14T16:00:00Z";
describe("Barbarian persistence and retries",() => {
  it("does not merge starting rage with simultaneous damage or rest, while allowing independent names",async () => {
    const repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo),base=await app.createCampaign(at),c=await barbarianAt(11);base.campaign.characters[c.id]=c;
    const local=structuredClone(base.campaign),remote=structuredClone(base.campaign);
    local.characters[c.id]=await performBarbarianAction(c,"barbarian_00000000000000000000000000000007",{kind:"rage"},{expectedRevision:c.revision,updatedAt:at});
    remote.characters[c.id]=applyCharacterResourceCommand(c,{kind:"damage",amount:c.combat.hitPoints.maximum},{expectedRevision:c.revision,updatedAt:at}).character;
    expect(mergeCampaignChanges(base.campaign,local,remote).conflictPaths).toContain(`characters.${c.id}.spellcasting.barbarian.actions`);
    remote.characters[c.id]=structuredClone(c);remote.characters[c.id]!.name="Nuevo nombre";const independent=mergeCampaignChanges(base.campaign,local,remote);expect(independent.campaign!.characters[c.id]!.name).toBe("Nuevo nombre");expect(independent.campaign!.characters[c.id]!.spellcasting.barbarian!.raging).toBe(true);
    const raging=structuredClone(local);const left=structuredClone(raging),right=structuredClone(raging),previous=raging.characters[c.id]!;
    left.characters[c.id]=await performBarbarianAction(previous,"barbarian_00000000000000000000000000000008",{kind:"reckless",firstAttackOfTurn:true},{expectedRevision:previous.revision,updatedAt:at});
    right.characters[c.id]=applyCharacterResourceCommand(previous,{kind:"short-rest"},{expectedRevision:previous.revision,updatedAt:at}).character;expect(mergeCampaignChanges(raging,left,right).conflictPaths).toContain(`characters.${c.id}.spellcasting.barbarian.actions`);
  });
  it("creates at level twenty atomically, retries rage idempotently, and round-trips exports and fragments",async () => {
    const source=await barbarianAt(20,"totem-warrior"),repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo),empty=await app.createCampaign(at),create={operationId:op,creation:{...source.builder!.creation,startingLevel:20},initialLevels:source.builder!.levels,expectedCampaignChecksum:empty.checksum};
    const initial=await app.createGuidedCharacter(create);expect(await app.createGuidedCharacter(create)).toEqual(initial);const c=Object.values(initial.campaign.characters)[0]!;expect(c.abilities.strength).toBe(20);expect(c.abilities.constitution).toBe(19);expect(c.combat.hitPoints.current).toBe(c.combat.hitPoints.maximum);
    const command={characterId:c.id,operationId:"barbarian_00000000000000000000000000000002",expectedCampaignChecksum:initial.checksum,expectedCharacterRevision:c.revision,action:{kind:"rage" as const,frenzy:false}};const updated=await app.barbarianAction(command);expect(await app.barbarianAction(command)).toEqual(updated);await expect(app.barbarianAction({...command,action:{...command.action,frenzy:true}})).rejects.toThrow(/otros datos/);
    const encoded=encodeCampaignEnvelope(await createCampaignSnapshot(updated.campaign));expect((await decodeCampaignEnvelope(encoded)).campaign).toEqual(updated.campaign);const campaign=updated.campaign,character=campaign.characters[c.id]!;expect(character.spellcasting.barbarian!.raging).toBe(true);
    const assembled=assembleCampaign({campaignRevision:campaign.revision,campaignUpdatedAt:campaign.metadata.updatedAt,updatedBy:null,characters:[{characterId:c.id,revision:character.revision,createdAt:character.metadata.createdAt,updatedAt:character.metadata.updatedAt}],fragments:fragmentCampaign(campaign).map((f) => ({...f,revision:1}))});expect(assembled.characters[c.id]).toEqual(character);
    const left=structuredClone(campaign),right=structuredClone(campaign);left.characters[c.id]!.spellcasting.barbarian!.actions.push({operationId:"barbarian_00000000000000000000000000000003",payload:"a"});right.characters[c.id]!.spellcasting.barbarian!.actions.push({operationId:"barbarian_00000000000000000000000000000004",payload:"b"});expect(mergeCampaignChanges(campaign,left,right).conflictPaths).toContain(`characters.${c.id}.spellcasting.barbarian.actions`);
  });
  it("keeps advancement retries idempotent, d12 managed, and spending and manual HP changes intact",async () => {
    const c=await barbarianAt(3);c.combat.hitPoints.current=4;const choice=barbarianChoice(c),next=await advanceGuidedBarbarian(c,choice,at);expect(next.combat.hitPoints.current).toBe(4);expect(await advanceGuidedBarbarian(next,choice,at)).toEqual(next);await expect(advanceGuidedBarbarian(next,{...choice,hpMethod:"rolled",hpBase:12},at)).rejects.toThrow(/otras elecciones/);
    expect(editCharacterCore(next,{combat:{hitDice:{dieSize:12}}},{expectedRevision:next.revision,updatedAt:at}).combat.hitDice.dieSize).toBe(12);expect(() => editCharacterCore(next,{combat:{hitDice:{dieSize:10}}},{expectedRevision:next.revision,updatedAt:at})).toThrow(/tutorial/);
    const legacy=structuredClone(next) as unknown as Record<string,unknown>,casting=legacy.spellcasting as Record<string,unknown>;delete casting.barbarian;expect(CharacterV2Schema.parse(legacy).spellcasting.barbarian).toBeNull();
  });
});
