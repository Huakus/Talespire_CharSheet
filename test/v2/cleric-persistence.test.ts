import { describe,it,expect } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createGuidedCleric,advanceGuidedCleric } from "../../src/domain/character/cleric-builder";
import { clericCreation,clericChoice } from "../fixtures/cleric-builder";
import { createCampaignSnapshot,encodeCampaignEnvelope,decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
const id="chr_00000000000000000000000000000001",op="build_00000000000000000000000000000001",at="2026-10-14T00:00:00Z";
describe("cleric application, persistence and conflicts",() => {
  it("creates at level 20 atomically and keeps action retries idempotent through exports and fragments",async () => {
    let source=await createGuidedCleric(id,op,clericCreation("grave"),at);while(source.identity.level<20) source=await advanceGuidedCleric(source,clericChoice(source),at);
    const repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo),empty=await app.createCampaign(at);
    const create={ operationId:op,creation:{ ...source.builder!.creation,startingLevel:20 },initialLevels:source.builder!.levels,expectedCampaignChecksum:empty.checksum };
    const initial=await app.createGuidedCharacter(create);expect(await app.createGuidedCharacter(create)).toEqual(initial);
    const c=Object.values(initial.campaign.characters)[0]!;
    const command={ characterId:c.id,operationId:"cleric_00000000000000000000000000000002",expectedCampaignChecksum:initial.checksum,expectedCharacterRevision:c.revision,action:{ kind:"intervention" as const,roll:null } };
    const updated=await app.clericAction(command);expect(await app.clericAction(command)).toEqual(updated);expect(updated.campaign.characters[c.id]!.spellcasting.cleric!.interventionCooldownDays).toBe(7);
    await expect(app.clericAction({ ...command,action:{ ...command.action,roll:1 } })).rejects.toThrow(/otras elecciones/);
    const encoded=encodeCampaignEnvelope(await createCampaignSnapshot(updated.campaign));expect((await decodeCampaignEnvelope(encoded)).campaign).toEqual(updated.campaign);
    const campaign=updated.campaign,character=campaign.characters[c.id]!;
    const assembled=assembleCampaign({ campaignRevision:campaign.revision,campaignUpdatedAt:campaign.metadata.updatedAt,updatedBy:null,characters:[{ characterId:c.id,revision:character.revision,createdAt:character.metadata.createdAt,updatedAt:character.metadata.updatedAt }],fragments:fragmentCampaign(campaign).map((f) => ({ ...f,revision:1 })) });expect(assembled.characters[c.id]).toEqual(character);
  });
  it("does not combine conflicting daily preparation lists",async () => {
    const repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo);let snapshot=await app.createCampaign(at);const c=await createGuidedCleric(id,op,clericCreation("knowledge"),at);snapshot.campaign.characters[id]=c;
    const left=structuredClone(snapshot.campaign),right=structuredClone(snapshot.campaign);
    for(const spell of left.characters[id]!.spellcasting.spells) if(spell.casting?.kind==="cleric" && spell.level>0) spell.prepared=spell.casting.key==="detect-magic";
    for(const spell of right.characters[id]!.spellcasting.spells) if(spell.casting?.kind==="cleric" && spell.level>0) spell.prepared=spell.casting.key==="cure-wounds";
    expect(mergeCampaignChanges(snapshot.campaign,left,right).conflictPaths).toContain(`characters.${id}.spellcasting.cleric.preparation`);
    const a=structuredClone(snapshot.campaign),b=structuredClone(snapshot.campaign);
    a.characters[id]!.spellcasting.cleric!.actions.push({ operationId:"cleric_00000000000000000000000000000003",payload:"first" });
    b.characters[id]!.spellcasting.cleric!.actions.push({ operationId:"cleric_00000000000000000000000000000004",payload:"second" });
    expect(mergeCampaignChanges(snapshot.campaign,a,b).conflictPaths).toContain(`characters.${id}.spellcasting.cleric.actions`);
  });
});
