import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";

const TemporaryPasswordResponseSchema = z.object({
  temporaryPassword: z.string().min(12),
});

type PasswordAdministrationClient = Pick<SupabaseClient, "auth" | "functions">;

export async function functionErrorMessage(error: unknown): Promise<string> {
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
      } catch {
        // Fall back to the SDK error when the response is not JSON.
      }
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export async function createCampaignMemberTemporaryPassword(
  client: PasswordAdministrationClient,
  campaignId: string,
  email: string,
): Promise<string> {
  const result = await client.functions.invoke("reset-campaign-member-password", {
    body: { campaignId, email },
  });
  if (result.error) throw new Error(await functionErrorMessage(result.error));
  return TemporaryPasswordResponseSchema.parse(result.data).temporaryPassword;
}

export async function updateSignedInPassword(
  client: PasswordAdministrationClient,
  password: string,
): Promise<User> {
  const result = await client.auth.updateUser({ password });
  if (result.error) throw result.error;
  if (!result.data.user) throw new Error("Supabase no confirmó el cambio de contraseña.");
  return result.data.user;
}
