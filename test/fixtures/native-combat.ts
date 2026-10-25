import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createCharacter } from "../../src/domain/character/create-character";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";

export async function nativeCombatFixture() {
  const source = new InMemoryCampaignRepository();
  const snapshot = await new CampaignApplication(source).createCampaign("2026-10-20T12:00:00Z");
  const character = createCharacter("chr_11111111111111111111111111111111", "Delerion", "2026-10-20T12:00:00Z");
  character.identity.className = "Mago";
  character.abilities.dexterity = 16;
  character.combat.hitPoints = { current: 12, maximum: 18, temporary: 3 };
  snapshot.campaign.characters[character.id] = character;
  const monster = normalizeMonsterDefinition({ Id: "goblin", Name: "Goblin", Type: "Humanoide", Challenge: "1/4",
    HP: { Value: 7 }, AC: { Value: 15 }, InitiativeModifier: 2, Speed: ["30 pies"] });
  snapshot.campaign.gm.miniatureAssociations = {
    "mini-goblin": { displayName: "Goblin del puente", boardAssetId: "asset-goblin", monster: {
      definitionId: monster.id, name: monster.name, armorClass: monster.armorClass, hitPoints: monster.hitPoints,
    }, characterId: null, updatedAt: "2026-10-20T12:00:00Z" },
    "mini-hero": { displayName: "Delerion", boardAssetId: "asset-hero", monster: null,
      characterId: character.id, updatedAt: "2026-10-20T12:00:00Z" },
  };
  await source.save(snapshot.campaign, { kind: "checksum", checksum: snapshot.checksum });
  const queue = { items: [
    { id: "mini-goblin", name: "Goblin del puente", kind: "creature" },
    { id: "mini-hero", name: "Delerion", kind: "creature" },
    { id: "mini-new", name: "Guardia de la torre", kind: "creature" },
  ], activeItemIndex: 0 };
  return { source, character, monster, queue };
}
