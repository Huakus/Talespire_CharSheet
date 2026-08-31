import { createClient, type User } from "npm:@supabase/supabase-js@2.112.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.112.0/cors";

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function serverSecret(): string {
  const bundledSecrets = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (bundledSecrets) {
    try {
      const parsed = JSON.parse(bundledSecrets) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default) return parsed.default;
    } catch {
      // Projects using legacy keys do not expose this JSON bundle.
    }
  }
  return requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function normalizeCampaignId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function secureCharacter(alphabet: string): string {
  return alphabet[secureIndex(alphabet.length)] ?? alphabet[0] ?? "x";
}

function secureIndex(maxExclusive: number): number {
  const limit = 256 - (256 % maxExclusive);
  const random = new Uint8Array(1);
  do crypto.getRandomValues(random); while ((random[0] ?? 255) >= limit);
  return (random[0] ?? 0) % maxExclusive;
}

function temporaryPassword(): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%_-";
  const alphabet = lower + upper + digits + symbols;
  const characters = [
    secureCharacter(lower),
    secureCharacter(upper),
    secureCharacter(digits),
    secureCharacter(symbols),
    ...Array.from({ length: 20 }, () => secureCharacter(alphabet)),
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapWith = secureIndex(index + 1);
    [characters[index], characters[swapWith]] = [characters[swapWith] ?? "x", characters[index] ?? "x"];
  }
  return characters.join("");
}

async function findUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<User | null> {
  const pageSize = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: pageSize });
    if (result.error) throw result.error;
    const user = result.data.users.find((candidate) => candidate.email?.trim().toLocaleLowerCase() === email);
    if (user) return user;
    if (result.data.users.length < pageSize) return null;
  }
  throw new Error("User lookup exceeded the supported page limit");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Metodo no permitido." });

  try {
    const token = bearerToken(request);
    if (!token) return json(401, { error: "Tenes que iniciar sesion." });

    const admin = createClient(requiredEnvironment("SUPABASE_URL"), serverSecret(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authentication = await admin.auth.getUser(token);
    if (authentication.error || !authentication.data.user) {
      return json(401, { error: "La sesion no es valida o vencio." });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return json(400, { error: "El pedido no contiene JSON valido." });
    }
    const campaignId = normalizeCampaignId(body.campaignId);
    const email = normalizeEmail(body.email);
    if (!campaignId || !email) return json(400, { error: "La campana o el email no son validos." });

    const ownership = await admin.from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("owner_user_id", authentication.data.user.id)
      .maybeSingle();
    if (ownership.error) throw ownership.error;
    if (!ownership.data) {
      return json(403, { error: "Solo el dueno de la campana puede generar una clave provisoria." });
    }

    const target = await findUserByEmail(admin, email);
    if (!target || target.id === authentication.data.user.id) {
      return json(404, { error: "No se encontro a ese integrante en la campana." });
    }
    const membership = await admin.from("campaign_members")
      .select("user_id")
      .eq("campaign_id", campaignId)
      .eq("user_id", target.id)
      .maybeSingle();
    if (membership.error) throw membership.error;
    if (!membership.data) {
      return json(404, { error: "No se encontro a ese integrante en la campana." });
    }

    const password = temporaryPassword();
    const update = await admin.auth.admin.updateUserById(target.id, { password });
    if (update.error) throw update.error;
    return json(200, { temporaryPassword: password });
  } catch (error) {
    const reference = crypto.randomUUID();
    console.error("RESET_CAMPAIGN_MEMBER_PASSWORD_FAILED", reference, error instanceof Error ? error.message : "unknown");
    return json(500, { error: `No se pudo generar la clave provisoria. Referencia: ${reference}` });
  }
});
