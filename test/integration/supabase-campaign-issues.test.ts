import { describe, expect, it } from 'vitest';
import { resolveRemoteBackendConfig } from '../../src/infrastructure/remote/backend-config';
import { createRemoteSupabaseClient } from '../../src/infrastructure/remote/supabase-campaign-document-client';

const config = resolveRemoteBackendConfig(import.meta.env);
describe.skipIf(config === null)('Supabase issue report permissions', () => {
  it.each([
    ['capture_campaign_issue_context', { p_campaign_id: crypto.randomUUID(), p_request_id: crypto.randomUUID(), p_client_context: {} }],
    ['submit_campaign_issue_report', { p_context_id: crypto.randomUUID(), p_description: 'Reporte sin sesión para comprobar permisos.' }],
    ['read_campaign_issue_report', { p_report_id: crypto.randomUUID() }],
  ])('denies unauthenticated %s requests without creating or exposing reports', async (name, parameters) => {
    if (!config) throw new Error('Missing backend');
    const result = await createRemoteSupabaseClient(config).rpc(name as string, parameters);
    expect(result.error?.code).toBe('42501');
    expect(result.data).toBeNull();
  }, 15_000);
});
