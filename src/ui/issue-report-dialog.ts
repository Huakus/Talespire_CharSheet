import type { CampaignIssueReporter, IssueCaptureReceipt, IssueUiContext } from '../infrastructure/remote/supabase-campaign-issue-client';

export function renderIssueReportButton(enabled: boolean): string {
  const label = enabled ? 'Reportar un bug o pedir un cambio' : 'Conectá una campaña para reportar';
  return `<button type="button" class="issue-report-button has-tooltip" data-report-issue data-tooltip="${label}" title="${label}" aria-label="${label}" ${enabled ? '' : 'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 2 3m6-3-2 3M7 10H3m18 0h-4M7 14H3m18 0h-4M8 18l-3 3m11-3 3 3M12 10v10"></path><rect x="7" y="6" width="10" height="14" rx="5"></rect><path d="M8 10h8"></path></svg></button>`;
}

export function captureIssueFormState(root: HTMLElement): Array<{ name: string; value: string; checked?: boolean }> {
  const values: Array<{ name: string; value: string; checked?: boolean }> = [];
  for (const control of root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')) {
    const name = control.name || control.id;
    if (!name || /password|token|authorization|secret/i.test(name)
      || control.tagName === 'INPUT' && ['password', 'file'].includes((control as HTMLInputElement).type)) continue;
    if (/^(data:|blob:)/i.test(control.value)) continue;
    values.push({ name, value: control.value.slice(0, 8000),
      ...('checked' in control && ['checkbox', 'radio'].includes(control.type) ? { checked: control.checked } : {}) });
    if (values.length >= 300) break;
  }
  return values;
}

let activeReportDialog: HTMLDialogElement | null = null;

export function openIssueReportDialog(reporter: CampaignIssueReporter, context: IssueUiContext): void {
  if (activeReportDialog?.isConnected) { activeReportDialog.focus(); return; }
  // Freeze client context before focus changes or background updates alter the sheet.
  const prepared = reporter.prepare(context);
  const requestId = crypto.randomUUID();
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'issue-report-dialog';
  dialog.setAttribute('aria-labelledby', 'issue-report-title');
  dialog.innerHTML = `<form>
    <header><h2 id="issue-report-title">Reportar un problema o pedir un cambio</h2><button type="button" class="secondary-button" data-close-issue aria-label="Cerrar reporte">Cerrar</button></header>
    <label>Descripción<textarea name="description" rows="7" minlength="10" maxlength="8000" required placeholder="Contá qué pasó, qué esperabas y cómo repetirlo. Para un pedido de cambio, explicá qué te gustaría poder hacer."></textarea></label>
    <p class="issue-context-status" role="status" aria-live="polite"></p>
    <p class="issue-report-feedback" role="status" aria-live="polite"></p>
    <footer><button type="button" class="secondary-button" data-retry-context hidden>Reintentar contexto</button><button type="submit" disabled>Enviar reporte</button></footer>
  </form>`;
  const form = dialog.querySelector<HTMLFormElement>('form')!;
  const description = form.elements.namedItem('description') as HTMLTextAreaElement;
  const contextStatus = dialog.querySelector<HTMLElement>('.issue-context-status')!;
  const feedback = dialog.querySelector<HTMLElement>('.issue-report-feedback')!;
  const retry = dialog.querySelector<HTMLButtonElement>('[data-retry-context]')!;
  const submit = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const close = dialog.querySelector<HTMLButtonElement>('[data-close-issue]')!;
  let capture: IssueCaptureReceipt | null = null;
  let capturing = false;
  let sending = false;
  let sent = false;
  const closeDialog = () => { if (!sending) dialog.close(); };
  close.addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (activeReportDialog === dialog) activeReportDialog = null;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    else document.querySelector<HTMLButtonElement>('[data-report-issue]')?.focus();
  });
  const captureContext = async () => {
    if (capturing || capture || sent) return;
    capturing = true;
    retry.hidden = true;
    submit.disabled = true;
    contextStatus.textContent = `Guardando el contexto de ${reporter.campaignName} y los datos cargados en esta pantalla…`;
    try {
      const receipt = await reporter.capture(prepared, requestId);
      if (!dialog.isConnected) return;
      capture = receipt;
      contextStatus.textContent = `Contexto de ${reporter.campaignName} guardado al abrir este reporte. Se incluirá automáticamente con tu descripción.`;
      submit.disabled = false;
    } catch (error) {
      if (!dialog.isConnected) return;
      contextStatus.textContent = error instanceof Error ? error.message : 'No se pudo guardar el contexto. Reintentá.';
      retry.hidden = false;
    } finally { capturing = false; }
  };
  retry.addEventListener('click', () => void captureContext());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!capture || sending || sent || !form.reportValidity()) return;
    sending = true;
    close.disabled = true;
    submit.disabled = true;
    description.readOnly = true;
    feedback.textContent = 'Enviando reporte…';
    void reporter.submit(capture.contextId, description.value).then((receipt) => {
      if (!dialog.isConnected) return;
      sent = true;
      feedback.textContent = `Reporte recibido. Referencia: ${receipt.reportId}`;
      submit.hidden = true;
      close.textContent = 'Listo';
    }).catch((error: unknown) => {
      if (!dialog.isConnected) return;
      feedback.textContent = error instanceof Error ? error.message : 'No se pudo enviar. Tu descripción se conserva.';
      submit.disabled = false;
      description.readOnly = false;
    }).finally(() => { sending = false; close.disabled = false; });
  });
  activeReportDialog = dialog;
  document.body.append(dialog);
  dialog.showModal();
  description.focus();
  void captureContext();
}
