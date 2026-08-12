import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { projectInventory } from "../../src/domain/character/character-projection";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

function characterFixture() {
  return createTestCharacter({ configure(character) {
    character.identity.level = 4;
    character.abilities.dexterity = 16;
    character.proficiencies.weapons = ["Simple"];
    character.inventory = [
      {
        id: "item-dagger", order: 0, group: "equipment", name: "Dagger", quantity: 2,
        unitWeight: 1, cost: { quantity: 2, unit: "gp" }, category: "weapon",
        description: "", properties: ["finesse"], equipped: false, attuned: false,
        requiresAttunement: false, usable: false, consumable: false, charges: null, armor: null,
        weapon: { category: "Simple", range: "Melee", normalRange: 5, longRange: null,
          damageExpression: "1d4", versatileDamageExpression: "", damageType: "Piercing",
          attackBonus: 0, damageBonus: 0 },
        bonuses: [], effect: { description: "", active: false }, catalog: null,
      },
      {
        id: "item-ring", order: 1, group: "equipment", name: "Ring", quantity: 1,
        unitWeight: 0.2, cost: { quantity: 50, unit: "gp" }, category: "wondrous-item",
        description: "", properties: ["attunement"], equipped: true, attuned: true,
        requiresAttunement: true, usable: true, consumable: false,
        charges: { current: 2, maximum: 3, reset: "long-rest" }, armor: null, weapon: null,
        bonuses: [], effect: { description: "", active: false }, catalog: null,
      },
    ];
  } });
}

describe("inventory", () => {
  it("stores unit weight, costs, equipment metadata and charges", () => {
    const character = characterFixture();
    const dagger = character.inventory.find((item) => item.name === "Dagger")!;
    const ring = character.inventory.find((item) => item.name === "Ring")!;

    expect(dagger.unitWeight).toBe(1);
    expect(dagger.cost).toEqual({ quantity: 2, unit: "gp" });
    expect(dagger.weapon?.damageExpression).toBe("1d4");
    expect(ring.requiresAttunement).toBe(true);
    expect(ring.charges).toEqual({ current: 2, maximum: 3, reset: "long-rest" });
    expect(projectInventory(character)).toMatchObject({
      totalWeight: 2.2,
      carryingCapacity: 150,
      overCapacity: false,
      attuned: 1,
    });
  });

  it("supports CRUD, use, attunement and weapon action linkage atomically", async () => {
    const repository = new InMemoryCampaignRepository();
    const application = new CampaignApplication(repository);
    const character = characterFixture();
    const initial = await repository.save(createTestCampaign({ id: "inventory-commands", character }), { kind: "empty" });
    const dagger = character.inventory.find((item) => item.name === "Dagger")!;
    const ring = character.inventory.find((item) => item.name === "Ring")!;

    const equipped = await application.setInventoryItemEquipped({
      characterId: character.id,
      itemId: dagger.id,
      value: true,
      expectedCharacterRevision: character.revision,
      expectedCampaignChecksum: initial.checksum,
      updatedAt: "2026-07-25T18:01:00.000Z",
    });
    const afterEquip = equipped.campaign.characters[character.id]!;
    expect(afterEquip.inventory.find((item) => item.id === dagger.id)?.equipped).toBe(true);
    expect(afterEquip.inventory.filter((item) => item.name === "Dagger")).toMatchObject([
      { quantity: 1, equipped: true },
      { quantity: 1, equipped: false },
    ]);
    expect(afterEquip.actions.find((action) => action.inventoryItemId === dagger.id)).toMatchObject({
      name: "Dagger",
      ability: "dexterity",
      proficient: true,
      damageBonus: 3,
    });

    const secondDagger = afterEquip.inventory.find((item) => item.name === "Dagger" && !item.equipped)!;
    const dualWielded = await application.setInventoryItemEquipped({
      characterId: character.id,
      itemId: secondDagger.id,
      value: true,
      expectedCharacterRevision: afterEquip.revision,
      expectedCampaignChecksum: equipped.checksum,
      updatedAt: "2026-07-25T18:01:30.000Z",
    });
    const afterDualWield = dualWielded.campaign.characters[character.id]!;
    expect(afterDualWield.inventory.filter((item) => item.name === "Dagger" && item.equipped)).toHaveLength(2);

    const quantityAdded = await application.adjustInventoryItemQuantity({
      characterId: character.id,
      itemId: dagger.id,
      delta: 1,
      expectedCharacterRevision: afterDualWield.revision,
      expectedCampaignChecksum: dualWielded.checksum,
      updatedAt: "2026-07-25T18:01:40.000Z",
    });
    const afterQuantity = quantityAdded.campaign.characters[character.id]!;
    const thirdDagger = afterQuantity.inventory.find((item) => item.name === "Dagger" && !item.equipped)!;
    await expect(application.setInventoryItemEquipped({
      characterId: character.id,
      itemId: thirdDagger.id,
      value: true,
      expectedCharacterRevision: afterQuantity.revision,
      expectedCampaignChecksum: quantityAdded.checksum,
      updatedAt: "2026-07-25T18:01:50.000Z",
    })).rejects.toThrow("No hay manos libres");

    const used = await application.useInventoryItem({
      characterId: character.id,
      itemId: ring.id,
      expectedCharacterRevision: afterQuantity.revision,
      expectedCampaignChecksum: quantityAdded.checksum,
      updatedAt: "2026-07-25T18:02:00.000Z",
    });
    const afterUse = used.campaign.characters[character.id]!;
    expect(afterUse.inventory.find((item) => item.id === ring.id)?.charges?.current).toBe(1);

    const reset = await application.resetInventoryCharges({
      characterId: character.id,
      reset: "long-rest",
      expectedCharacterRevision: afterUse.revision,
      expectedCampaignChecksum: used.checksum,
      updatedAt: "2026-07-25T18:03:00.000Z",
    });
    expect(reset.campaign.characters[character.id]?.inventory.find(
      (item) => item.id === ring.id,
    )?.charges?.current).toBe(3);
  });

  it("only uses non-consumable objects while they are equipped", async () => {
    const repository = new InMemoryCampaignRepository();
    const application = new CampaignApplication(repository);
    const character = characterFixture();
    const initial = await repository.save(createTestCampaign({ id: "inventory-use", character }), { kind: "empty" });
    const ring = character.inventory.find((item) => item.name === "Ring")!;
    const unequipped = await application.setInventoryItemEquipped({
      characterId: character.id,
      itemId: ring.id,
      value: false,
      expectedCharacterRevision: character.revision,
      expectedCampaignChecksum: initial.checksum,
      updatedAt: "2026-07-25T18:04:00.000Z",
    });
    const current = unequipped.campaign.characters[character.id]!;

    await expect(application.useInventoryItem({
      characterId: character.id,
      itemId: ring.id,
      expectedCharacterRevision: current.revision,
      expectedCampaignChecksum: unequipped.checksum,
      updatedAt: "2026-07-25T18:05:00.000Z",
    })).rejects.toThrow("debe estar equipado");
  });
});
