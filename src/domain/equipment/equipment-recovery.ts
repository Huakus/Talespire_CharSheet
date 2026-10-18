import { z } from "zod";
import type { JsonObject, JsonValue } from "../../shared/json";
import { LosslessJsonObjectSchema } from "../../shared/lossless-json";

const Key = z.string().min(1).refine((value) => value.trim().length > 0);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
/** Capture the complete original row, not the lossy normalized equipment view. */
export const EquipmentSourceArchiveSchema = z.strictObject({
  id: Hash,
  scope: Key,
  originalKey: Key,
  capturedAt: z.string().datetime({ offset: true }),
  raw: LosslessJsonObjectSchema,
});
export type EquipmentSourceArchive = z.infer<typeof EquipmentSourceArchiveSchema>;

function stableJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key]!)}`).join(",")}}`;
  return JSON.stringify(value);
}
async function archiveId(scope: string, originalKey: string, raw: JsonObject): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson({ scope, originalKey, raw }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function captureEquipmentSource(scope: string, originalKey: string, capturedAt: string, input: unknown): Promise<EquipmentSourceArchive> {
  const raw = structuredClone(LosslessJsonObjectSchema.parse(input));
  return EquipmentSourceArchiveSchema.parse({ scope, originalKey, capturedAt, raw, id: await archiveId(scope, originalKey, raw) });
}
export async function verifyEquipmentSource(input: unknown): Promise<boolean> {
  const parsed = EquipmentSourceArchiveSchema.safeParse(input);
  if (!parsed.success) return false;
  return parsed.data.id === await archiveId(parsed.data.scope, parsed.data.originalKey, parsed.data.raw);
}

const escapePointer = (key: string): string => key.replaceAll("~", "~0").replaceAll("/", "~1");
/** Includes empty objects/arrays: an explicit empty value must not silently disappear. */
export function equipmentSourcePointers(value: JsonValue, path = ""): string[] {
  if (value === null || typeof value !== "object") return [path];
  const entries = Object.entries(value);
  return entries.length ? entries.flatMap(([key, child]) => equipmentSourcePointers(child, `${path}/${escapePointer(key)}`)) : [path];
}
function pointerValue(value: JsonValue, pointer: string): { found: boolean; value: JsonValue | undefined } {
  if (pointer === "") return { found: true, value };
  if (!pointer.startsWith("/") || /~(?![01])/.test(pointer)) return { found: false, value: undefined };
  let current: JsonValue = value;
  for (const encoded of pointer.slice(1).split("/")) {
    const key = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, key)) return { found: false, value: undefined };
    if (Array.isArray(current) && !/^(0|[1-9][0-9]*)$/.test(key)) return { found: false, value: undefined };
    current = (current as Record<string, JsonValue>)[key]!;
  }
  return { found: true, value: current };
}

export const EquipmentRecoveryDecisionSchema = z.strictObject({
  sourceId: Hash,
  pointer: z.string(),
  disposition: z.enum(["incorporated", "duplicate", "personal", "discarded"]),
  destination: z.strictObject({ documentId: Key, pointer: z.string() }).nullable(),
  reason: Key,
  reviewed: z.boolean(),
});
export type EquipmentRecoveryDecision = z.infer<typeof EquipmentRecoveryDecisionSchema>;
export interface EquipmentRecoveryAssessment {
  complete: boolean;
  fields: number;
  resolved: number;
  pending: Array<{ sourceId: string; pointer: string }>;
  issues: string[];
}

/** Information accounting only. Completeness here never authorizes deletion or certifies rules. */
export async function assessEquipmentRecovery(
  sources: readonly EquipmentSourceArchive[],
  decisions: readonly EquipmentRecoveryDecision[],
  destinations: ReadonlyMap<string, JsonValue>,
): Promise<EquipmentRecoveryAssessment> {
  const issues: string[] = [], pending: EquipmentRecoveryAssessment["pending"] = [];
  const expected = new Map<string, { sourceId: string; pointer: string }>();
  const byId = new Map<string, EquipmentSourceArchive>();
  for (const source of sources) {
    if (byId.has(source.id)) issues.push(`Origen duplicado: ${source.id}`);
    byId.set(source.id, source);
    if (!await verifyEquipmentSource(source)) issues.push(`El original cambió o no es válido: ${source.id}`);
    for (const pointer of equipmentSourcePointers(source.raw)) expected.set(`${source.id}:${pointer}`, { sourceId: source.id, pointer });
  }
  if (!sources.length) issues.push("No hay originales de los que recuperar información.");
  const seen = new Set<string>(), resolved = new Set<string>();
  for (const input of decisions) {
    const parsed = EquipmentRecoveryDecisionSchema.safeParse(input);
    if (!parsed.success) { issues.push("Hay una decisión de recuperación inválida."); continue; }
    const decision = parsed.data, key = `${decision.sourceId}:${decision.pointer}`;
    if (seen.has(key)) { issues.push(`Hay varias decisiones para ${key}`); continue; }
    seen.add(key);
    const source = byId.get(decision.sourceId);
    if (!source || !expected.has(key)) { issues.push(`El campo de origen no existe: ${key}`); continue; }
    if (!decision.reviewed) continue;
    if (decision.disposition === "discarded") {
      if (decision.destination !== null) { issues.push(`Un descarte no debe simular un destino: ${key}`); continue; }
      resolved.add(key); continue;
    }
    const target = decision.destination;
    const document = target === null ? undefined : destinations.get(target.documentId);
    if (document === undefined || target === null) { issues.push(`Falta el destino de ${key}`); continue; }
    const destination = pointerValue(document, target.pointer);
    if (!destination.found) { issues.push(`El campo de destino no existe: ${key}`); continue; }
    const original = pointerValue(source.raw, decision.pointer);
    if (decision.disposition === "duplicate" && stableJson(original.value!) !== stableJson(destination.value!)) { issues.push(`El supuesto duplicado contiene información diferente: ${key}`); continue; }
    resolved.add(key);
  }
  for (const [key, field] of expected) if (!resolved.has(key)) pending.push(field);
  return { complete: !issues.length && !pending.length, fields: expected.size, resolved: resolved.size, pending, issues };
}
