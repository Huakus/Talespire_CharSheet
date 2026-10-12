export interface InvitationBackend {
  authenticate(token: string): Promise<string | null>;
  reserve(userId: string, email: string): Promise<{ invitationId: string; authorizationToken: string; email: string }>;
  invite(email: string, data: Record<string, string>): Promise<string>;
  finish(invitationId: string, userId: string | null, failureCode: string | null): Promise<void>;
}

export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function errorResponse(error: unknown): { status: number; message: string } {
  const code = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  if (code.includes('APP_INVITER_REQUIRED')) return { status: 403, message: 'Tu cuenta no tiene permiso para invitar a la aplicación.' };
  if (code.includes('APP_USER_ALREADY_EXISTS')) return { status: 409, message: 'Esa cuenta ya existe. Podés agregarla a una campaña por separado.' };
  if (/APP_INVITATION_(RATE_LIMIT|COOLDOWN|IN_PROGRESS)/.test(code)) return { status: 429, message: 'Esperá antes de enviar otra invitación. Máximo: 10 por hora y 30 por día.' };
  return { status: 502, message: 'No se pudo completar el envío. Esperá un minuto y volvé a intentar; si recibiste el correo, usalo.' };
}

export function createInvitationHandler(backend: InvitationBackend, corsHeaders: Record<string, string>) {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), { status, headers });
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers });
    if (request.method !== 'POST') return json(405, { error: 'Método no permitido.' });
    const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1]?.trim();
    if (!token) return json(401, { error: 'Tenés que iniciar sesión.' });
    try {
      const userId = await backend.authenticate(token);
      if (!userId) return json(401, { error: 'La sesión no es válida o venció.' });
      let body: unknown;
      try { body = await request.json(); } catch { return json(400, { error: 'El pedido no contiene JSON válido.' }); }
      const email = normalizeInvitationEmail(typeof body === 'object' && body !== null && 'email' in body ? body.email : null);
      if (!email) return json(400, { error: 'El email no es válido.' });
      const reservation = await backend.reserve(userId, email);
      let invitedUserId: string;
      try {
        invitedUserId = await backend.invite(reservation.email, {
          _app_invitation_id: reservation.invitationId,
          _app_invitation_token: reservation.authorizationToken,
        });
      } catch (error) {
        await backend.finish(reservation.invitationId, null, 'AUTH_INVITE_FAILED').catch(() => undefined);
        throw error;
      }
      await backend.finish(reservation.invitationId, invitedUserId, null);
      return json(200, { invitationId: reservation.invitationId, email: reservation.email });
    } catch (error) {
      const failure = errorResponse(error);
      return json(failure.status, { error: failure.message });
    }
  };
}
