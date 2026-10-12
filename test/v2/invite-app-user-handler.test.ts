import { describe, expect, it, vi } from 'vitest';
import { createInvitationHandler, type InvitationBackend } from '../../supabase/functions/invite-app-user/handler';

const userId = 'verified-user';
const reservation = { invitationId: 'invitation-id', authorizationToken: 'private-proof', email: 'friend@example.com' };
function backend(): InvitationBackend {
  return { authenticate: vi.fn(async () => userId), reserve: vi.fn(async () => reservation),
    invite: vi.fn(async () => 'new-user'), finish: vi.fn(async () => undefined) };
}
function request(body: unknown = { email: ' Friend@Example.com ', inviterId: 'spoofed-user' }, token = 'session-token') {
  return new Request('https://example.com/invite', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
}
describe('invite app user server', () => {
  it('rejects missing/invalid authentication before reserving or sending', async () => {
    const api = backend();
    const handler = createInvitationHandler(api, {});
    expect((await handler(request({}, ''))).status).toBe(401);
    vi.mocked(api.authenticate).mockResolvedValueOnce(null);
    expect((await handler(request())).status).toBe(401);
    expect(api.reserve).not.toHaveBeenCalled();
    expect(api.invite).not.toHaveBeenCalled();
  });
  it('uses the verified user ID and never returns the authorization proof', async () => {
    const api = backend();
    const response = await createInvitationHandler(api, {})(request());
    expect(response.status).toBe(200);
    expect(api.reserve).toHaveBeenCalledWith(userId, 'friend@example.com');
    expect(api.invite).toHaveBeenCalledWith(reservation.email, { _app_invitation_id: reservation.invitationId, _app_invitation_token: reservation.authorizationToken });
    expect(api.finish).toHaveBeenCalledWith(reservation.invitationId, 'new-user', null);
    expect(await response.json()).toEqual({ invitationId: reservation.invitationId, email: reservation.email });
  });
  it.each([['APP_INVITER_REQUIRED', 403], ['APP_INVITATION_RATE_LIMIT', 429], ['APP_INVITATION_COOLDOWN', 429], ['APP_INVITATION_IN_PROGRESS', 429], ['APP_USER_ALREADY_EXISTS', 409]])('rejects %s before email is sent', async (message, status) => {
    const api = backend();
    vi.mocked(api.reserve).mockRejectedValueOnce({ message });
    expect((await createInvitationHandler(api, {})(request())).status).toBe(status);
    expect(api.invite).not.toHaveBeenCalled();
  });
  it.each([null, [], { email: 123 }, { email: 'no-email' }, { email: 'x'.repeat(255) + '@example.com' }])('rejects invalid email payloads', async (body) => {
    const api = backend();
    expect((await createInvitationHandler(api, {})(request(body))).status).toBe(400);
    expect(api.reserve).not.toHaveBeenCalled();
  });
  it('records failed sends and keeps provider details private', async () => {
    const api = backend();
    vi.mocked(api.invite).mockRejectedValueOnce(new Error('secret SMTP provider details'));
    const response = await createInvitationHandler(api, {})(request());
    expect(response.status).toBe(502);
    expect(api.finish).toHaveBeenCalledWith(reservation.invitationId, null, 'AUTH_INVITE_FAILED');
    expect(await response.text()).not.toContain('secret SMTP');
  });
  it('does not falsely report success or mark the invite failed after Auth committed', async () => {
    const api = backend();
    vi.mocked(api.finish).mockRejectedValueOnce(new Error('database unavailable'));
    expect((await createInvitationHandler(api, {})(request())).status).toBe(502);
    expect(api.invite).toHaveBeenCalledOnce();
    expect(api.finish).toHaveBeenCalledTimes(1);
  });
  it('handles CORS and disallows other methods without invoking Auth', async () => {
    const api = backend();
    const handler = createInvitationHandler(api, { 'Access-Control-Allow-Origin': '*' });
    const response = await handler(new Request('https://example.com', { method: 'OPTIONS' }));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((await handler(new Request('https://example.com'))).status).toBe(405);
    expect(api.authenticate).not.toHaveBeenCalled();
  });
});
