import { z } from "zod";
import type { JsonObject } from "./json";

/** Validation without rebuilding records: opaque originals must retain every own key. */
function validJson(value: unknown, ancestors: WeakSet<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  ancestors.add(value);
  const keys = Reflect.ownKeys(value);
  const valid = keys.every((key) => {
    if (typeof key !== "string") return false;
    if (Array.isArray(value) && key === "length") return true;
    if (Array.isArray(value) && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return descriptor.enumerable && "value" in descriptor && validJson(descriptor.value, ancestors);
  }) && (!Array.isArray(value) || Object.keys(value).length === value.length);
  ancestors.delete(value);
  return valid;
}

export const LosslessJsonObjectSchema = z.custom<JsonObject>((value) =>
  value !== null && typeof value === "object" && !Array.isArray(value) && validJson(value, new WeakSet()),
  "El original debe ser un objeto JSON completo, sin valores que se pierdan al serializar.",
);
