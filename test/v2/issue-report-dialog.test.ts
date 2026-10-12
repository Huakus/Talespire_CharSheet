// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CampaignIssueReporter, IssueUiContext, PreparedIssueContext } from '../../src/infrastructure/remote/supabase-campaign-issue-client';
import { captureIssueFormState, openIssueReportDialog } from '../../src/ui/issue-report-dialog';

const contextId = '00000000-0000-4000-8000-000000000002';
const reportId = '00000000-0000-4000-8000-000000000003';
const capturedAt = '2026-10-11T23:00:00.000Z';
function context(): IssueUiContext {
  return { view: { mode: 'player', screen: 'inventory' }, selectedCharacterId: 'hero', character: { hp: 10 },
    loadedCampaign: { characters: { hero: { hp: 10 } } }, campaignChecksum: 'original', campaignRevision: 3,
    pendingForms: [], notifications: [], actions: [], connection: {} };
}
function reporter(): CampaignIssueReporter {
  return { campaignName: 'ECE', prepare: vi.fn((ui) => structuredClone({ ...ui, schemaVersion: 1, capturedAt,
    build: { version: 'test', sourceHash: null, builtAt: null }, loadedCatalog: null,
    environment: { userAgent: '', language: 'es', viewport: { width: 800, height: 600, devicePixelRatio: 1 } } }) as PreparedIssueContext),
  capture: vi.fn(async () => ({ contextId, capturedAt })),
  submit: vi.fn(async () => ({ reportId, capturedAt, createdAt: capturedAt })) };
}
const dialog = () => document.querySelector<HTMLDialogElement>('.issue-report-dialog')!;
const description = () => dialog().querySelector<HTMLTextAreaElement>('textarea')!;
const send = () => dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!;
afterEach(async () => {
  const active = document.querySelector<HTMLDialogElement>('dialog');
  active?.close();
  await new Promise((resolve) => setTimeout(resolve, 0));
  document.body.innerHTML = '';
});

describe('issue report user flow', () => {
  it('has only a description input, without attachments, images or extra fields', async () => {
    openIssueReportDialog(reporter(), context());
    await vi.waitFor(() => expect(send().disabled).toBe(false));
    expect(dialog().querySelectorAll('input,select,textarea')).toHaveLength(1);
    expect(description().name).toBe('description');
    expect(description().maxLength).toBe(8000);
    expect(dialog().querySelector('input[type="file"]')).toBeNull();
    expect(dialog().querySelector('img')).toBeNull();
    expect(dialog().textContent).toContain('Contexto de ECE guardado');
  });
  it('cannot submit before automatic context has been stored', async () => {
    const service = reporter();
    let resolveCapture!: (value: { contextId: string; capturedAt: string }) => void;
    vi.mocked(service.capture).mockReturnValueOnce(new Promise((resolve) => { resolveCapture = resolve; }));
    openIssueReportDialog(service, context());
    description().value = 'El inventario no se actualiza.';
    dialog().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(send().disabled).toBe(true);
    expect(service.submit).not.toHaveBeenCalled();
    resolveCapture({ contextId, capturedAt });
    await vi.waitFor(() => expect(send().disabled).toBe(false));
  });
  it('retries failed capture using the original frozen client state and request ID', async () => {
    const service = reporter();
    vi.mocked(service.capture).mockRejectedValueOnce(new Error('Servidor sin conexión.'));
    const ui = context();
    openIssueReportDialog(service, ui);
    description().value = 'El inventario no se actualiza.';
    (ui.character as { hp: number }).hp = 1;
    const retry = dialog().querySelector<HTMLButtonElement>('[data-retry-context]')!;
    await vi.waitFor(() => expect(retry.hidden).toBe(false));
    retry.click();
    await vi.waitFor(() => expect(send().disabled).toBe(false));
    const calls = vi.mocked(service.capture).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[0]![0].character).toEqual({ hp: 10 });
    expect(service.prepare).toHaveBeenCalledOnce();
    expect(description().value).toBe('El inventario no se actualiza.');
  });
  it('preserves description and context after a failed send, then returns a reference', async () => {
    const service = reporter();
    vi.mocked(service.submit).mockRejectedValueOnce(new Error('No se pudo enviar.'));
    openIssueReportDialog(service, context());
    await vi.waitFor(() => expect(send().disabled).toBe(false));
    description().value = 'Quiero filtrar el inventario por peso.';
    send().click();
    await vi.waitFor(() => expect(dialog().textContent).toContain('No se pudo enviar.'));
    expect(description().value).toBe('Quiero filtrar el inventario por peso.');
    expect(description().readOnly).toBe(false);
    send().click();
    await vi.waitFor(() => expect(dialog().textContent).toContain(reportId));
    expect(service.capture).toHaveBeenCalledOnce();
    expect(vi.mocked(service.submit).mock.calls).toEqual([
      [contextId, 'Quiero filtrar el inventario por peso.'], [contextId, 'Quiero filtrar el inventario por peso.'],
    ]);
    expect(send().hidden).toBe(true);
  });
  it('prevents duplicate submissions while sending and prevents a second active dialog', async () => {
    const service = reporter();
    openIssueReportDialog(service, context());
    openIssueReportDialog(service, context());
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    await vi.waitFor(() => expect(send().disabled).toBe(false));
    description().value = 'El inventario no se actualiza.';
    const form = dialog().querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(dialog().textContent).toContain(reportId));
    expect(service.submit).toHaveBeenCalledOnce();
  });
  it('can close a failed capture without submitting a report', async () => {
    const service = reporter();
    vi.mocked(service.capture).mockRejectedValueOnce(new Error('Sin conexión.'));
    openIssueReportDialog(service, context());
    await vi.waitFor(() => expect(dialog().textContent).toContain('Sin conexión.'));
    dialog().querySelector<HTMLButtonElement>('[data-close-issue]')!.click();
    await vi.waitFor(() => expect(document.querySelector('dialog')).toBeNull());
    expect(service.submit).not.toHaveBeenCalled();
  });
  it('captures unsaved form values while excluding files, passwords and tokens', () => {
    const root = document.createElement('div');
    root.innerHTML = `<input name="hp" value="9"><input name="password" type="password" value="secret">
      <input name="accessToken" value="secret"><input name="upload" type="file">
      <textarea name="portrait">data:image/png;base64,AA</textarea><input name="concentration" type="checkbox" checked>`;
    expect(captureIssueFormState(root)).toEqual([{ name: 'hp', value: '9' }, { name: 'concentration', value: 'on', checked: true }]);
  });
});
