import { describe,it,expect } from "vitest";
import { rogueAt,rogueChoice } from "../fixtures/rogue-builder";
import { advanceGuidedRogue } from "../../src/domain/character/rogue-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { performRogueAction } from "../../src/domain/character/rogue-play";
import { castCharacterSpell } from "../../src/domain/character/character-spells";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { createCampaignSnapshot,encodeCampaignEnvelope,decodeCampaignEnvelope } from "../../src/infrastructure/persistence/campaign-snapshot";
import { fragmentCampaign,assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";
import { mergeCampaignChanges } from "../../src/infrastructure/remote/campaign-three-way-merge";
const op="build_00000000000000000000000000000001",at="2026-10-14T12:00:00Z";
describe("Rogue persistence and spell theft",() => {
  it("creates at level twenty atomically and keeps retries, exports and fragments intact",async () => {
    const source=await rogueAt(20,"arcane-trickster"),repo=new InMemoryCampaignRepository(),app=new CampaignApplication(repo),empty=await app.createCampaign(at);
    const create={operationId:op,creation:{...source.builder!.creation,startingLevel:20},initialLevels:source.builder!.levels,expectedCampaignChecksum:empty.checksum};
    const initial=await app.createGuidedCharacter(create);expect(await app.createGuidedCharacter(create)).toEqual(initial);const c=Object.values(initial.campaign.characters)[0]!;
    const command={characterId:c.id,operationId:"rogue_00000000000000000000000000000002",expectedCampaignChecksum:initial.checksum,expectedCharacterRevision:c.revision,action:{kind:"spell-thief" as const,key:"cure-wounds",targetedOrIncluded:true as const,targetFailedSave:true}};
    const updated=await app.rogueAction(command);expect(await app.rogueAction(command)).toEqual(updated);expect(updated.campaign.characters[c.id]!.spellcasting.rogue!.stolenSpell).toBe("cure-wounds");
    await expect(app.rogueAction({...command,action:{...command.action,targetFailedSave:false}})).rejects.toThrow(/otros datos/);
    const encoded=encodeCampaignEnvelope(await createCampaignSnapshot(updated.campaign));expect((await decodeCampaignEnvelope(encoded)).campaign).toEqual(updated.campaign);
    const campaign=updated.campaign,character=campaign.characters[c.id]!;const assembled=assembleCampaign({campaignRevision:campaign.revision,campaignUpdatedAt:campaign.metadata.updatedAt,updatedBy:null,characters:[{characterId:c.id,revision:character.revision,createdAt:character.metadata.createdAt,updatedAt:character.metadata.updatedAt}],fragments:fragmentCampaign(campaign).map((f) => ({...f,revision:1}))});expect(assembled.characters[c.id]).toEqual(character);
    const left=structuredClone(campaign),right=structuredClone(campaign);left.characters[c.id]!.spellcasting.rogue!.actions.push({operationId:"rogue_00000000000000000000000000000003",payload:"a"});right.characters[c.id]!.spellcasting.rogue!.actions.push({operationId:"rogue_00000000000000000000000000000004",payload:"b"});expect(mergeCampaignChanges(campaign,left,right).conflictPaths).toContain(`characters.${c.id}.spellcasting.rogue.actions`);
  });
  it("steals eligible non-wizard magic for eight game hours, preserving it on advancement",async () => {
    const source=await rogueAt(17,"arcane-trickster"),options={expectedRevision:source.revision,updatedAt:at};
    let c=await performRogueAction(source,"rogue_00000000000000000000000000000005",{kind:"spell-thief",key:"cure-wounds",targetedOrIncluded:true,targetFailedSave:true},options);
    const stolen=c.spellcasting.spells.find((s) => s.casting?.source==="builder:rogue-stolen")!;expect(stolen.casting!.ability).toBe("intelligence");c=castCharacterSpell(c,stolen.id,1,{expectedRevision:c.revision,updatedAt:at});expect(c.spellcasting.slots["1"]!.used).toBe(1);
    c=await advanceGuidedRogue(c,rogueChoice(c),at);expect(c.spellcasting.spells.some((s) => s.id===stolen.id)).toBe(true);
    c=applyCharacterResourceCommand(c,{kind:"short-rest"},{expectedRevision:c.revision,updatedAt:at}).character;expect(c.spellcasting.rogue!.stolenHoursRemaining).toBe(7);
    await expect(performRogueAction(c,"rogue_00000000000000000000000000000006",{kind:"spell-thief",key:"heal",targetedOrIncluded:true,targetFailedSave:true},{expectedRevision:c.revision,updatedAt:at})).rejects.toThrow(/No quedan/);
    c=await performRogueAction(c,"rogue_00000000000000000000000000000007",{kind:"pass-time",hours:7},{expectedRevision:c.revision,updatedAt:at});expect(c.spellcasting.rogue!.stolenSpell).toBeNull();expect(c.spellcasting.spells.some((s) => s.id===stolen.id)).toBe(false);
    c=applyCharacterResourceCommand(c,{kind:"long-rest"},{expectedRevision:c.revision,updatedAt:at}).character;expect(c.traits.flatMap((g) => g.traits).find((t) => t.id===c.spellcasting.rogue!.resourceIds["spell-thief"])!.uses.used).toBe(0);
  });
  it.each([{key:"fire-bolt",failed:true},{key:"heal",failed:true},{key:"cure-wounds",failed:false}])("spends theft even without learning $key (failed save: $failed)",async ({key,failed}) => {
    const source=await rogueAt(17,"arcane-trickster"),c=await performRogueAction(source,"rogue_00000000000000000000000000000008",{kind:"spell-thief",key,targetedOrIncluded:true,targetFailedSave:failed},{expectedRevision:source.revision,updatedAt:at});expect(c.spellcasting.rogue!.stolenSpell).toBeNull();expect(c.traits.flatMap((g) => g.traits).find((t) => t.id===c.spellcasting.rogue!.resourceIds["spell-thief"])!.uses.used).toBe(1);
  });
  it("restores duelist and luck on short rest without resetting other resources",async () => {
    let c=await rogueAt(20,"swashbuckler");for(const key of ["master-duelist","stroke-of-luck"]) c.traits.flatMap((g) => g.traits).find((t) => t.id===c.spellcasting.rogue!.resourceIds[key])!.uses.used=1;
    c=applyCharacterResourceCommand(c,{kind:"short-rest"},{expectedRevision:c.revision,updatedAt:at}).character;for(const key of ["master-duelist","stroke-of-luck"]) expect(c.traits.flatMap((g) => g.traits).find((t) => t.id===c.spellcasting.rogue!.resourceIds[key])!.uses.used).toBe(0);
  });
});
