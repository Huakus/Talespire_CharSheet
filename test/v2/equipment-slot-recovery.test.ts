import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import pearl from "../../docs/v2/equipment-completion-2026-10-19/pearl-slot-recovery-definition.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { CharacterSpellV2Schema } from "../../src/domain/character/character-spell-model";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { projectEquipmentSpellSlots, recoverableBaseSpellSlots } from "../../src/domain/equipment/equipment-spell-slots";
import { useInventoryFeature, recoverInventoryItem } from "../../src/domain/character/character-inventory";
import { applyCharacterResourceCommand } from "../../src/domain/character/character-resources";
import { castCharacterSpell, setSpellSlots } from "../../src/domain/character/character-spells";
import { createTestCharacter, createTestCampaign, testTimestamp as now } from "../fixtures/native-campaign";
import { createGuidedWarlock, advanceGuidedWarlock } from "../../src/domain/character/warlock-builder";
import { phbWarlockCreation, completeWarlockChoice } from "../fixtures/phb-warlock-builder";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { BrowserApp } from "../../src/ui/browser-app";
import { createGuidedWizard, advanceGuidedWizard } from "../../src/domain/character/wizard-builder";
import { phbWizardCreation, completeWizardChoice } from "../fixtures/phb-wizard-builder";
import { applyWizardAction } from "../../src/domain/character/wizard-play";
import { renderWizardPanel } from "../../src/ui/wizard-play-panel";
import { fragmentCampaign, assembleCampaign } from "../../src/infrastructure/remote/campaign-fragments";

function fixture(level = 4) {
  const definition = EquipmentDefinitionDraftSchema.parse(pearl), character = createTestCharacter({name: "Lanzador"});
  character.identity.className = "Mago"; character.combat.hitPoints = {current: 10, maximum: 20, temporary: 0};
  character.spellcasting.slots[String(level)] = {maximum: 2, used: 1};
  character.spellcasting.spells = [CharacterSpellV2Schema.parse({id: "spl_11111111111111111111111111111111", order: 0, name: "Conjuro de prueba", level: 1, prepared: true, definition: null, casting: null, effect: {active: false, description: ""}})];
  const item = bindReviewedEquipment(CharacterInventoryItemV2Schema.parse({...normalizeEquipmentDefinition({name: definition.name}), id: "inv_11111111111111111111111111111111", order: 0, group: "Mochila", quantity: 1, equipped: true, attuned: true, charges: {current: 1, maximum: 1, reset: "dawn"}}), definition);
  character.inventory = [item];
  const options = {expectedRevision: character.revision, updatedAt: now, recoveredSpellSlotLevel: level};
  return {character, item, featureId: "official-use", options};
}
describe("Pearl of Power follows its 2014 slot conversion and daily resource", () => {
  it.each([1,2,3])("restores an expended level %s slot and spends the daily use atomically", level => {
    const {character, item, featureId, options} = fixture(level);
    const next = useInventoryFeature(character, item.id, featureId, options);
    expect(next.spellcasting.slots[String(level)]).toEqual({maximum: 2, used: 0});
    expect(next.inventory[0]!.charges!.current).toBe(0); expect(next.spellcasting.restoredSlots).toEqual([]);
    expect(character.spellcasting.slots[String(level)]!.used).toBe(1);
  });
  it("converts a higher slot to level 3, preserves total capacity and launches it without the pearl", () => {
    const {character, item, featureId, options} = fixture(5), next = useInventoryFeature(character, item.id, featureId, options);
    expect(projectEquipmentSpellSlots(next,5)).toEqual({maximum: 1, used: 0});
    expect(projectEquipmentSpellSlots(next,3)).toEqual({maximum: 1, used: 0});
    expect(recoverableBaseSpellSlots(next,5)).toBe(0);
    next.inventory = [];
    const cast = castCharacterSpell(next, next.spellcasting.spells[0]!.id, 3, {expectedRevision: next.revision, updatedAt: now});
    expect(projectEquipmentSpellSlots(cast,3)).toEqual({maximum: 1, used: 1});
    expect(() => castCharacterSpell(cast, cast.spellcasting.spells[0]!.id, 3, {expectedRevision: cast.revision, updatedAt: now})).toThrow();
    expect(() => setSpellSlots(next,5,{maximum: 2, used: 0},{expectedRevision: next.revision, updatedAt: now})).toThrow(/ya se recuperó/);
  });
  it("can restore the converted slot after casting it without duplicating its original slot", () => {
    const {character,item,featureId,options} = fixture(4);
    const restored = useInventoryFeature(character,item.id,featureId,options);
    const cast = castCharacterSpell(restored,restored.spellcasting.spells[0]!.id,3,{expectedRevision:restored.revision,updatedAt:now});
    const dawn = recoverInventoryItem(cast,item.id,"dawn",undefined,{expectedRevision:cast.revision,updatedAt:now});
    const recovered = useInventoryFeature(dawn,item.id,featureId,{expectedRevision:dawn.revision,updatedAt:now,recoveredSpellSlotLevel:3});
    expect(projectEquipmentSpellSlots(recovered,3)).toEqual({maximum:1,used:0});
    expect(recovered.spellcasting.restoredSlots).toHaveLength(1);
    expect(recoverableBaseSpellSlots(recovered,4)).toBe(0);
    expect(recovered.inventory[0]!.charges!.current).toBe(0);
  });
  it("rejects missing choices, duplicate recovery, empty charges, unattuned and incapacitated use", () => {
    const {character, item, featureId, options} = fixture(4);
    expect(() => useInventoryFeature(character,item.id,featureId,{expectedRevision: character.revision, updatedAt: now})).toThrow(/Elegí/);
    item.attuned = false; expect(() => useInventoryFeature(character,item.id,featureId,options)).toThrow(/sintonizado/); item.attuned = true;
    character.combat.hitPoints.current = 0; expect(() => useInventoryFeature(character,item.id,featureId,options)).toThrow(/actuar/); character.combat.hitPoints.current = 10;
    const spent = useInventoryFeature(character,item.id,featureId,options);
    expect(() => useInventoryFeature(spent,item.id,featureId,{...options,expectedRevision: spent.revision})).toThrow(/carga/);
    const dawn = recoverInventoryItem(spent,item.id,"dawn",undefined,{expectedRevision: spent.revision,updatedAt: now});
    expect(() => useInventoryFeature(dawn,item.id,featureId,{...options,expectedRevision: dawn.revision})).toThrow(/gastado/);
    expect(dawn.inventory[0]!.charges!.current).toBe(1);
  });
  it("restores the ordinary pool on long rest without refilling the pearl", () => {
    const {character,item,featureId,options} = fixture(4), spent = useInventoryFeature(character,item.id,featureId,options);
    const short = applyCharacterResourceCommand(spent,{kind: "short-rest"},{expectedRevision: spent.revision,updatedAt: now}).character;
    expect(short.spellcasting.restoredSlots).toHaveLength(1);
    const long = applyCharacterResourceCommand(short,{kind: "long-rest"},{expectedRevision: short.revision,updatedAt: now}).character;
    expect(long.spellcasting.restoredSlots).toEqual([]); expect(projectEquipmentSpellSlots(long,3).maximum).toBe(0);
    expect(projectEquipmentSpellSlots(long,4)).toEqual({maximum: 2,used: 0}); expect(long.inventory[0]!.charges!.current).toBe(0);
  });
  it("supports a guided warlock casting the converted slot and recovering its pact pool on short rest", async () => {
    const f = fixture(), c0 = await createGuidedWarlock(f.character.id,"build_11111111111111111111111111111111",phbWarlockCreation(),now);
    let c = c0; while(c.identity.level < 7) c = await advanceGuidedWarlock(c,completeWarlockChoice(c,"tome"),now);
    c.inventory.push(f.item); c.spellcasting.slots["4"]!.used = 1;
    const restored = useInventoryFeature(c,f.item.id,f.featureId,{expectedRevision: c.revision,updatedAt: now,recoveredSpellSlotLevel: 4});
    const spell = restored.spellcasting.spells.find(s => s.level === 1 && s.casting?.kind === "pact")!;
    const cast = castCharacterSpell(restored,spell.id,3,{expectedRevision: restored.revision,updatedAt: now});
    expect(projectEquipmentSpellSlots(cast,3).used).toBe(1);
    const nextLevel = await advanceGuidedWarlock(cast,completeWarlockChoice(cast,"tome"),now);
    expect(nextLevel.spellcasting.restoredSlots).toHaveLength(1);
    const short = applyCharacterResourceCommand(nextLevel,{kind: "short-rest"},{expectedRevision: nextLevel.revision,updatedAt: now}).character;
    expect(short.spellcasting.restoredSlots).toEqual([]); expect(short.spellcasting.slots["4"]!.used).toBe(0);
    expect(short.inventory.find(i => i.id === f.item.id)!.charges!.current).toBe(0);
  });
  it("lets Arcane Recovery recover a spent converted slot while excluding its reserved original", async () => {
    const f=fixture(),id='chr_11111111111111111111111111111111';
    let c=await createGuidedWizard(id,'build_11111111111111111111111111111111',phbWizardCreation(),now);
    while(c.identity.level<7)c=await advanceGuidedWizard(c,completeWizardChoice(c,'divination'),now);
    c.inventory.push(f.item);c.spellcasting.slots['4']!.used=1;
    const restored=useInventoryFeature(c,f.item.id,f.featureId,{expectedRevision:c.revision,updatedAt:now,recoveredSpellSlotLevel:4});
    const spell=restored.spellcasting.spells.find(s=>s.level===1&&s.casting?.kind==='wizard')!;spell.prepared=true;
    // Isolate the recovered reserve to exercise that source rather than a native slot.
    restored.spellcasting.slots['3']={maximum:0,used:0};
    const cast=castCharacterSpell(restored,spell.id,3,{expectedRevision:restored.revision,updatedAt:now});
    expect(cast.spellcasting.restoredSlots[0]!.used).toBe(true);
    const doc=new Window().document;doc.body.innerHTML=renderWizardPanel(cast);
    expect(doc.querySelector('[data-wizard-field="recover-4"]')?.getAttribute('max')).toBe('0');
    const recovered=await applyWizardAction(cast,{kind:'arcane-recovery',slots:[3],afterShortRest:true},{operationId:'wizard_11111111111111111111111111111111',expectedRevision:cast.revision,updatedAt:now});
    expect(projectEquipmentSpellSlots(recovered,3).maximum-projectEquipmentSpellSlots(recovered,3).used).toBe(1);
    expect(recovered.spellcasting.restoredSlots[0]!.used).toBe(false);
    expect(recoverableBaseSpellSlots(recovered,4)).toBe(0);
    expect(recovered.inventory.find(i=>i.id===f.item.id)!.charges!.current).toBe(0);
  });
  it("renders a choice with unavailable levels disabled and persists the selected recovery", async () => {
    const {character,item,featureId} = fixture(4), repository = new InMemoryCampaignRepository(), app = new CampaignApplication(repository);
    await repository.save(createTestCampaign({character}),{kind: "empty"}); const before = (await app.loadCampaign())!;
    const view = new BrowserApp({} as HTMLElement,app,{storageLabel:"test",diceRoller:{roll:async()=>({kind:"rolled",summary:"ok",totals:[1]})}}) as unknown as { snapshot: typeof before; selectedCharacterId: string; renderInventoryFeatureCapability(i: typeof item,f: typeof item.features[number]): string };
    view.snapshot = before; view.selectedCharacterId = character.id;
    const doc = new Window().document; doc.body.innerHTML = view.renderInventoryFeatureCapability(item,item.features[0]!);
    expect(doc.querySelector('[data-equipment-recover-slot] option[value="4"]')?.textContent).toContain("recupera nivel 3");
    expect(doc.querySelector('[data-equipment-recover-slot] option[value="1"]')?.hasAttribute("disabled")).toBe(true);
    const after = await app.useInventoryFeature({characterId:character.id,itemId:item.id,featureId,recoveredSpellSlotLevel:4,expectedCharacterRevision:character.revision,expectedCampaignChecksum:before.checksum,updatedAt:now});
    expect(after.campaign.characters[character.id]!.spellcasting.restoredSlots).toHaveLength(1);
    expect(await app.loadCampaign()).toEqual(after);
    const rebuilt = assembleCampaign({ campaignRevision: after.campaign.revision, campaignUpdatedAt: after.campaign.metadata.updatedAt, updatedBy: null, characters: Object.values(after.campaign.characters).map(c => ({characterId: c.id, revision: c.revision, createdAt: c.metadata.createdAt, updatedAt: c.metadata.updatedAt})), fragments: fragmentCampaign(after.campaign).map(f => ({...f, revision: 0})) });
    expect(rebuilt).toEqual(after.campaign);
  });
});
