export type AppConnectionState = "pending" | "ok" | "warning" | "error" | "disabled";

export interface AppConnectionStatus {
  state: AppConnectionState;
  label: string;
}

type ConnectionKind = "backend" | "persistence";

const statuses: Record<ConnectionKind, AppConnectionStatus> = {
  backend: { state: "pending", label: "Comprobando servidor externo…" },
  persistence: { state: "pending", label: "Preparando persistencia…" },
};
const listeners = new Set<() => void>();
let persistencePanelOpener: (() => void) | null = null;

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function setAppConnectionStatus(kind: ConnectionKind, status: AppConnectionStatus): void {
  statuses[kind] = status;
  listeners.forEach((listener) => listener());
}

export function subscribeAppConnectionStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function renderAppConnectionIndicators(): string {
  const icons: Record<ConnectionKind, string> = {
    backend: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="6" rx="1.5"></rect><rect x="4" y="14" width="16" height="6" rx="1.5"></rect><path d="M8 7h.01M8 17h.01M12 7h5M12 17h5"></path></svg>',
    persistence: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.8 4.6 4.6 0 0 0 7 18Z"></path></svg>',
  };
  const indicator = (kind: ConnectionKind): string => {
    const status = statuses[kind];
    const label = escapeAttribute(status.label);
    return `<button type="button" class="connection-indicator has-tooltip" data-connection-kind="${kind}" data-state="${status.state}" data-tooltip="${label}" aria-label="${label}">${icons[kind]}<i class="connection-state-dot" aria-hidden="true"></i></button>`;
  };
  return `<span class="connection-indicators" aria-label="Estado de conexiones">${indicator("backend")}${indicator("persistence")}</span>`;
}

export function registerPersistencePanelOpener(opener: () => void): () => void {
  persistencePanelOpener = opener;
  listeners.forEach((listener) => listener());
  return () => { if (persistencePanelOpener === opener) persistencePanelOpener = null; };
}

export function canOpenPersistencePanel(): boolean {
  return persistencePanelOpener !== null;
}

export function openPersistencePanel(): void {
  persistencePanelOpener?.();
}
