import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import definitions from "../../docs/v2/equipment-completion-2026-10-19/healing-potion-definitions.json";
import { EquipmentDefinitionDraftSchema } from "../../src/domain/equipment/equipment-definition";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { administerInventoryHealingFeature } from "../../src/domain/character/character-inventory";
import { createTestCampaign, createTestCharacter, testTimestamp } from "../fixtures/native-campaign";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { BrowserApp } from "../../src/ui/browser-app";

function fixture() {
  const definition = EquipmentDefinitionDraftSchema.parse(definitions.find(d => d.name === "Poción de curación"));
  const source = createTestCharacter({id: "source", name: "Portador"}), target = createTestCharacter({id: "target", name: "Receptor"});
  const item = bindReviewedEquipment(CharacterInventoryItemV2Schema.parse({...normalizeEquipmentDefinition({name: definition.name}), id: "inv_11111111111111111111111111111111", order: 0, group: "Mochila", quantity: 1}), definition);
  source.inventory = [item]; source.combat.hitPoints = {current: 10, maximum: 20, temporary: 1};
  target.combat.hitPoints = {current: 0, maximum: 20, temporary: 3}; target.combat.deathSaves = {successes: 1, failures: 2};
  target.combat.conditions = [{id: "cnd_11111111111111111111111111111111", key: "unconscious", label: "Inconsciente", level: null, addedAt: testTimestamp}];
  const options = {expectedRevision: source.revision, expectedTargetRevision: target.revision, updatedAt: testTimestamp};
  return {source, target, item, featureId: item.features[0]!.id, options};
}
describe("administering a potion to another sheet", () => {
  it("consumes a dose, heals and wakes a dying recipient while preserving temporary HP", () => {
    const {source, target, item, featureId, options} = fixture(), before = structuredClone({source, target});
    const result = administerInventoryHealingFeature(source, target, item.id, featureId, 7, options);
    expect(result.source.inventory).toEqual([]); expect(result.source.combat).toEqual(source.combat);
    expect(result.target.combat.hitPoints).toEqual({current: 7, maximum: 20, temporary: 3});
    expect(result.target.combat.deathSaves).toEqual({successes: 0, failures: 0}); expect(result.target.combat.conditions).toEqual([]);
    expect(result.source.revision).toBe(source.revision + 1); expect(result.target.revision).toBe(target.revision + 1);
    expect({source, target}).toEqual(before);
  });
  it("rejects invalid totals, dead recipients, stale sheets and actors unable to act without spending", () => {
    const f = fixture(), run = () => administerInventoryHealingFeature(f.source, f.target, f.item.id, f.featureId, 7, f.options);
    expect(() => administerInventoryHealingFeature(f.source, f.target, f.item.id, f.featureId, 99, f.options)).toThrow(/2d4/);
    f.target.combat.deathSaves.failures = 3; expect(run).toThrow(/muerta/); f.target.combat.deathSaves.failures = 2;
    f.target.revision++; expect(run).toThrow(/revision/i); f.target.revision--;
    f.source.combat.hitPoints.current = 0; expect(run).toThrow(/otra criatura/);
    expect(f.source.inventory[0]!.quantity).toBe(1); expect(f.target.combat.hitPoints.current).toBe(0);
  });
  it("commits both sheets once and never spends on a failed or repeated save", async () => {
    const {source, target, item, featureId} = fixture(), repository = new InMemoryCampaignRepository();
    const campaign = createTestCampaign({character: source}); campaign.characters[target.id] = target;
    await repository.save(campaign, {kind: "empty"});
    const app = new CampaignApplication(repository), before = (await app.loadCampaign())!;
    const command = {characterId: source.id, targetCharacterId: target.id, itemId: item.id, featureId, healing: 7, expectedCharacterRevision: source.revision, expectedTargetRevision: target.revision, expectedCampaignChecksum: before.checksum, updatedAt: testTimestamp};
    await expect(app.administerInventoryHealingFeature({...command, expectedTargetRevision: 99})).rejects.toThrow();
    expect(await app.loadCampaign()).toEqual(before);
    const after = await app.administerInventoryHealingFeature(command);
    expect(after.campaign.characters[source.id]!.inventory).toEqual([]);
    expect(after.campaign.characters[target.id]!.combat.hitPoints.current).toBe(7);
    expect(after.campaign.revision).toBe(before.campaign.revision + 1);
    await expect(app.administerInventoryHealingFeature(command)).rejects.toThrow();
    expect(await app.loadCampaign()).toEqual(after);
  });
  it("offers eligible recipients and disables administration for an unconscious actor", () => {
    const {source, target, item} = fixture();
    const view = new BrowserApp({} as HTMLElement, new CampaignApplication(new InMemoryCampaignRepository()), {storageLabel: "test", diceRoller: {roll: async () => ({kind: "rolled", summary: "ok", totals: [7]})}}) as unknown as { snapshot: {campaign: {characters: Record<string, typeof source>}}; selectedCharacterId: string; renderInventoryFeatureCapability(i: typeof item, f: typeof item.features[number]): string };
    view.snapshot = {campaign: {characters: {[source.id]: source, [target.id]: target}}}; view.selectedCharacterId = source.id;
    const doc = new Window().document; doc.body.innerHTML = view.renderInventoryFeatureCapability(item, item.features[0]!);
    expect(doc.querySelector(`[data-equipment-healing-recipient] option[value="${target.id}"]`)?.textContent).toBe("Receptor");
    expect(doc.querySelector("[data-equipment-administer-healing]")?.hasAttribute("disabled")).toBe(false);
    source.combat.hitPoints.current = 0; doc.body.innerHTML = view.renderInventoryFeatureCapability(item, item.features[0]!);
    expect(doc.querySelector("[data-equipment-administer-healing]")?.hasAttribute("disabled")).toBe(true);
  });
});
