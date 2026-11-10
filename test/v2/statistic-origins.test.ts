import { describe, expect, it } from "vitest";
import { createCharacter } from "../../src/domain/character/create-character";
import { projectCharacterStatisticOrigins, projectCharacterStatistics, type StatisticOrigin } from "../../src/domain/character/character-projection";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import type { InventoryBonus } from "../../src/domain/character/character-inventory-model";

const bonus = (category: string, key: string, value: number): InventoryBonus => ({ category, key, value, valueSource: null, advantage: false, disadvantage: false });
const create = () => createCharacter('chr_11111111111111111111111111111111', 'Lira', '2026-11-04T12:00:00.000Z');
const sum = (origin: StatisticOrigin) => origin.contributions.reduce((total, part) => total + part.value, 0);

describe('numeric provenance from domain projections', () => {
  it('agrees with totals for training, half training, signed bonuses, saves and passives without mutation', () => {
    const c = create();
    c.identity.level = 5;
    c.abilities.intelligence = 17;
    c.abilities.wisdom = 7;
    c.checks.skills.investigation = { proficiency: 2, bonus: -1, rollMode: 'normal' };
    c.checks.skills.perception.proficiency = 0.5;
    c.checks.savingThrows.intelligence = { proficiency: 1, bonus: 2, rollMode: 'normal' };
    c.checks.passiveBonuses.investigation = 4;
    const before = JSON.stringify(c), projection = projectCharacterStatistics(c);
    const origins = projectCharacterStatisticOrigins(c, projection);
    expect(origins.skills.investigation.total).toBe(8);
    expect(origins.skills.investigation.contributions).toContainEqual({ label: 'Pericia (2 × competencia) · nivel 5', value: 6 });
    expect(origins.skills.investigation.contributions).toContainEqual({ label: 'Bono registrado de habilidad', value: -1 });
    expect(origins.skills.perception.contributions).toContainEqual({ label: 'Redondeo hacia abajo', value: -0.5 });
    expect(origins.passives.investigation.total).toBe(22);
    for (const record of [origins.abilityScores, origins.skills, origins.savingThrows, origins.passives]) {
      for (const origin of Object.values(record)) { expect(sum(origin)).toBe(origin.total); expect(origin.incomplete).toBe(false); }
    }
    expect(sum(origins.initiative)).toBe(projection.initiativeModifier);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('names effective identified sources and never exposes inactive or unidentified item names', () => {
    const c = create();
    const item = { ...normalizeEquipmentDefinition({ name: 'Lente conocida' }), id: 'inv_22222222222222222222222222222222', order: 0, group: 'equipment', equipped: true,
      bonuses: [bonus('skills', 'investigation', 2)] };
    c.inventory = [item,
      { ...structuredClone(item), id: 'inv_33333333333333333333333333333333', name: 'Secreto del GM', identification: { identified: false, name: 'Piedra', appearance: '' } },
      { ...structuredClone(item), id: 'inv_44444444444444444444444444444444', name: 'Sin sintonizar', requiresAttunement: true, attuned: false },
      { ...structuredClone(item), id: 'inv_55555555555555555555555555555555', name: 'Agotado', quantity: 0 },
    ];
    const origin = projectCharacterStatisticOrigins(c).skills.investigation;
    expect(origin.total).toBe(2);
    expect(origin.contributions).toContainEqual({ label: 'Lente conocida', value: 2 });
    expect(JSON.stringify(origin)).not.toMatch(/Secreto del GM|Sin sintonizar|Agotado/);
    expect(sum(origin)).toBe(origin.total);
  });

  it('marks unavailable provenance explicitly instead of guessing the cause of a difference', () => {
    const c = create(), stats = projectCharacterStatistics(c);
    stats.skills.investigation += 7;
    const origin = projectCharacterStatisticOrigins(c, stats).skills.investigation;
    expect(origin.incomplete).toBe(true);
    expect(origin.contributions.at(-1)).toEqual({ label: 'Ajuste final del dominio · origen no desglosado', value: 7 });
    expect(sum(origin)).toBe(stats.skills.investigation);
  });
});
