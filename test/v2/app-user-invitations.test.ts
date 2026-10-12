import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { canInviteAppUsers, inviteAppUser, verifyAppInvitation } from '../../src/ui/app-user-invitations';
import { parseEmailAuthCredential } from '../../src/ui/password-recovery';

type Client = Parameters<typeof inviteAppUser>[0];
type Auth = Parameters<typeof verifyAppInvitation>[0];
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'friend@example.com' } as User;
const invitationId = '00000000-0000-4000-8000-000000000002';
function auth() {
  return { verifyOtp: vi.fn(async () => ({ data: { user, session: { user } }, error: null })),
    updateUser: vi.fn(), signOut: vi.fn(async () => ({ error: null })) } as unknown as Auth;
}

describe('app account invitations', () => {
  it('uses only the current user when checking invitation permission', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await canInviteAppUsers({ rpc } as unknown as Client)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('can_invite_app_users');
  });
  it('sends only the email to the protected function', async () => {
    const invoke = vi.fn(async () => ({ data: { invitationId, email: user.email }, error: null }));
    await inviteAppUser({ functions: { invoke } } as unknown as Client, ' Friend@Example.com ');
    expect(invoke).toHaveBeenCalledWith('invite-app-user', { body: { email: 'friend@example.com' } });
  });
  it('shows a server permission rejection instead of reporting success', async () => {
    const invoke = vi.fn(async () => ({ data: null, error: { context: new Response(JSON.stringify({ error: 'Sin permiso para invitar.' }), { status: 403 }) } }));
    await expect(inviteAppUser({ functions: { invoke } } as unknown as Client, 'friend@example.com')).rejects.toThrow('Sin permiso');
  });
  it('accepts wrapped invitation links and rejects recovery/signup links', () => {
    const url = 'https://project.supabase.co/auth/v1/verify?token=secret&type=invite';
    expect(parseEmailAuthCredential(`https://mail.example/safe?url=${encodeURIComponent(url)}`, 'invite'))
      .toEqual({ kind: 'token-hash', tokenHash: 'secret' });
    for (const type of ['signup', 'recovery']) {
      expect(() => parseEmailAuthCredential(url.replace('type=invite', `type=${type}`), 'invite')).toThrow('invitación');
    }
  });
  it('verifies tokens with the invite action', async () => {
    const client = auth();
    await expect(verifyAppInvitation(client, ' Friend@Example.com ', 'https://project.supabase.co/auth/v1/verify?token=hash&amp;type=invite')).resolves.toBe(user);
    expect(client.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash', type: 'invite' });
  });
  it('verifies an invite OTP against the normalized email', async () => {
    const client = auth();
    await verifyAppInvitation(client, ' Friend@Example.com ', '123456');
    expect(client.verifyOtp).toHaveBeenCalledWith({ email: 'friend@example.com', token: '123456', type: 'invite' });
  });
  it('clears the session when the link belongs to another email', async () => {
    const client = auth();
    await expect(verifyAppInvitation(client, 'other@example.com', '123456')).rejects.toThrow('otro email');
    expect(client.signOut).toHaveBeenCalledOnce();
    expect(client.updateUser).not.toHaveBeenCalled();
  });
  it('requires a verified session before password setup', async () => {
    const client = auth();
    vi.mocked(client.verifyOtp).mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    await expect(verifyAppInvitation(client, user.email!, '123456')).rejects.toThrow('sesión de invitación');
    expect(client.updateUser).not.toHaveBeenCalled();
  });
});
