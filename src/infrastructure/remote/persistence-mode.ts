import { z } from "zod";

const PersistenceModeSchema = z.enum(["local", "dual", "remote"]);

export type PersistenceMode = z.infer<typeof PersistenceModeSchema>;

export function resolvePersistenceMode(
  environment: Record<string, string | boolean | undefined>,
): PersistenceMode {
  const value = environment.VITE_PERSISTENCE_MODE;
  return PersistenceModeSchema.parse(typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : "local");
}

export function loadPersistenceMode(): PersistenceMode {
  return resolvePersistenceMode(import.meta.env);
}
