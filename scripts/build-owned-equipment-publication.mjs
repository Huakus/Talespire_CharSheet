import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";
const root = "tmp/equipment-definitions", read = (name) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
const plan = read("owned-migration-plan.json"), snapshot = read("owned-migration-live-before.json"), catalog = read("owned-migration-catalog-before.json");
catalog.entries = read("owned-migration-active-catalog-before.json").entries;
const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true }, appType: "custom" });
try {
  const { bindReviewedEquipment } = await server.ssrLoadModule("/src/domain/equipment/equipment-live.ts");
  const { normalizeEquipmentDefinition } = await server.ssrLoadModule("/src/domain/equipment/equipment-catalog.ts");
  const { serializeEquipmentContentPayload, serializeMonsterContentPayload } = await server.ssrLoadModule("/src/domain/content/content-payload.ts");
  const { normalizeMonsterDefinition } = await server.ssrLoadModule("/src/domain/monsters/monster-catalog.ts");
  const { CharacterV2Schema } = await server.ssrLoadModule("/src/domain/character/character-v2.ts");
  const { projectInventory, projectAbilityScore } = await server.ssrLoadModule("/src/domain/character/character-projection.ts");
  const { PHB_SPELLS } = await server.ssrLoadModule("/src/domain/character/phb-spells.ts");
  const { createDeterministicId } = await server.ssrLoadModule("/src/shared/id.ts");
  const { CharacterSpellV2Schema } = await server.ssrLoadModule("/src/domain/character/character-spell-model.ts");
  const definitions = [], fragments = [], merchants = [], projections = [], spellFragments = [];
  for (const [key, copy] of new Map(plan.changes.map((c) => [c.key, c]))) {
    const previous = catalog.entries.find((r) => r.content_key === key);
    const d = copy.after.rules.definition;
    const template = previous ? normalizeEquipmentDefinition(previous.payload) : { ...copy.before, equipped: false, attuned: false };
    const original = { ...template, id: "inv_00000000000000000000000000000000", order: 0, group: "backpack" };
    delete original.rarity;
    const item = bindReviewedEquipment(original, d);
    item.name = d.name; item.quantity = 1; item.equipped = false; item.attuned = false;
    if (item.charges) item.charges.current = item.charges.maximum;
    if (item.rules.storage) item.rules.storage = { known: true, spells: [] };
    if (d.economy.basePrice) item.cost = d.economy.basePrice;
    else if (d.economy.campaignPrice) item.cost = d.economy.campaignPrice;
    item.rules.pending = item.rules.pending.filter((note) => !note.includes("no había contador válido"));
    const { id: _id, order: _order, group: _group, ...draft } = item;
    const payload = serializeEquipmentContentPayload({ ...draft, rarity: d.rarity ?? "none" });
    definitions.push({ key, before: previous ?? null, name: d.name, origin: previous?.origin ?? "gm", tags: ["es", "revisado", d.origin === "campaign" ? "custom" : "reglas_2014"], payload, revision: (previous?.revision ?? -1) + 1 });
  }
  for (const copy of plan.changes) {
    const published = definitions.find((d) => d.key === copy.key);
    copy.after.catalog = { contentKey: copy.key, origin: published.origin, tags: published.tags, revision: published.revision };
    if (copy.kind === "character") fragments.push({ before: copy.fragment, after: { ...copy.fragment, payload: copy.after } });
  }
  for (const row of snapshot.merchants.filter((r) => r.kind === "monster" && r.payload.inventory?.length)) {
    const next = structuredClone(row.payload);
    next.inventory = next.inventory.map((item) => plan.changes.find((c) => c.kind === "merchant" && c.rowKey === row.content_key && c.before.id === item.id)?.after ?? item);
    const parsed = normalizeMonsterDefinition(next);
    assert.deepEqual(serializeMonsterContentPayload(parsed).inventory, next.inventory);
    merchants.push({ before: row, payload: next });
  }
  const changedOwners = new Set(plan.changes.filter((c) => c.kind === "character").map((c) => c.ownerId));
  for (const ownerId of changedOwners) {
    const rows = snapshot.characters.filter((r) => r.parent_id === ownerId), get = (kind) => rows.filter((r) => r.fragment_kind === kind).sort((a,b) => a.position-b.position).map((r) => r.payload);
    const core = get("character-core")[0], runtime = get("character-runtime")[0], version = catalog.versions.find((v) => v.character_id === ownerId);
    const before = CharacterV2Schema.parse({ ...core, ...runtime, spellcasting: { ...runtime.spellcasting, spells: [] }, revision: version.revision, metadata: { createdAt: version.created_at, updatedAt: version.updated_at }, actions: get("character-action"), inventory: get("character-inventory"), traits: get("character-trait"), extras: get("character-extra"), notes: get("character-note") });
    const after = structuredClone(before);
    after.inventory = before.inventory.map((item) => plan.changes.find((c) => c.kind === "character" && c.ownerId === ownerId && c.before.id === item.id)?.after ?? item);
    for (const copy of plan.changes.filter((c) => c.kind === "character" && c.ownerId === ownerId)) for (const cap of copy.after.rules.definition.capabilities) for (const effect of cap.effects.filter((e) => e.kind === "spell")) {
      const source = `inventory:${copy.after.id}:${cap.id}`;
      if ((catalog.spells ?? []).some((row) => row.parent_id === ownerId && row.payload.casting?.source === source)) continue;
      const spellDefinition = structuredClone(PHB_SPELLS[effect.spellKey]);
      if (!spellDefinition) continue;
      if (effect.components === "waived") { spellDefinition.components = ""; spellDefinition.material = ""; }
      else if (effect.components === "custom" && effect.explanation.includes("materiales")) { spellDefinition.components = spellDefinition.components.replace(/,?\s*M(?:\s*\([^)]*\))?/g, ""); spellDefinition.material = ""; }
      const id = await createDeterministicId("spl", ownerId, copy.after.id, cap.id);
      const position = 10000 + spellFragments.filter((r) => r.parent_id === ownerId).length;
      const spell = CharacterSpellV2Schema.parse({ id, order: position, name: spellDefinition.name, level: effect.level, prepared: true, definition: spellDefinition, casting: { kind: "item", source, key: effect.spellKey, ability: effect.ability ?? "intelligence", level: effect.level, traitId: null }, effect: { active: false, description: "" } });
      spellFragments.push({ campaign_id: snapshot.characters[0].campaign_id, fragment_kind: "character-spell", parent_id: ownerId, entity_id: id, position, payload: spell });
    }
    for (const actionRow of rows.filter((r) => r.fragment_kind === "character-action")) {
      const action = actionRow.payload, c = plan.changes.find((c) => c.ownerId === ownerId && c.before.id === action.inventoryItemId);
      if (!c || !c.before.weapon || !c.after.weapon) continue;
      const oldWeapon = c.before.weapon, newWeapon = c.after.weapon;
      const next = { ...action, name: action.name === c.before.name ? c.after.name : action.name, attackBonus: action.attackBonus + newWeapon.attackBonus-oldWeapon.attackBonus, damageBonus: action.damageBonus + newWeapon.damageBonus-oldWeapon.damageBonus, damageExpression: action.damageExpression === oldWeapon.damageExpression ? newWeapon.damageExpression : action.damageExpression, damageType: newWeapon.damageType, properties: c.after.properties.join(", "), description: !action.description || action.description === c.before.description ? c.after.description : action.description };
      after.actions = after.actions.map((a) => a.id === action.id ? next : a);
      if (JSON.stringify(next) !== JSON.stringify(action)) fragments.push({ before: actionRow, after: { ...actionRow, payload: next } });
    }
    CharacterV2Schema.parse(after);
    projections.push({ character: before.name, id: ownerId, armorClassBefore: projectInventory(before).calculatedArmorClass, armorClassAfter: projectInventory(after).calculatedArmorClass, abilitiesBefore: Object.fromEntries(Object.keys(before.abilities).map((key) => [key, projectAbilityScore(before,key)])), abilitiesAfter: Object.fromEntries(Object.keys(after.abilities).map((key) => [key,projectAbilityScore(after,key)])), copies: plan.changes.filter((c) => c.ownerId === ownerId && c.kind === "character").length });
  }
  const result = { campaignRevision: plan.campaignRevision, definitions, fragments, spellFragments, merchants, versions: catalog.versions.filter((v) => changedOwners.has(v.character_id)), projections, blocked: plan.blocked, copies: plan.changes.map(({ kind, owner, before, after }) => ({ kind, owner, id: before.id, from: before.name, to: after.name, pending: after.rules.pending })) };
  writeFileSync(`${root}/owned-migration-publication.json`, JSON.stringify(result));
  writeFileSync(`${root}/owned-migration-preview.json`, JSON.stringify({ definitions: definitions.length, changedFragments: fragments.length, merchants: merchants.length, characters: changedOwners.size, copies: plan.changes.length, projections, blocked: plan.blocked }, null, 2));
  console.log(JSON.stringify({ definitions: definitions.length, inventory: fragments.filter((r) => r.before.fragment_kind === "character-inventory").length, actions: fragments.filter((r) => r.before.fragment_kind === "character-action").length, merchants: merchants.length, newDefinitions: definitions.filter((d) => !d.before).length, projections, blocked: plan.blocked }, null, 2));
} finally { await server.close(); }
