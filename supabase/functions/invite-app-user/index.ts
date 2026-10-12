import { createClient } from 'npm:@supabase/supabase-js@2.112.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.112.0/cors';
import { createInvitationHandler } from './handler.ts';

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function serverSecret(): string {
  const bundled = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (bundled) {
    const keys = JSON.parse(bundled);
    if (typeof keys.default === 'string' && keys.default) return keys.default;
  }
  return requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
}

const admin = createClient(requiredEnvironment('SUPABASE_URL'), serverSecret(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(createInvitationHandler({
  async authenticate(token) {
    const result = await admin.auth.getUser(token);
    return result.error ? null : result.data.user?.id ?? null;
  },
  async reserve(userId, email) {
    const result = await admin.rpc('reserve_app_invitation', { p_inviter_id: userId, p_email: email });
    if (result.error) throw result.error;
    return result.data;
  },
  async invite(email, data) {
    const result = await admin.auth.admin.inviteUserByEmail(email, { data });
    if (result.error) throw result.error;
    if (!result.data.user) throw new Error('AUTH_INVITE_USER_MISSING');
    return result.data.user.id;
  },
  async finish(invitationId, userId, failureCode) {
    const result = await admin.rpc('finish_app_invitation', {
      p_invitation_id: invitationId, p_user_id: userId, p_failure_code: failureCode,
    });
    if (result.error) throw result.error;
  },
}, corsHeaders));
