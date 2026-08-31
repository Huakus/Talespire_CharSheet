import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  parsePasswordRecoveryCredential,
  updateRecoveredPassword,
  verifyPasswordRecovery,
} from "../../src/ui/password-recovery";

type RecoveryAuth = Parameters<typeof verifyPasswordRecovery>[0];

const user = { id: "00000000-0000-4000-8000-000000000001" } as User;

function authWithSuccessfulVerification() {
  return {
    verifyOtp: vi.fn(async () => ({
      data: { user, session: { user } },
      error: null,
    })),
    updateUser: vi.fn(async () => ({ data: { user }, error: null })),
  } as unknown as RecoveryAuth;
}

describe("password recovery", () => {
  it("accepts a six-digit recovery code", () => {
    expect(parsePasswordRecoveryCredential(" 123456 ")).toEqual({ kind: "otp", token: "123456" });
  });

  it("extracts the token hash from Supabase's standard recovery link", () => {
    const link = "https://project.supabase.co/auth/v1/verify?token=recovery-hash&amp;type=recovery&amp;redirect_to=http%3A%2F%2Finvalid-host";

    expect(parsePasswordRecoveryCredential(link)).toEqual({
      kind: "token-hash",
      tokenHash: "recovery-hash",
    });
  });

  it("unwraps recovery links protected by an email provider", () => {
    const recoveryLink = "https://project.supabase.co/auth/v1/verify?token_hash=nested-hash&type=recovery";
    const protectedLink = `https://email.example/safe?url=${encodeURIComponent(recoveryLink)}`;

    expect(parsePasswordRecoveryCredential(protectedLink)).toEqual({
      kind: "token-hash",
      tokenHash: "nested-hash",
    });
  });

  it("rejects links for a different authentication action", () => {
    expect(() => parsePasswordRecoveryCredential(
      "https://project.supabase.co/auth/v1/verify?token=signup-hash&type=signup",
    )).toThrow("enlace completo de recuperación");
  });

  it("verifies a pasted link as a recovery token hash", async () => {
    const auth = authWithSuccessfulVerification();

    await expect(verifyPasswordRecovery(
      auth,
      "user@example.com",
      "https://project.supabase.co/auth/v1/verify?token=link-hash&type=recovery",
    )).resolves.toBe(user);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "link-hash", type: "recovery" });
  });

  it("verifies a recovery code with the account email", async () => {
    const auth = authWithSuccessfulVerification();

    await verifyPasswordRecovery(auth, "user@example.com", "654321");

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "654321",
      type: "recovery",
    });
  });

  it("updates the password only through the authenticated recovery session", async () => {
    const auth = authWithSuccessfulVerification();

    await expect(updateRecoveredPassword(auth, "new-secure-password")).resolves.toBe(user);
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-secure-password" });
  });
});
