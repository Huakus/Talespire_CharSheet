import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { packContents } from './equipment-pack-contents.mjs';
const root = 'docs/v2/equipment-packs-2026-11-01/';
const parts = [0,1,2].flatMap(i => JSON.parse(readFileSync(root + `parts-${i}.json`, 'utf8')));
const before = JSON.parse(readFileSync(root + 'before.json', 'utf8'));
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { EquipmentDefinitionDraftSchema } = await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');
  const changes = before.map(row => {
    const definition = EquipmentDefinitionDraftSchema.parse(row.definition), list = packContents[row.name];
    assert.ok(list, row.name);
    let unitWeight = 0;
    const contents = list.map(([name, quantity]) => {
      const matches = parts.filter(r => r.name === name);
      assert.equal(matches.length, 1, name);
      const part = matches[0]; assert.equal(part.payload.quantity, 1, name);
      unitWeight += part.payload.unitWeight * quantity;
      return { contentKey: part.key, quantity };
    });
    assert.ok(definition.capabilities.length <= 1, row.name);
    if (!definition.capabilities.length) definition.capabilities.push({
      id: 'unpack', name: 'Desembalar el paquete', activation: 'other', trigger: '',
      requirements: { ...definition.requirements, presence: 'possessed' }, target: 'El paquete', range: '', duration: 'Instantánea', concentration: false,
      costs: [], consumeQuantity: 0, effects: [{ id: 'pack-contents', kind: 'unpack', condition: '', contents }],
      execution: { mode: 'automatic', handler: 'equipment-unpack', explanation: '', pendingAutomation: [] },
      textBlockIds: definition.description.filter(b=>b.section!=='gm-notes').map(b=>b.id),
    });
    const existing = definition.capabilities[0];
    existing.activation = 'other'; existing.costs = []; existing.consumeQuantity = 0;
    existing.name = 'Desembalar el paquete';
    existing.effects = [{ id: 'pack-contents', kind: 'unpack', condition: '', contents }];
    existing.execution = { mode: 'automatic', handler: 'equipment-unpack', explanation: 'Reemplaza una unidad del paquete por sus componentes canónicos con las cantidades indicadas, sin duplicar el peso ni alterar otras pertenencias.', pendingAutomation: [] };
    definition.weight = { value: unitWeight, unit: 'lb' };
    const features = row.features.map(f => f.id === existing.id ? { ...f, name: 'Desembalar el paquete', kind: 'other', showInActions: false, active: false, toggleable: false, chargeCost: 0 } : f);
    EquipmentDefinitionDraftSchema.parse(definition);
    return { ...row, unitWeight, definition, features };
  });
  assert.equal(changes.length, 14);
  writeFileSync(root + 'reviews.json', JSON.stringify({ baselineRevision: 1751, changes }));
  console.log(JSON.stringify(changes.filter(r=>r.scope==='ece').map(r=>({name:r.name,weight:r.unitWeight,parts:packContents[r.name].length}))));
} finally { await server.close(); }
