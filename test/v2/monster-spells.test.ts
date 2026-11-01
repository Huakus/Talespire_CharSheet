import { describe, expect, it } from "vitest";
import { normalizeMonsterDefinition } from "../../src/domain/monsters/monster-catalog";
import { normalizeSpellDefinition } from "../../src/domain/spells/spell-catalog";
import { monsterSpellcasting, monsterSpellEffect, resolveMonsterSpell } from "../../src/domain/monsters/monster-spells";
import { serializeMonsterContentPayload, parseCampaignContentPayload } from "../../src/domain/content/content-payload";
import { renderMonsterSpellCards } from "../../src/ui/monster-spells";

const casting = { ability: "intelligence" as const, attackBonus: 7, saveDc: 15, casterLevel: 11 };
const mage = () => normalizeMonsterDefinition({ Id: "mage", Name: "Mago", Abilities: { Int: 18 }, spellcasting: casting });

describe("monster spellcasting", () => {
  it("resolves translated and English spell names and prefers campaign overrides", () => {
    const english = resolveMonsterSpell("Fireball", []);
    const spanish = resolveMonsterSpell("Bola de fuego", []);
    expect(english?.key).toBe("fireball");
    expect(spanish?.key).toBe(english?.key);
    const custom = { ...english!.definition, damageExpression: "9d6", catalog: { origin: "gm" as const, contentKey: "custom", revision: 2, tags: [] } };
    expect(resolveMonsterSpell(custom.name, [english!.definition, custom])?.definition.damageExpression).toBe("9d6");
    expect(resolveMonsterSpell("Fireball", [{ ...custom, name: "Bola de fuego" }])?.definition.damageExpression).toBe("9d6");
    expect(resolveMonsterSpell("Conjuro inexistente", [])).toBeNull();
  });

  it("preserves explicit casting data through canonical campaign serialization", () => {
    const monster = mage();
    const payload = serializeMonsterContentPayload(monster);
    expect(normalizeMonsterDefinition(parseCampaignContentPayload("monster", payload)).spellcasting).toEqual(casting);
    expect(monsterSpellcasting(monster)).toEqual(casting);
  });

  it("uses only explicit casting traits for inference and does not infer caster level from CR", () => {
    const monster = normalizeMonsterDefinition({ Name: "Mago", Challenge: "20", Traits: [
      { Name: "Spellcasting", Content: "An 11th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 15, +7 to hit with spell attacks)." },
      { Name: "Sword", Content: "+9 to hit, DC 19" },
    ] });
    expect(monsterSpellcasting(monster)).toEqual(casting);
    monster.traits = [];
    expect(monsterSpellcasting(monster)).toEqual({ ability: null, attackBonus: null, saveDc: null, casterLevel: null });
    monster.traits = [{ name: "Conjuración", content: "CD 13 o CD 18; +5 al ataque o +8 al ataque", usage: "" }];
    expect(monsterSpellcasting(monster).saveDc).toBeNull();
    expect(monsterSpellcasting(monster).attackBonus).toBeNull();
  });

  it("scales damage, adds the actual casting ability and treats eldritch blast as separate beams", () => {
    const spell = normalizeSpellDefinition({ name: "Efecto", level: 1, damageExpression: "2d6", upcastDamageExpression: "1d6", addAbilityModifier: true });
    expect(monsterSpellEffect(mage(), spell, null, 3)).toMatchObject({ expression: "4d6+4", warnings: [], beams: 1 });
    expect(monsterSpellEffect(mage(), { ...spell, level: 0 }, null, 0).expression).toBe("4d6+4");
    const blast = resolveMonsterSpell("Eldritch Blast", [])!;
    expect(monsterSpellEffect(mage(), blast.definition, blast.key, 0)).toMatchObject({ expression: "1d10", beams: 3 });
    const { spellcasting: _casting, ...unknown } = mage();
    expect(monsterSpellEffect(unknown, { ...spell, level: 0 }, null, 0).expression).toBeNull();
    expect(monsterSpellEffect(mage(), { ...spell, damageExpression: "invalid" }, null, 1).expression).toBeNull();
  });

  it("shows usable attacks, save DCs, rules, upcasting and missing definitions", () => {
    const monster = { ...mage(), spells: ["Fireball", "Fire Bolt", "Missing Spell"] };
    const html = renderMonsterSpellCards(monster, [], "Mago 2");
    expect(html).toContain('data-monster-spell-level');
    expect(html).toContain('data-roll-expression="1d20+7"');
    expect(html).toContain("CD 15");
    expect(html).toContain('data-roll-expression="3d10"');
    expect(html).toContain("Reglas y descripción");
    expect(html).toContain("Missing Spell");
    expect(html).toContain("No se encontró una ficha");
  });
});
