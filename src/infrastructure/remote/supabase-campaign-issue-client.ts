import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { APP_BUILD } from '../../build-info';
import type { RemoteCampaignContentEntry } from './supabase-campaign-document-client';

export interface IssueUiContext {
  view: Record<string, unknown>;
  selectedCharacterId: string | null;
  character: unknown;
  campaignChecksum: string | null;
  campaignRevision: number | null;
  loadedCampaign: unknown;
  pendingForms: unknown;
  notifications: unknown[];
  actions: unknown[];
  connection: unknown;
}
export interface PreparedIssueContext extends IssueUiContext {
  schemaVersion: 1;
  capturedAt: string;
  build: typeof APP_BUILD;
  loadedCatalog: RemoteCampaignContentEntry[] | null;
  environment: { userAgent: string; language: string; assets?: Array<{ kind: string; name: string }>; viewport: { width: number; height: number; devicePixelRatio: number } };
}
export interface IssueCaptureReceipt { contextId: string; capturedAt: string }
export interface IssueReportReceipt { reportId: string; createdAt: string; capturedAt: string }
export interface CampaignIssueReporter {
  readonly campaignName: string;
  prepare(context: IssueUiContext): PreparedIssueContext;
  capture(context: PreparedIssueContext, requestId: string): Promise<IssueCaptureReceipt>;
  submit(contextId: string, description: string): Promise<IssueReportReceipt>;
}

const CaptureReceiptSchema = z.object({ contextId: z.string().uuid(), capturedAt: z.string().min(1) });
const ReportReceiptSchema = z.object({ reportId: z.string().uuid(), createdAt: z.string().min(1), capturedAt: z.string().min(1) });
const messages: [string, string][] = [
  ['AUTHENTICATION_REQUIRED', 'Iniciá sesión para enviar el reporte.'],
  ['CAMPAIGN_ACCESS_DENIED', 'Tu cuenta ya no tiene acceso a esta campaña.'],
  ['ISSUE_CONTEXT_ACCESS_DENIED', 'No se pudo acceder al contexto de este reporte.'],
  ['ISSUE_CAPTURE_RATE_LIMIT', 'Alcanzaste el límite de reportes. Esperá un rato y volvé a intentar.'],
  ['ISSUE_CONTEXT_EXPIRED', 'Este contexto venció. Cerrá el formulario y abrí un reporte nuevo.'],
  ['INVALID_ISSUE_DESCRIPTION', 'La descripción debe tener entre 10 y 8.000 caracteres.'],
  ['ISSUE_CONTEXT_TOO_LARGE', 'El contexto es demasiado grande para guardarlo.'],
];
function throwReportError(error: { message: string }): never {
  throw new Error(messages.find(([code]) => error.message.includes(code))?.[1]
    ?? 'No se pudo guardar el reporte. Revisá la conexión y reintentá; tu descripción se conserva.');
}

export class SupabaseCampaignIssueClient implements CampaignIssueReporter {
  constructor(
    private readonly client: Pick<SupabaseClient, 'rpc'>,
    private readonly campaignId: string,
    readonly campaignName: string,
    private readonly getLoadedCatalog: () => RemoteCampaignContentEntry[] | null,
  ) {}

  prepare(context: IssueUiContext): PreparedIssueContext {
    return structuredClone({ ...context, schemaVersion: 1 as const, capturedAt: new Date().toISOString(),
      build: APP_BUILD, loadedCatalog: this.getLoadedCatalog(), environment: {
        userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
        language: typeof navigator === 'undefined' ? '' : navigator.language,
        assets: typeof document === 'undefined' ? [] : [...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map((element) => {
          const kind = element.tagName === 'SCRIPT' ? 'script' : 'stylesheet';
          const path = element.getAttribute(kind === 'script' ? 'src' : 'href') ?? '';
          let name = '';
          try { name = new URL(path, document.baseURI).pathname.split('/').pop() ?? ''; } catch { /* Ignore unsupported URLs. */ }
          return { kind, name };
        }),
        viewport: { width: typeof window === 'undefined' ? 0 : window.innerWidth,
          height: typeof window === 'undefined' ? 0 : window.innerHeight,
          devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio },
      } });
  }

  private async call(functionName: string, parameters: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try { return await this.client.rpc(functionName, parameters).abortSignal(controller.signal); }
    finally { clearTimeout(timeout); }
  }

  async capture(context: PreparedIssueContext, requestId: string): Promise<IssueCaptureReceipt> {
    const result = await this.call('capture_campaign_issue_context', {
      p_campaign_id: this.campaignId, p_request_id: requestId, p_client_context: context,
    });
    if (result.error) throwReportError(result.error);
    return CaptureReceiptSchema.parse(result.data);
  }

  async submit(contextId: string, description: string): Promise<IssueReportReceipt> {
    const normalized = description.trim();
    if (normalized.length < 10 || normalized.length > 8000) throwReportError({ message: 'INVALID_ISSUE_DESCRIPTION' });
    const result = await this.call('submit_campaign_issue_report', { p_context_id: contextId, p_description: normalized });
    if (result.error) throwReportError(result.error);
    return ReportReceiptSchema.parse(result.data);
  }
}
