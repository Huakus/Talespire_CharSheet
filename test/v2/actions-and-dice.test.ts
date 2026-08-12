import { describe, expect, it } from "vitest";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import {
  normalizeDiceExpression,
  parseDiceExpression,
} from "../../src/domain/dice/dice-expression";
import { projectActionAttackModifier } from "../../src/domain/character/character-projection";
import { BrowserDiceRoller } from "../../src/infrastructure/dice/browser-dice-roller";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { TaleSpireDiceRoller } from "../../src/infrastructure/talespire/talespire-dice-roller";
import { createTestCampaign, createTestCharacter } from "../fixtures/native-campaign";

describe("actions", () => {
  it("creates, updates and removes actions through the application", async () => {
    const repository = new InMemoryCampaignRepository();
    const application = new CampaignApplication(repository);
    const character = createTestCharacter({ configure(value) {
      value.identity.level = 3;
      value.abilities.dexterity = 14;
      value.actions = [{
        id: "action-thrust", order: 0, name: "Estocada", categories: ["attack", "action"],
        activation: "Acción", reach: "5 ft", ability: "dexterity", proficient: true,
        attackBonus: 0, damageExpression: "1d6+2", damageBonus: 0,
        damageType: "Perforante", weaponType: "Cuerpo a cuerpo", properties: "Finesse",
        description: "Ataque de prueba", inventoryItemId: null, rollMode: "normal",
      }];
    } });
    expect(projectActionAttackModifier(character, character.actions[0]!)).toBe(4);
    const initial = await repository.save(createTestCampaign({ id: "action-crud", character }), {
      kind: "empty",
    });
    const created = await application.upsertCharacterAction({
      characterId: character.id,
      expectedCharacterRevision: character.revision,
      expectedCampaignChecksum: initial.checksum,
      updatedAt: "2026-07-25T17:01:00.000Z",
      action: {
        order: 1,
        name: "Empujón",
        categories: ["action"],
        activation: "Acción",
        reach: "5 ft",
        ability: "strength",
        proficient: true,
        attackBonus: 0,
        damageExpression: "",
        damageBonus: 0,
        damageType: "",
        weaponType: "",
        properties: "",
        description: "",
        inventoryItemId: null,
        rollMode: "normal",
      },
    });
    const afterCreate = created.campaign.characters[character.id]!;
    expect(afterCreate.actions).toHaveLength(2);
    const createdAction = afterCreate.actions.find((action) => action.name === "Empujón")!;

    const removed = await application.removeCharacterAction({
      characterId: character.id,
      actionId: createdAction.id,
      expectedCharacterRevision: afterCreate.revision,
      expectedCampaignChecksum: created.checksum,
      updatedAt: "2026-07-25T17:02:00.000Z",
    });
    expect(removed.campaign.characters[character.id]?.actions).toHaveLength(1);
  });
});

describe("dice", () => {
  it("parses and normalizes additive dice expressions", () => {
    expect(parseDiceExpression("2d6 + 1d4 - 3")).toEqual([
      { sign: 1, count: 2, sides: 6 },
      { sign: 1, count: 1, sides: 4 },
      { sign: -1, count: 3, sides: null },
    ]);
    expect(normalizeDiceExpression("d20 + 4")).toBe("1d20+4");
    expect(() => parseDiceExpression("2d6++4")).toThrow();
  });

  it("rolls locally when TaleSpire is unavailable", async () => {
    const result = await new BrowserDiceRoller().roll({
      name: "Prueba",
      expressions: ["1d2+3"],
      mode: "normal",
    });
    expect(result.kind).toBe("rolled");
    expect(result.totals[0]).toBeGreaterThanOrEqual(4);
    expect(result.totals[0]).toBeLessThanOrEqual(5);
  });

  it("submits two d20 groups for TaleSpire advantage", async () => {
    const submitted: { name: string; roll: string }[][] = [];
    const roller = new TaleSpireDiceRoller({
      putDiceInTray: async (rolls) => {
        submitted.push(rolls);
      },
    });
    const result = await roller.roll({
      name: "Atletismo",
      expressions: ["1d20+5"],
      mode: "advantage",
    });
    expect(result.kind).toBe("submitted");
    expect(submitted[0]).toHaveLength(2);
    expect(submitted[0]?.[0]?.roll).toBe("1d20+5");
  });

  it("resolves TaleSpire callbacks and keeps the best advantage result", async () => {
    const roller = new TaleSpireDiceRoller({
      putDiceInTray: async () => "roll-1",
      evaluateDiceResultsGroup: async (group) => Number((group as { total: number }).total),
    });
    const resolved: number[] = [];
    roller.subscribe((result) => resolved.push(result.total));
    await roller.roll({ name: "Iniciativa: Hero", expressions: ["1d20+3"], mode: "advantage" });
    await roller.handleRollEvent({
      kind: "rollResults",
      payload: { rollId: "roll-1", resultsGroups: [{ total: 9 }, { total: 17 }] },
    });
    expect(resolved).toEqual([17]);
  });
});
