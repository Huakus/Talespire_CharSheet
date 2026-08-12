import { describe, expect, it } from "vitest";
import { projectCharacterStatistics } from "../../src/domain/character/character-projection";
import {
  applyCharacterResourceCommand,
  InsufficientHitDiceError,
} from "../../src/domain/character/character-resources";
import type { CharacterV2 } from "../../src/domain/character/character-v2";
import { createTestCharacter } from "../fixtures/native-campaign";

const time = "2026-07-25T16:00:00.000Z";

async function characterFixture(): Promise<CharacterV2> {
  return createTestCharacter({ configure(character) {
    character.identity.level = 4;
    character.combat.hitPoints = { current: 10, maximum: 20, temporary: 5 };
    character.combat.hitDice = { current: "1", formula: "1d10", remaining: 1, maximum: 4, dieSize: 10 };
    character.abilities = { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 10, charisma: 18 };
    character.combat.conditions = [{
      id: "condition-concentration", key: "concentration", label: "Concentration",
      level: null, addedAt: time,
    }];
  } });
}

describe("character statistics projection", () => {
  it("derives ability modifiers, initiative and proficiency", async () => {
    const projection = projectCharacterStatistics(await characterFixture());
    expect(projection.abilityModifiers).toMatchObject({
      strength: -1,
      dexterity: 2,
      intelligence: 3,
      charisma: 4,
    });
    expect(projection.initiativeModifier).toBe(2);
    expect(projection.proficiencyBonus).toBe(2);
    expect(projection.skills.perception).toBe(0);
    expect(projection.passives).toEqual({
      perception: 10,
      investigation: 13,
      insight: 10,
    });
  });
});

describe("character resource commands", () => {
  it("applies temporary HP before current HP and requests concentration", async () => {
    const character = await characterFixture();
    const result = applyCharacterResourceCommand(
      character,
      { kind: "damage", amount: 12 },
      { expectedRevision: 0, updatedAt: time },
    );

    expect(result.character.combat.hitPoints).toEqual({
      current: 3,
      maximum: 20,
      temporary: 0,
    });
    expect(result.effects).toMatchObject({
      concentrationCheckDc: 10,
      hitPointsChangedBy: -7,
      temporaryHitPointsChangedBy: -5,
    });
  });

  it("caps healing and clears death saves when HP is restored", async () => {
    const character = await characterFixture();
    character.combat.hitPoints.current = 0;
    character.combat.deathSaves = { successes: 1, failures: 2 };
    const result = applyCharacterResourceCommand(
      character,
      { kind: "heal", amount: 50 },
      { expectedRevision: 0, updatedAt: time },
    );

    expect(result.character.combat.hitPoints.current).toBe(20);
    expect(result.character.combat.hitPoints.temporary).toBe(5);
    expect(result.character.combat.deathSaves).toEqual({
      successes: 0,
      failures: 0,
    });
  });

  it("keeps the greater temporary HP grant", async () => {
    const character = await characterFixture();
    const result = applyCharacterResourceCommand(
      character,
      { kind: "grant-temporary-hit-points", amount: 3 },
      { expectedRevision: 0, updatedAt: time },
    );
    expect(result.character.combat.hitPoints.temporary).toBe(5);
    expect(result.effects.temporaryHitPointsChangedBy).toBe(0);

    const greater = applyCharacterResourceCommand(
      character,
      { kind: "grant-temporary-hit-points", amount: 8 },
      { expectedRevision: 0, updatedAt: time },
    );
    expect(greater.character.combat.hitPoints.temporary).toBe(8);
    expect(greater.effects.temporaryHitPointsChangedBy).toBe(3);
  });

  it("rejects spending unavailable hit dice", async () => {
    const character = await characterFixture();
    expect(() =>
      applyCharacterResourceCommand(
        character,
        { kind: "spend-hit-dice", dice: 2, healing: 7 },
        { expectedRevision: 0, updatedAt: time },
      ),
    ).toThrow(InsufficientHitDiceError);
  });

  it("restores long-rest resources according to the half-dice rule", async () => {
    const character = await characterFixture();
    character.combat.hitDice.remaining = 0;
    character.combat.hitDice.current = "0";
    character.combat.exhaustion = 2;
    character.combat.deathSaves = { successes: 2, failures: 1 };
    const result = applyCharacterResourceCommand(
      character,
      { kind: "long-rest" },
      { expectedRevision: 0, updatedAt: time },
    );

    expect(result.character.combat.hitPoints).toEqual({
      current: 20,
      maximum: 20,
      temporary: 0,
    });
    expect(result.character.combat.hitDice.remaining).toBe(2);
    expect(result.character.combat.exhaustion).toBe(1);
    expect(result.character.combat.deathSaves).toEqual({
      successes: 0,
      failures: 0,
    });
    expect(result.effects.hitDiceRecovered).toBe(2);
  });

  it("adds and removes stable condition entities", async () => {
    const character = await characterFixture();
    const conditionId = "cnd_11111111111111111111111111111111";
    const added = applyCharacterResourceCommand(
      character,
      {
        kind: "add-condition",
        conditionId,
        key: "poisoned",
        label: "Envenenado",
        level: null,
        addedAt: time,
      },
      { expectedRevision: 0, updatedAt: time },
    );
    expect(added.character.combat.conditions).toContainEqual(
      expect.objectContaining({ id: conditionId, key: "poisoned" }),
    );

    const removed = applyCharacterResourceCommand(
      added.character,
      { kind: "remove-condition", conditionId },
      { expectedRevision: 1, updatedAt: "2026-07-25T16:01:00.000Z" },
    );
    expect(removed.character.combat.conditions).not.toContainEqual(
      expect.objectContaining({ id: conditionId }),
    );
  });

  it("adjusts and normalizes currency through the resource command boundary", async () => {
    const character = await characterFixture();
    character.currency = { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 175 };
    const result = applyCharacterResourceCommand(
      character,
      { kind: "adjust-currency", denomination: "silver", quantity: -1 },
      { expectedRevision: 0, updatedAt: time },
    );
    expect(result.character.currency).toEqual({
      platinum: 0,
      gold: 1,
      electrum: 1,
      silver: 1,
      copper: 5,
    });
    expect(result.character.revision).toBe(1);
  });
});
