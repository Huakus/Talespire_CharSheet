import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import type { CampaignSnapshot } from "../../src/application/ports/campaign-repository";
import { InventoryFeatureSchema, type InventoryBonus } from "../../src/domain/character/character-inventory-model";
import { projectActionAttackModifier, projectActionDamageBonus, projectCharacterStatistics, projectInventory } from "../../src/domain/character/character-projection";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

function bonus(key: string, value = 2, category = "attributes"): InventoryBonus {
  return { category, key, value, valueSource: null, advantage: false, disadvantage: false };
}

async function session() {
  const character = createTestCharacter({ configure(c) {
    c.inventory = [
      { ...normalizeEquipmentDefinition({ name: "Ring", requiresAttunement: true }),
        id: "item-ring", order: 0, group: "equipment", equipped: true,
        bonuses: [bonus("dexterity")],
        features: [InventoryFeatureSchema.parse({ id: "agility", order: 0,
          name: "Agility", description: "", kind: "activation", toggleable: true,
          bonuses: [bonus("dexterity")] })] },
      { ...normalizeEquipmentDefinition({ name: "Sword", equipment_category: { index: "weapon" },
        damage: { damage_dice: "1d6" }, damageBonus: 1 }),
        id: "item-sword", order: 1, group: "equipment" },
    ];
  } });
  const repository = new InMemoryCampaignRepository();
  const app = new CampaignApplication(repository);
  let snapshot = await repository.save(createTestCampaign({ character }), { kind: "empty" });
  const current = () => snapshot.campaign.characters[character.id]!;
  const command = (index = 0) => ({ characterId: character.id,
    itemId: current().inventory[index]!.id, expectedCharacterRevision: current().revision,
    expectedCampaignChecksum: snapshot.checksum });
  const accept = (next: CampaignSnapshot) => { snapshot = next; };
  return { app, current, command, accept };
}

describe("equipment-derived statistics", () => {
  it("updates saved AC on attunement, activation, deactivation and removal of Dexterity bonuses", async () => {
    const s = await session();
    expect(projectCharacterStatistics(s.current()).abilityScores.dexterity).toBe(10);
    s.accept(await s.app.setInventoryItemAttuned({ ...s.command(), value: true }));
    expect(s.current().combat.armorClass).toBe(11);
    expect(projectCharacterStatistics(s.current()).abilityScores.dexterity).toBe(12);

    const featureId = s.current().inventory[0]!.features[0]!.id;
    s.accept(await s.app.useInventoryFeature({ ...s.command(), featureId }));
    expect(s.current().combat.armorClass).toBe(12);
    s.accept(await s.app.setInventoryFeatureActive({ ...s.command(), featureId, value: false }));
    expect(s.current().combat.armorClass).toBe(11);
    s.accept(await s.app.setInventoryItemAttuned({ ...s.command(), value: false }));
    expect(s.current().combat.armorClass).toBe(10);
    s.accept(await s.app.setInventoryItemAttuned({ ...s.command(), value: true }));
    s.accept(await s.app.removeInventoryItem(s.command()));
    expect(s.current().combat.armorClass).toBe(10);
  });

  it("removes stale AC when the last relevant bonus is edited away", async () => {
    const s = await session();
    s.accept(await s.app.setInventoryItemAttuned({ ...s.command(), value: true }));
    s.accept(await s.app.upsertInventoryItem({ ...s.command(),
      item: { ...s.current().inventory[0]!, bonuses: [bonus("AC", 3, "combatStats")], features: [] } }));
    expect(s.current().combat.armorClass).toBe(13);
    s.accept(await s.app.upsertInventoryItem({ ...s.command(),
      item: { ...s.current().inventory[0]!, bonuses: [] } }));
    expect(s.current().combat.armorClass).toBe(10);
  });

  it("updates AC when consuming the last equipped item providing a bonus", async () => {
    const s = await session();
    s.accept(await s.app.upsertInventoryItem({ ...s.command(), item: {
      ...s.current().inventory[0]!, usable: true, consumable: true, charges: null,
    } }));
    s.accept(await s.app.setInventoryItemAttuned({ ...s.command(), value: true }));
    expect(s.current().combat.armorClass).toBe(11);
    s.accept(await s.app.useInventoryItem(s.command()));
    expect(s.current().combat.armorClass).toBe(10);
  });

  it.each([true, false])("updates weapon damage regardless of whether the bonus is active before equip (%s)", async (beforeEquip) => {
    const s = await session();
    s.accept(await s.app.upsertInventoryItem({ ...s.command(),
      item: { ...s.current().inventory[0]!, bonuses: [bonus("strength")], features: [] } }));
    if (beforeEquip) s.accept(await s.app.setInventoryItemAttuned({ ...s.command(), value: true }));
    s.accept(await s.app.setInventoryItemEquipped({ ...s.command(1), value: true }));
    if (!beforeEquip) s.accept(await s.app.setInventoryItemAttuned({ ...s.command(), value: true }));
    const action = s.current().actions[0]!;
    expect(projectActionAttackModifier(s.current(), action)).toBe(1);
    expect(projectActionDamageBonus(s.current(), action)).toBe(2); // STR +1 and weapon +1
    expect(projectInventory(s.current()).carryingCapacity).toBe(180);
    expect(projectCharacterStatistics(s.current()).abilityScores.strength).toBe(12);
    expect(s.current().abilities.strength).toBe(10);

    // Extra authored damage is preserved; standalone actions keep their own formula.
    expect(projectActionDamageBonus(s.current(), { ...action, damageBonus: action.damageBonus + 5 })).toBe(7);
    expect(projectActionDamageBonus(s.current(), { ...action, inventoryItemId: null })).toBe(1);
    s.accept(await s.app.setInventoryItemEquipped({ ...s.command(), value: false }));
    expect(projectActionDamageBonus(s.current(), s.current().actions[0]!)).toBe(1);
    expect(projectInventory(s.current()).carryingCapacity).toBe(150);
  });

  it("honors armor Dexterity limits and leaves unrelated manual AC unchanged", async () => {
    const s = await session();
    s.accept(await s.app.upsertInventoryItem({ ...s.command(), item: {
      ...s.current().inventory[0]!, category: "armor", bonuses: [bonus("dexterity", 8)],
      armor: { base: 14, dexterityBonus: true, maximumDexterityBonus: 2,
        armorCategory: "medium", stealthDisadvantage: false, strengthRequirement: null },
    } }));
    s.accept(await s.app.setInventoryItemAttuned({ ...s.command(), value: true }));
    expect(s.current().combat.armorClass).toBe(16);
    s.accept(await s.app.editCharacter({ ...s.command(), patch: { combat: { armorClass: 19 } } }));
    s.accept(await s.app.upsertInventoryItem({ ...s.command(),
      item: { ...s.current().inventory[0]!, description: "New description" } }));
    expect(s.current().combat.armorClass).toBe(19);
  });
});
