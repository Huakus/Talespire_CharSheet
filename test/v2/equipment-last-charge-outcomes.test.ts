import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { createCharacter } from "../../src/domain/character/create-character";
import { CharacterInventoryItemV2Schema } from "../../src/domain/character/character-inventory-model";
import { CharacterActionV2Schema } from "../../src/domain/character/character-action-model";
import { spendInventoryItemCharges, resolveInventoryLastCharge, recoverInventoryItem } from "../../src/domain/character/character-inventory";
import { normalizeEquipmentDefinition } from "../../src/domain/equipment/equipment-catalog";
import { bindReviewedEquipment } from "../../src/domain/equipment/equipment-live";
import { projectActionAttackModifier } from "../../src/domain/character/character-projection";
import { equipmentLastChargeRule } from "../../src/domain/equipment/equipment-last-charge";
import { renderEquipmentLastCharge } from "../../src/ui/equipment-last-charge";
import { BrowserApp } from "../../src/ui/browser-app";
import { CampaignApplication } from "../../src/application/campaign/campaign-application";
import { InMemoryCampaignRepository } from "../../src/infrastructure/persistence/in-memory-campaign-repository";
import { createTestCampaign } from "../fixtures/native-campaign";

const root = 'docs/v2/equipment-last-charge-outcomes-2026-11-01/';
const rows = JSON.parse(readFileSync(root + 'reviews.json', 'utf8')).changes.filter((r: { scope: string }) => r.scope === 'ece');
const targets = JSON.parse(readFileSync(root + 'targets-before.json', 'utf8'));
const time = '2026-11-01T15:00:00.000Z', id = 'inv_11111111111111111111111111111111';
function target(key: string) {
  const r = targets.find((r: { key: string }) => r.key === key), revised = rows.find((r: { key: string }) => r.key === key);
  return { ...normalizeEquipmentDefinition(r.payload), order: 0, group: 'Equipo', catalog: { contentKey: key, origin: 'official' as const, tags: [], revision: r.revision },
    rules: { ...r.payload.rules, original: {}, definition: revised?.definition ?? r.payload.rules.definition } };
}
function fixture(name: string) {
  const r = rows.find((r: { name: string }) => r.name === name), c = createCharacter('chr_11111111111111111111111111111111', 'Prueba', time);
  c.identity.className = name === 'Bastón de los bosques' ? 'Druida' : 'Mago';
  const item = CharacterInventoryItemV2Schema.parse({ ...normalizeEquipmentDefinition({ name }), id, order: 3, group: 'Mochila',
    equipped: true, attuned: true, cost: { quantity: 123, unit: 'gp' }, charges: { ...r.charges, current: 1 }, features: r.features });
  c.inventory = [bindReviewedEquipment(item as never, r.definition)];
  c.inventory[0]!.catalog = { contentKey: r.key, origin: 'official', tags: [], revision: r.revision };
  return c;
}
const options = (c: { revision: number }) => ({ expectedRevision: c.revision, updatedAt: time });
function spent(name: string) { const c = fixture(name); return spendInventoryItemCharges(c, id, 1, options(c)); }

describe('Consecuencias particulares de la última carga', () => {
  it.each(['Escarabajo protector', 'Talismán del bien puro', 'Talismán del mal definitivo'])('%s se destruye sin inventar un d20', name => {
    const c = spent(name), before = JSON.stringify(c);
    expect(renderEquipmentLastCharge(c.inventory[0]!)).not.toContain('data-equipment-last-charge-roll');
    expect(() => resolveInventoryLastCharge(c, id, 1, options(c))).toThrow(/no requiere/);
    expect(JSON.stringify(c)).toBe(before);
    expect(resolveInventoryLastCharge(c, id, null, options(c)).inventory).toEqual([]);
  });

  it('el anillo permanece como joya sin magia, cargas, conjuros ni referencia que los vuelva a conceder', () => {
    const c = spent('Anillo de los tres deseos'), old = c.inventory[0]!, next = resolveInventoryLastCharge(c, id, null, options(c)).inventory[0]!;
    expect(next.id).toBe(old.id); expect(next.group).toBe(old.group); expect(next.cost).toEqual(old.cost);
    expect(next.name).toBe('Anillo sin magia'); expect(next.catalog).toBeNull(); expect(next.charges).toBeNull();
    expect(next.rules!.definition.magical).toBe(false); expect(next.rules!.definition.capabilities).toEqual([]);
    expect(next.features).toEqual([]); expect(next.bonuses).toEqual([]); expect(next.attuned).toBe(false);
    expect(next.description).not.toMatch(/deseo|carga|legado|anterior/i);
  });

  it.each(['Bastón de impacto', 'Bastón de los bosques', 'Bastón del cautivador'])('%s se convierte en un bastón corriente con un uno', name => {
    const c = spent(name), key = equipmentLastChargeRule(c.inventory[0]!)!.replacementKey!, replacement = target(key);
    const next = resolveInventoryLastCharge(c, id, 1, { ...options(c), replacement });
    expect(next.inventory[0]!.id).toBe(id); expect(next.inventory[0]!.name).toBe('Bastón');
    expect(next.inventory[0]!.catalog!.contentKey).toBe(key); expect(next.inventory[0]!.weapon!.attackBonus).toBe(0);
    expect(next.inventory[0]!.charges).toBeNull(); expect(next.inventory[0]!.attuned).toBe(false);
    expect(next.actions.find(a => a.inventoryItemId === id)!.damageExpression).toBe('1d6');
  });

  it('el bastón de poder conserva solo +2 y actualiza el ataque vinculado sin sintonización', () => {
    const c = spent('Bastón de poder'); c.abilities.strength = 14;
    c.actions = [CharacterActionV2Schema.parse({ id: 'act_11111111111111111111111111111111', order: 0, name: 'Bastón de poder', categories: ['attack'],
      activation: 'Acción', reach: '5 ft', ability: 'strength', proficient: true, attackBonus: 2, damageBonus: 4,
      damageExpression: '1d6', damageType: 'contundente', weaponType: 'simple', properties: '', description: 'Poderes del bastón', inventoryItemId: id, rollMode: 'normal' })];
    const key = equipmentLastChargeRule(c.inventory[0]!)!.replacementKey!;
    const next = resolveInventoryLastCharge(c, id, 1, { ...options(c), replacement: target(key) });
    const item = next.inventory[0]!, attack = next.actions[0]!;
    expect(item.name).toBe('Bastón +2'); expect(item.requiresAttunement).toBe(false); expect(item.charges).toBeNull();
    expect(item.bonuses).toEqual([]); expect(item.features).toEqual([]); expect(attack.attackBonus).toBe(2);
    expect(attack.damageBonus).toBe(4); expect(projectActionAttackModifier(next, attack)).toBe(6);
    expect(attack.description).not.toContain('Poderes del bastón');
  });

  it.each([['Bastón de los magos', 13, '1d12+1'], ['Bastón de poder', 10, '1d8+2']])('%s exige su segunda tirada con un veinte y no destruye con otro resultado', (name, amount, expression) => {
    const c = spent(String(name)), before = JSON.stringify(c);
    expect(() => resolveInventoryLastCharge(c, id, 20, options(c))).toThrow(String(expression));
    expect(() => resolveInventoryLastCharge(c, id, 20, { ...options(c), recoveryRoll: 99 })).toThrow(String(expression));
    expect(JSON.stringify(c)).toBe(before);
    const next = resolveInventoryLastCharge(c, id, 20, { ...options(c), recoveryRoll: Number(amount) });
    expect(next.inventory[0]!.charges!.current).toBe(amount); expect(next.inventory[0]!.rules!.lastChargePending).toBe(false);
    expect(resolveInventoryLastCharge(c, id, 2, options(c)).inventory[0]!.charges!.current).toBe(0);
  });

  it('el bastón de los magos mantiene su magia incluso con un uno', () => {
    const c = spent('Bastón de los magos'), next = resolveInventoryLastCharge(c, id, 1, options(c));
    expect(next.inventory[0]!.rules!.definition.id).toBe(c.inventory[0]!.rules!.definition.id);
    expect(next.inventory[0]!.charges!.current).toBe(0);
  });

  it('las varitas cambian en ambas direcciones, sin recargarse y conservando el mismo ejemplar', () => {
    let c = spent('Varita De Sonrisas');
    const original = c.inventory[0]!, key = equipmentLastChargeRule(original)!.replacementKey!;
    c = resolveInventoryLastCharge(c, id, 1, { ...options(c), replacement: target(key) });
    expect(c.inventory[0]!.name).toBe('Varita De Ceños Fruncidos'); expect(c.inventory[0]!.charges!.current).toBe(0);
    expect(c.inventory[0]!.id).toBe(id); expect(c.inventory[0]!.cost).toEqual(original.cost);
    c = recoverInventoryItem(c, id, 'dawn', undefined, options(c)); expect(c.inventory[0]!.charges!.current).toBe(3);
    c = spendInventoryItemCharges(c, id, 3, options(c));
    const backKey = equipmentLastChargeRule(c.inventory[0]!)!.replacementKey!;
    c = resolveInventoryLastCharge(c, id, 1, { ...options(c), replacement: target(backKey) });
    expect(c.inventory[0]!.name).toBe('Varita De Sonrisas'); expect(c.inventory[0]!.charges!.current).toBe(0);
  });

  it('una definición ausente o equivocada no pierde el objeto ni la comprobación pendiente', () => {
    const c = spent('Bastón de impacto'), before = JSON.stringify(c);
    expect(() => resolveInventoryLastCharge(c, id, 1, options(c))).toThrow(/definición/);
    expect(() => resolveInventoryLastCharge(c, id, 1, { ...options(c), replacement: target('official:equipment:es:f8e1af7cfa4f2f98cf87df55') })).toThrow(/definición correcta/);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('la interfaz conserva el d20 si TaleSpire requiere ingresar a mano la segunda tirada', async () => {
    const c = spent('Bastón de los magos'), repository = new InMemoryCampaignRepository(), application = new CampaignApplication(repository);
    const snapshot = await repository.save(createTestCampaign({ character: c }), { kind: 'empty' });
    const doc = new Window().document, root = doc.createElement('div');
    const app = new BrowserApp(root as unknown as HTMLElement, application, { storageLabel: 'test', diceRoller: { roll: async () => ({ kind: 'rolled', totals: [], summary: 'Ingresar resultado' }) } });
    const view = app as unknown as { snapshot: typeof snapshot; selectedCharacterId: string; handleEquipmentLastCharge(b: HTMLButtonElement): Promise<void>; render(): void; acceptCharacterSnapshot(s: typeof snapshot): void };
    view.snapshot = snapshot; view.selectedCharacterId = c.id; view.render = () => {};
    view.acceptCharacterSnapshot = s => { view.snapshot = s; };
    root.innerHTML = `<div data-inventory-id="${id}">${renderEquipmentLastCharge(c.inventory[0]!)}</div>`;
    const d20 = root.querySelector('[data-equipment-last-charge-roll]')! as unknown as HTMLInputElement;
    d20.value = '20'; const button = root.querySelector('button')! as unknown as HTMLButtonElement;
    await view.handleEquipmentLastCharge(button);
    expect(d20.value).toBe('20'); expect(button.disabled).toBe(false);
    expect(root.querySelector('[role=status]')!.textContent).toContain('1d12+1');
    expect(view.snapshot.checksum).toBe(snapshot.checksum);
    (root.querySelector('[data-equipment-last-charge-recovery]')! as unknown as HTMLInputElement).value = '8';
    await view.handleEquipmentLastCharge(button);
    expect(view.snapshot.campaign.characters[c.id]!.inventory[0]!.charges!.current).toBe(8);
  });
});
