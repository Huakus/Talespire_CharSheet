import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseCampaignIssueClient, type IssueUiContext } from '../../src/infrastructure/remote/supabase-campaign-issue-client';
import type { RemoteCampaignContentEntry } from '../../src/infrastructure/remote/supabase-campaign-document-client';
import { renderIssueReportButton } from '../../src/ui/issue-report-dialog';

const campaignId = '00000000-0000-4000-8000-000000000001';
const contextId = '00000000-0000-4000-8000-000000000002';
const reportId = '00000000-0000-4000-8000-000000000003';
const timestamp = '2026-10-11T23:00:00.000Z';
function uiContext(): IssueUiContext {
  return { view: { mode: 'player', screen: 'inventory' }, selectedCharacterId: 'hero', character: { name: 'Hero', hp: 10 },
    loadedCampaign: { characters: { hero: { hp: 10 } } }, campaignRevision: 12, campaignChecksum: 'original',
    pendingForms: [{ name: 'hp', value: '9' }], actions: [], notifications: [{ text: 'Error al guardar' }], connection: { state: 'error' } };
}
function client(rpc: unknown = vi.fn(async () => ({ data: { contextId, capturedAt: timestamp }, error: null })), catalog: RemoteCampaignContentEntry[] | null = null) {
  const transport = { rpc: (...args: unknown[]) => ({ abortSignal: () => (rpc as (...parameters: unknown[]) => unknown)(...args) }) };
  return new SupabaseCampaignIssueClient(transport as unknown as Pick<SupabaseClient, 'rpc'>, campaignId, 'ECE', () => catalog);
}

describe('campaign issue context', () => {
  it('freezes the loaded state instead of refreshing it before reporting', () => {
    const context = uiContext();
    const catalog = [{ campaignId, kind: 'spell', contentKey: 'spell', name: 'Spell', origin: 'official', tags: ['es'], payload: { damage: '1d6' }, revision: 2, updatedAt: timestamp }] as RemoteCampaignContentEntry[];
    const prepared = client(undefined, catalog).prepare(context);
    (context.character as { hp: number }).hp = 1;
    catalog[0]!.payload.damage = '2d6';
    expect(prepared.character).toEqual({ name: 'Hero', hp: 10 });
    expect(prepared.loadedCatalog![0]!.payload.damage).toBe('1d6');
    expect(prepared).toMatchObject({ schemaVersion: 1, campaignRevision: 12, campaignChecksum: 'original' });
    expect(prepared.build).toHaveProperty('sourceHash');
    expect(prepared).not.toHaveProperty('lore');
    expect(prepared).not.toHaveProperty('attachments');
    expect(prepared).not.toHaveProperty('session');
  });
  it('marks an unloaded catalog explicitly instead of inventing client state', () => {
    expect(client().prepare(uiContext()).loadedCatalog).toBeNull();
  });
  it('scopes capture to the bound remote campaign and preserves the retry identifier', async () => {
    const rpc = vi.fn(async () => ({ data: { contextId, capturedAt: timestamp }, error: null }));
    const reporter = client(rpc);
    const prepared = reporter.prepare(uiContext());
    await reporter.capture(prepared, contextId);
    await reporter.capture(prepared, contextId);
    expect(rpc).toHaveBeenNthCalledWith(1, 'capture_campaign_issue_context', { p_campaign_id: campaignId, p_request_id: contextId, p_client_context: prepared });
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0]);
  });
  it('submits only description and the reference to the already frozen capture', async () => {
    const rpc = vi.fn(async () => ({ data: { reportId, createdAt: timestamp, capturedAt: timestamp }, error: null }));
    expect(await client(rpc).submit(contextId, '  El inventario no se actualiza.  ')).toMatchObject({ reportId });
    expect(rpc).toHaveBeenCalledWith('submit_campaign_issue_report', { p_context_id: contextId, p_description: 'El inventario no se actualiza.' });
  });
  it.each(['', '          ', 'short', 'x'.repeat(8001)])('rejects an invalid description before RPC', async (description) => {
    const rpc = vi.fn();
    await expect(client(rpc).submit(contextId, description)).rejects.toThrow('10 y 8.000');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('reports permission and rate failures without false success', async () => {
    for (const [code, message] of [['CAMPAIGN_ACCESS_DENIED', 'acceso'], ['ISSUE_CAPTURE_RATE_LIMIT', 'límite']]) {
      const rpc = vi.fn(async () => ({ data: null, error: { message: code } }));
      const reporter = client(rpc);
      await expect(reporter.capture(reporter.prepare(uiContext()), contextId)).rejects.toThrow(message);
    }
  });
  it('renders a small accessible bug icon and disables it without a connected campaign', () => {
    expect(renderIssueReportButton(true)).toContain('data-report-issue');
    expect(renderIssueReportButton(true)).toContain('<svg');
    expect(renderIssueReportButton(true)).toContain('aria-label="Reportar un bug');
    expect(renderIssueReportButton(true)).not.toContain(' disabled');
    expect(renderIssueReportButton(false)).toContain('disabled');
  });
});
