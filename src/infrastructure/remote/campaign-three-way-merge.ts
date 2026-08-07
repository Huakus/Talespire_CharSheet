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
