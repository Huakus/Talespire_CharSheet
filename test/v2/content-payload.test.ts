import { describe, expect, it } from "vitest";
import {
  CampaignContentPayloadSchema,
  parseCampaignContentPayload,
  serializeChecklistContentPayload,
  serializeEquipmentContentPayload,
  serializeMonsterContentPayload,
  serializeShopContentPayload,
  serializeSpellContentPayload,
} from "../../src/domain/content/content-payload";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../src/domain/spells/spell-catalog";

describe("canonical campaign content payloads", () => {
  it("represents spell flags and collections with native JSON types", () => {
    const payload = serializeSpellContentPayload(normalizeSpellDefinition({
      name: "Luz ritual",
      level: 2,
      castingTime: "1 acción",
      ritual: true,
      concentration: false,
      components: "V, S, M",
      classes: "Clérigo, Mago",
      school: "Evocación",
      damageType: "Radiante/Fuego",
    }));

    expect(payload).toMatchObject({
      schemaVersion: 1,
      kind: "spell",
      language: "es",
      level: 2,
      castingTime: "1 acción",
      ritual: true,
      concentration: false,
      components: ["V", "S", "M"],
      classes: ["cleric", "wizard"],
      school: "evocation",
      damageTypes: ["radiant", "fire"],
    });
    expect(payload).not.toHaveProperty("class");
    expect(payload).not.toHaveProperty("damageType");
    expect(CampaignContentPayloadSchema.parse(payload)).toEqual(payload);
  });

  it("uses the same metadata and strips infrastructure state from every content kind", () => {
    const equipment = serializeEquipmentContentPayload(normalizeEquipmentDefinition({
      name: "Daga ceremonial",
      equipment_category: { index: "weapon" },
      damage: { damage_dice: "1d4", damage_type: { index: "piercing" } },
    }));
    const monster = serializeMonsterContentPayload(normalizeMonsterDefinition({
      Id: "guardian",
      Name: "Guardián",
      Type: "Constructo",
      AC: { Value: 16 },
      HP: { Value: 30 },
    }));
    const shop = serializeShopContentPayload({
      name: "Reliquias",
      npcId: "guardian",
      categories: { Armas: ["Daga ceremonial"] },
      tags: ["favorito"],
      inventory: [],
    });
    const checklist = serializeChecklistContentPayload({ id: "chk_1", text: "Preparar encuentro", checked: false });

    for (const payload of [equipment, monster, shop, checklist]) {
      expect(payload).toMatchObject({ schemaVersion: 1, language: "es" });
      expect(payload).not.toHaveProperty("catalog");
      expect(CampaignContentPayloadSchema.parse(payload)).toEqual(payload);
    }
    expect(shop).not.toHaveProperty("tags");
    expect(shop).not.toHaveProperty("inventory");
    expect(monster).toMatchObject({ armorClass: 16, hitPoints: 30, inventory: [] });
    expect(equipment).toMatchObject({ category: "weapon", weapon: { damageExpression: "1d4", damageType: "piercing" } });
    expect(checklist).toMatchObject({ kind: "checklist", checked: false });
  });

  it("validates versioned payloads strictly but leaves legacy payloads to their adapters", () => {
    const legacy = { name: "Escudo", ritual: ", R" };
    expect(parseCampaignContentPayload("spell", legacy)).toBe(legacy);
    expect(() => parseCampaignContentPayload("monster", {
      schemaVersion: 1,
      kind: "spell",
      language: "es",
      name: "Incompleto",
    })).toThrow();
  });
});
