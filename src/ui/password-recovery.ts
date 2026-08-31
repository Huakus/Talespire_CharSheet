import type { SupabaseClient, User } from "@supabase/supabase-js";

export type PasswordRecoveryCredential =
  | { kind: "otp"; token: string }
  | { kind: "token-hash"; tokenHash: string };

type PasswordRecoveryAuth = Pick<SupabaseClient["auth"], "updateUser" | "verifyOtp">;

function decodedCandidates(value: string): string[] {
  const candidates = new Set<string>();
  let current = value.trim().replaceAll("&amp;", "&");

  for (let attempt = 0; attempt < 3 && current; attempt += 1) {
    candidates.add(current);
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }

  return [...candidates];
}

function nestedUrlCandidates(value: string): string[] {
  const pending = decodedCandidates(value);
  const candidates = new Set(pending);

  for (let index = 0; index < pending.length && index < 12; index += 1) {
    const candidate = pending[index];
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      for (const parameter of url.searchParams.values()) {
        for (const nested of decodedCandidates(parameter)) {
          if (!/^https?:\/\//i.test(nested) || candidates.has(nested)) continue;
          candidates.add(nested);
          pending.push(nested);
        }
      }
    } catch {
      // A candidate may be an OTP or an incomplete URL. Other candidates can still be valid.
    }
  }

  return [...candidates];
}

function credentialFromUrl(value: string): PasswordRecoveryCredential | null {
  try {
    const url = new URL(value);
    const type = url.searchParams.get("type");
    const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
    if (type !== "recovery" || !tokenHash) return null;
    return { kind: "token-hash", tokenHash };
  } catch {
    return null;
  }
}

export function parsePasswordRecoveryCredential(value: string): PasswordRecoveryCredential {
  const normalized = value.trim();
  if (/^\d{6}$/.test(normalized)) return { kind: "otp", token: normalized };

  for (const candidate of nestedUrlCandidates(normalized)) {
    const credential = credentialFromUrl(candidate);
    if (credential) return credential;
  }

  throw new Error("Pegá el enlace completo de recuperación o el código de 6 dígitos del email.");
}

export async function verifyPasswordRecovery(
  auth: PasswordRecoveryAuth,
  email: string,
  credentialValue: string,
): Promise<User> {
  const credential = parsePasswordRecoveryCredential(credentialValue);
  const result = credential.kind === "otp"
    ? await auth.verifyOtp({ email, token: credential.token, type: "recovery" })
    : await auth.verifyOtp({ token_hash: credential.tokenHash, type: "recovery" });

  if (result.error) throw result.error;
  if (!result.data.session || !result.data.user) {
    throw new Error("Supabase no inició una sesión de recuperación.");
  }
  return result.data.user;
}

export async function updateRecoveredPassword(
  auth: PasswordRecoveryAuth,
  password: string,
): Promise<User> {
  const result = await auth.updateUser({ password });
  if (result.error) throw result.error;
  if (!result.data.user) throw new Error("Supabase no confirmó el cambio de contraseña.");
  return result.data.user;
}
