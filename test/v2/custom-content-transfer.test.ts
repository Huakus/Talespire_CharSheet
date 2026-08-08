import { describe, expect, it } from "vitest";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../src/domain/spells/spell-catalog";
import { CustomContentTransferAssembler, buildCustomContentTransfer, parseCustomContentTransferMessage } from "../../src/infrastructure/talespire/custom-content-transfer";
import { TALESPIRE_MESSAGE_CHARACTER_LIMIT } from "../../src/infrastructure/talespire/encounter-transfer";

describe("custom content transfer", () => {
  it("reconstructs the GM catalog within TaleSpire's message limit", async () => {
    const content = {
      spells: [normalizeSpellDefinition({ name: "Llama propia", level: 1, desc: ["x".repeat(900)] })],
      equipment: [normalizeEquipmentDefinition({ name: "Espada propia", rarity: "rare" })],
      monsters: [normalizeMonsterDefinition({ Id: "owl_custom", Name: "Búho mecánico", Type: "Constructo", HP: { Value: 7 }, AC: { Value: 13 } })],
    };
    const messages = await buildCustomContentTransfer(content);
    expect(messages.every((message) => message.length <= TALESPIRE_MESSAGE_CHARACTER_LIMIT)).toBe(true);
    const assembler = new CustomContentTransferAssembler(); let received = null;
    for (const raw of messages) { const message = parseCustomContentTransferMessage(raw); if (message) received = await assembler.accept(message) ?? received; }
    expect(received?.spells[0]?.name).toBe("Llama propia");
    expect(received?.equipment[0]?.rarity).toBe("rare");
    expect(received?.monsters[0]?.name).toBe("Búho mecánico");
  });
});
