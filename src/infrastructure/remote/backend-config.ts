import { z } from "zod";

const RemoteBackendConfigSchema = z.object({
  url: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "Backend URL must use HTTP or HTTPS",
  }),
  publishableKey: z.string().min(1),
});

export interface RemoteBackendConfig {
  url: string;
  publishableKey: string;
}

export class RemoteBackendConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteBackendConfigurationError";
  }
}

export function resolveRemoteBackendConfig(
  environment: Record<string, string | boolean | undefined>,
): RemoteBackendConfig | null {
  const url = typeof environment.VITE_SUPABASE_URL === "string"
    ? environment.VITE_SUPABASE_URL.trim()
    : "";
  const publishableKey = typeof environment.VITE_SUPABASE_PUBLISHABLE_KEY === "string"
    ? environment.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
    : "";

  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) {
    throw new RemoteBackendConfigurationError(
      "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be configured together",
    );
  }

  const parsed = RemoteBackendConfigSchema.safeParse({ url, publishableKey });
  if (!parsed.success) {
    throw new RemoteBackendConfigurationError(parsed.error.issues[0]?.message ?? "Invalid backend configuration");
  }
  return parsed.data;
}

export function loadRemoteBackendConfig(): RemoteBackendConfig | null {
  return resolveRemoteBackendConfig(import.meta.env);
}
