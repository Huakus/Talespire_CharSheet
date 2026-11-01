import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const root = 'docs/v2/equipment-last-charge-outcomes-2026-11-01/';
const rows = [0, 1].flatMap(i => JSON.parse(readFileSync(root + `before-${i}.json`, 'utf8')));
const key = suffix => 'official:equipment:es:' + suffix;
const normalStaff = key('aef15424fdc190a838bb4939'), plusTwoStaff = key('f8e1af7cfa4f2f98cf87df55');
const decisions = new Map([
  [key('16bfcef27391210d1ed5263a'), { sides: null, outcome: 'nonmagical', replacementKey: null, refillOnMaximum: null }],
  ...['cbfbeb4aafdeb42aa1660850', '45c8ee7602d853f90c15821e', '21c4865b127dd7942ad60f2f'].map(k => [key(k), { sides: 20, outcome: 'replace', replacementKey: normalStaff, refillOnMaximum: null }]),
  [key('2b9317ec14536ced5520b06e'), { sides: 20, outcome: 'keep', replacementKey: null, refillOnMaximum: '1d12+1' }],
  [key('9a1b04c90dc0a3418eadcb5a'), { sides: 20, outcome: 'replace', replacementKey: plusTwoStaff, refillOnMaximum: '1d8+2' }],
  ...['0896a39342fdfdeba982f162', '46f6e5386a87b70724f56073', 'b97890f2fdedbce0fbe843c2'].map(k => [key(k), { sides: null, outcome: 'destroy', replacementKey: null, refillOnMaximum: null }]),
  [key('59e2d70bb33932f24e564bcb'), { sides: 20, outcome: 'replace', replacementKey: key('f5a09e6d10357773fe2ecbd8'), refillOnMaximum: null }],
  [key('f5a09e6d10357773fe2ecbd8'), { sides: 20, outcome: 'replace', replacementKey: key('59e2d70bb33932f24e564bcb'), refillOnMaximum: null }],
]);
assert.equal(rows.length, 22);
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { EquipmentDefinitionDraftSchema } = await server.ssrLoadModule('/src/domain/equipment/equipment-definition.ts');
  const changes = rows.map(row => {
    const definition = EquipmentDefinitionDraftSchema.parse(row.definition), decision = decisions.get(row.key);
    assert.ok(decision, row.name);
    assert.ok(!definition.capabilities.some(c => c.id === 'last-charge-check'), row.name);
    const blocks = definition.description.filter(b => b.type === 'paragraph' && /(última|ultima).?carga/i.test(b.text));
    assert.ok(blocks.length, row.name);
    definition.capabilities.push({
      id: 'last-charge-check', name: 'Última carga', activation: 'trigger', trigger: 'Al gastar la última carga del objeto.',
      requirements: structuredClone(definition.requirements), target: 'El objeto', range: '', duration: 'Instantánea', concentration: false,
      costs: [], consumeQuantity: 0,
      effects: [{ id: 'last-charge-outcome', kind: 'last-charge-resolution', condition: 'Después de gastar la última carga.', ...decision }],
      execution: { mode: 'automatic', handler: 'equipment-last-charge', explanation: 'Aplica la consecuencia y, cuando corresponde, valida el d20 y la tirada de recuperación. Conserva la identidad del ejemplar y actualiza su forma, ataques y conjuros.', pendingAutomation: [] },
      textBlockIds: blocks.map(b => b.id),
    });
    EquipmentDefinitionDraftSchema.parse(definition);
    return { ...row, definition };
  });
  writeFileSync(root + 'reviews.json', JSON.stringify({ baselineRevision: 1748, changes }));
  writeFileSync(root + 'decisions.json', JSON.stringify([...decisions].map(([key, rule]) => ({ key, ...rule })), null, 2));
  console.log(JSON.stringify({ definitions: changes.length, ece: 11, shared: 11, rules: decisions.size }));
} finally { await server.close(); }
