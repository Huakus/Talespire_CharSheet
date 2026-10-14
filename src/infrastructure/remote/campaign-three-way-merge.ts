import { CampaignV2Schema, type CampaignV2 } from "../../domain/character/character-v2";
import { canonicalJsonStringify, cloneJson, type JsonValue } from "../../shared/json";

const missing = Symbol("missing");
type MergeValue = JsonValue | typeof missing;

export interface CampaignMergeResult {
  campaign: CampaignV2 | null;
  conflictPaths: string[];
}

function equal(left: MergeValue, right: MergeValue): boolean {
  if (left === missing || right === missing) return left === right;
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function objectValue(value: MergeValue): value is Record<string, JsonValue> {
  return value !== missing && value !== null && typeof value === "object" && !Array.isArray(value);
}

function identifiedArray(value: MergeValue): value is Array<Record<string, JsonValue> & { id: string }> {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((entry) => {
    if (!objectValue(entry) || typeof entry.id !== "string" || ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  });
}

function pathLabel(parts: readonly string[]): string {
  return parts.length === 0 ? "$" : parts.join(".");
}

function isRevisionPath(path: readonly string[]): boolean {
  if (path.length === 1 && path[0] === "revision") return true;
  return path.length === 3 && path.at(-1) === "revision" &&
    (path[0] === "characters" || path[0] === "encounters");
}

function isUpdatedAtPath(path: readonly string[]): boolean {
  return path.at(-1) === "updatedAt" && path.at(-2) === "metadata";
}

function mergeRevision(base: MergeValue, local: MergeValue, remote: MergeValue): MergeValue {
  if (typeof local !== "number" || typeof remote !== "number") return local;
  const changedLocally = !equal(local, base);
  const changedRemotely = !equal(remote, base);
  return changedLocally && changedRemotely ? Math.max(local, remote) + 1 : Math.max(local, remote);
}

function mergeTimestamp(local: MergeValue, remote: MergeValue): MergeValue {
  if (typeof local !== "string") return remote;
  if (typeof remote !== "string") return local;
  return local >= remote ? local : remote;
}

function mergeIdentifiedArrays(
  base: Array<Record<string, JsonValue> & { id: string }>,
  local: Array<Record<string, JsonValue> & { id: string }>,
  remote: Array<Record<string, JsonValue> & { id: string }>,
  path: readonly string[],
  conflicts: string[],
): JsonValue[] {
  const baseById = new Map(base.map((entry) => [entry.id, entry]));
  const localById = new Map(local.map((entry) => [entry.id, entry]));
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]));
  const order = [...remote.map((entry) => entry.id), ...local.map((entry) => entry.id)]
    .filter((id, index, all) => all.indexOf(id) === index);
  const result: JsonValue[] = [];
  for (const id of order) {
    const merged = mergeValue(
      baseById.get(id) ?? missing,
      localById.get(id) ?? missing,
      remoteById.get(id) ?? missing,
      [...path, `[${id}]`],
      conflicts,
    );
    if (merged !== missing) result.push(merged);
  }
  return result;
}

function mergeValue(
  base: MergeValue,
  local: MergeValue,
  remote: MergeValue,
  path: readonly string[],
  conflicts: string[],
): MergeValue {
  if (equal(local, base)) return remote === missing ? missing : cloneJson(remote);
  if (equal(remote, base)) return local === missing ? missing : cloneJson(local);
  if (isRevisionPath(path)) return mergeRevision(base, local, remote);
  if (isUpdatedAtPath(path)) return mergeTimestamp(local, remote);
  if (equal(local, remote)) return local === missing ? missing : cloneJson(local);

  if (objectValue(base) && objectValue(local) && objectValue(remote)) {
    const result: Record<string, JsonValue> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
      const merged = mergeValue(
        Object.hasOwn(base, key) ? base[key]! : missing,
        Object.hasOwn(local, key) ? local[key]! : missing,
        Object.hasOwn(remote, key) ? remote[key]! : missing,
        [...path, key],
        conflicts,
      );
      if (merged !== missing) result[key] = merged;
    }
    return result;
  }

  if (identifiedArray(base) && identifiedArray(local) && identifiedArray(remote)) {
    return mergeIdentifiedArrays(base, local, remote, path, conflicts);
  }

  conflicts.push(pathLabel(path));
  return remote === missing ? missing : cloneJson(remote);
}

export function mergeCampaignChanges(
  base: CampaignV2,
  local: CampaignV2,
  remote: CampaignV2,
): CampaignMergeResult {
  // Advancement is a semantic operation: two independently acquired levels
  // must never be combined by the generic collection merge.
  for (const [id, previous] of Object.entries(base.characters)) {
    if (previous.builder?.classKey === "wizard" || previous.builder?.classKey === "cleric") {
      const preparation = (character: typeof previous | undefined) => JSON.stringify(character?.spellcasting.spells.filter((spell) => spell.casting?.kind === previous.builder!.classKey && spell.level > 0 && spell.prepared).map((spell) => spell.casting!.key).sort() ?? []);
      const initial = preparation(previous), left = preparation(local.characters[id]), right = preparation(remote.characters[id]);
      if (left !== initial && right !== initial && left !== right) return { campaign: null, conflictPaths: [`characters.${id}.spellcasting.${previous.builder.classKey}.preparation`] };
    }
    const left = local.characters[id]?.builder;
    const right = remote.characters[id]?.builder;
    const original = previous.builder;
    const serialized = (value: typeof original | undefined) => canonicalJsonStringify((value ?? null) as unknown as JsonValue);
    if (previous.builder?.classKey === "cleric") {
      const actions = (character: typeof previous | undefined) => JSON.stringify(character?.spellcasting.cleric?.actions ?? []);
      const initial = actions(previous), a = actions(local.characters[id]), b = actions(remote.characters[id]);
      if (a !== initial && b !== initial && a !== b) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.cleric.actions`] };
    }
    if (previous.builder?.classKey === "rogue") {
      const actions = (character: typeof previous | undefined) => JSON.stringify(character?.spellcasting.rogue?.actions ?? []);
      const initial = actions(previous), a = actions(local.characters[id]), b = actions(remote.characters[id]);
      if (a !== initial && b !== initial && a !== b) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.rogue.actions`] };
    }
    if (previous.builder?.classKey === "barbarian") {
      const actions = (character: typeof previous | undefined) => JSON.stringify(character?.spellcasting.barbarian?.actions ?? []);
      const initial = actions(previous), a = actions(local.characters[id]), b = actions(remote.characters[id]);
      if (a !== initial && b !== initial && a !== b) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.barbarian.actions`] };
      // A rage action cannot be detached from simultaneous damage, rest or advancement.
      // In particular, merging a newly started rage with a remote reduction to zero HP
      // would bypass both its prerequisites and Relentless Rage's resolution.
      const relevantState = (c: typeof previous | undefined) => canonicalJsonStringify((c ? {
        builder: c.builder,barbarian: c.spellcasting.barbarian,hp: c.combat.hitPoints,
        conditions: c.combat.conditions,exhaustion: c.combat.exhaustion,
        resources: c.traits.flatMap((g) => g.traits).filter((t) => t.uses.maximum > 0 || t.uses.used > 0).map((t) => ({ id: t.id,uses: t.uses })).sort((x,y) => x.id.localeCompare(y.id)),
        armor: c.inventory.filter((i) => i.equipped && i.category === "armor").map((i) => ({ id: i.id,armor: i.armor })),
      } : null) as unknown as JsonValue);
      const baseState = relevantState(previous), localState = relevantState(local.characters[id]), remoteState = relevantState(remote.characters[id]);
      if (localState !== remoteState && (a !== initial && remoteState !== baseState || b !== initial && localState !== baseState)) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.barbarian.actions`] };
    }
    if (previous.builder?.classKey === "bard") {
      const actions = (character: typeof previous | undefined) => JSON.stringify(character?.spellcasting.bard?.actions ?? []);
      const initial = actions(previous), a = actions(local.characters[id]), b = actions(remote.characters[id]);
      if (a !== initial && b !== initial && a !== b) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.bard.actions`] };
      // Inspiration spending and recovery must stay atomic with rests and advancement.
      const relevantState = (c: typeof previous | undefined) => canonicalJsonStringify((c ? {
        builder: c.builder,bard: c.spellcasting.bard,hp: c.combat.hitPoints,
        conditions: c.combat.conditions,exhaustion: c.combat.exhaustion,
        resources: c.traits.flatMap((g) => g.traits).filter((t) => t.uses.maximum > 0 || t.uses.used > 0).map((t) => ({ id: t.id,uses: t.uses })).sort((x,y) => x.id.localeCompare(y.id)),
        armor: c.inventory.filter((i) => i.equipped && i.category === "armor").map((i) => ({ id: i.id,armor: i.armor })),
      } : null) as unknown as JsonValue);
      const baseState = relevantState(previous), localState = relevantState(local.characters[id]), remoteState = relevantState(remote.characters[id]);
      if (localState !== remoteState && (a !== initial && remoteState !== baseState || b !== initial && localState !== baseState)) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.bard.actions`] };
    }
    if (previous.builder?.classKey === "ranger") {
      const actions = (character: typeof previous | undefined) => JSON.stringify(character?.spellcasting.ranger?.actions ?? []);
      const initial = actions(previous), a = actions(local.characters[id]), b = actions(remote.characters[id]);
      if (a !== initial && b !== initial && a !== b) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.ranger.actions`] };
      // Companion and resource changes and recovery must stay atomic with rests and advancement.
      const relevantState = (c: typeof previous | undefined) => canonicalJsonStringify((c ? {
        builder: c.builder,ranger: c.spellcasting.ranger,slots: c.spellcasting.slots,hp: c.combat.hitPoints,
        conditions: c.combat.conditions,exhaustion: c.combat.exhaustion,
        resources: c.traits.flatMap((g) => g.traits).filter((t) => t.uses.maximum > 0 || t.uses.used > 0).map((t) => ({ id: t.id,uses: t.uses })).sort((x,y) => x.id.localeCompare(y.id)),
        armor: c.inventory.filter((i) => i.equipped && i.category === "armor").map((i) => ({ id: i.id,armor: i.armor })),
      } : null) as unknown as JsonValue);
      const baseState = relevantState(previous), localState = relevantState(local.characters[id]), remoteState = relevantState(remote.characters[id]);
      if (localState !== remoteState && (a !== initial && remoteState !== baseState || b !== initial && localState !== baseState)) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.ranger.actions`] };
    }
    if (previous.builder?.classKey === "druid") {
      const actions = (character: typeof previous | undefined) => JSON.stringify(character?.spellcasting.druid?.actions ?? []);
      const initial = actions(previous), a = actions(local.characters[id]), b = actions(remote.characters[id]);
      if (a !== initial && b !== initial && a !== b) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.druid.actions`] };
      // Wild shape and resource changes and recovery must stay atomic with rests and advancement.
      const relevantState = (c: typeof previous | undefined) => canonicalJsonStringify((c ? {
        builder: c.builder,druid: c.spellcasting.druid,hp: c.combat.hitPoints,
        conditions: c.combat.conditions,exhaustion: c.combat.exhaustion,
        resources: c.traits.flatMap((g) => g.traits).filter((t) => t.uses.maximum > 0 || t.uses.used > 0).map((t) => ({ id: t.id,uses: t.uses })).sort((x,y) => x.id.localeCompare(y.id)),
        armor: c.inventory.filter((i) => i.equipped && i.category === "armor").map((i) => ({ id: i.id,armor: i.armor })),
      } : null) as unknown as JsonValue);
      const baseState = relevantState(previous), localState = relevantState(local.characters[id]), remoteState = relevantState(remote.characters[id]);
      if (localState !== remoteState && (a !== initial && remoteState !== baseState || b !== initial && localState !== baseState)) return { campaign: null,conflictPaths: [`characters.${id}.spellcasting.druid.actions`] };
    }


    if (serialized(left) !== serialized(original) && serialized(right) !== serialized(original) && serialized(left) !== serialized(right)) {
      return { campaign: null, conflictPaths: [`characters.${id}.builder`] };
    }
  }
  const conflicts: string[] = [];
  const merged = mergeValue(
    base as unknown as JsonValue,
    local as unknown as JsonValue,
    remote as unknown as JsonValue,
    [],
    conflicts,
  );
  if (conflicts.length > 0 || merged === missing) {
    return { campaign: null, conflictPaths: [...new Set(conflicts)] };
  }
  return {
    campaign: CampaignV2Schema.parse(merged),
    conflictPaths: [],
  };
}
