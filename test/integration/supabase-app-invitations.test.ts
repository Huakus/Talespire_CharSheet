import { describe, expect, it } from 'vitest';
import { resolveRemoteBackendConfig } from '../../src/infrastructure/remote/backend-config';
import { createRemoteSupabaseClient } from '../../src/infrastructure/remote/supabase-campaign-document-client';

const config = resolveRemoteBackendConfig(import.meta.env);

describe.skipIf(config === null)('Supabase invitation gate', () => {
  it('boots the deployed handler and responds to browser preflight', async () => {
    if (!config) throw new Error('Missing backend');
    const response = await fetch(`${config.url}/functions/v1/invite-app-user`, {
      method: 'OPTIONS', headers: { apikey: config.publishableKey, Origin: 'http://127.0.0.1', 'Access-Control-Request-Method': 'POST' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  }, 15_000);

  it('rejects direct signUp without an invitation before creating a user', async () => {
    if (!config) throw new Error('Missing backend');
    const client = createRemoteSupabaseClient(config);
    const result = await client.auth.signUp({
      email: `codex-uninvited-${crypto.randomUUID()}@example.invalid`,
      password: `Integration-${crypto.randomUUID()}!`,
      // User-editable flags cannot grant invitation authority.
      options: { data: { can_invite: true, role: 'admin' } },
    });
    expect(result.error).not.toBeNull();
    expect(result.data.user).toBeNull();
    expect(result.data.session).toBeNull();
    // Auth can mask a database-trigger rejection as a generic 500 without a code.
    expect([400, 403, 500]).toContain(result.error?.status);
    if (result.error?.code) expect(['unexpected_failure', 'signup_disabled']).toContain(result.error.code);
  }, 15_000);

  it('rejects unauthenticated requests to the deployed invitation function', async () => {
    if (!config) throw new Error('Missing backend');
    const result = await createRemoteSupabaseClient(config).functions.invoke('invite-app-user', {
      body: { email: 'codex-uninvited@example.invalid' },
    });
    expect(result.error).not.toBeNull();
    const context = (result.error as { context?: Response }).context;
    expect(context?.status).toBe(401);
  }, 15_000);

  it('does not expose invitation reservation to the anonymous Data API', async () => {
    if (!config) throw new Error('Missing backend');
    const result = await createRemoteSupabaseClient(config).rpc('reserve_app_invitation', {
      p_inviter_id: crypto.randomUUID(), p_email: 'codex-uninvited@example.invalid',
    });
    expect(result.error?.code).toBe('42501');
    expect(result.data).toBeNull();
  }, 15_000);
});
