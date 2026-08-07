import {
  loadRemoteBackendConfig,
  type RemoteBackendConfig,
} from "../infrastructure/remote/backend-config";
import {
  SupabaseBackendClient,
  type BackendHealth,
} from "../infrastructure/remote/supabase-backend-client";
import { setAppConnectionStatus } from "./app-chrome";

export type BackendStatus =
  | { state: "disabled" }
  | { state: "checking"; url: string }
  | { state: "connected"; url: string; health: BackendHealth }
  | { state: "error"; message: string };

export function formatBackendStatus(status: BackendStatus): string {
  switch (status.state) {
    case "disabled":
      return "Persistencia actual · servidor externo no configurado";
    case "checking":
      return `Comprobando servidor externo ${status.url}…`;
    case "connected":
      return `Servidor externo conectado · esquema ${status.health.schemaVersion} · ${status.health.latencyMs} ms`;
    case "error":
      return `Servidor externo no disponible · ${status.message}`;
  }
}

function renderStatus(status: BackendStatus): void {
  const state = status.state === "connected" ? "ok"
    : status.state === "error" ? "error"
      : status.state === "disabled" ? "disabled" : "pending";
  setAppConnectionStatus("backend", { state, label: formatBackendStatus(status) });
}

export async function mountBackendStatus(
  appRoot: HTMLElement,
  configLoader: () => RemoteBackendConfig | null = loadRemoteBackendConfig,
  clientFactory: (config: RemoteBackendConfig) => SupabaseBackendClient = SupabaseBackendClient.fromConfig,
): Promise<void> {
  void appRoot;

  let config: RemoteBackendConfig | null;
  try {
    config = configLoader();
  } catch (error) {
    renderStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (config === null) {
    renderStatus({ state: "disabled" });
    return;
  }

  renderStatus({ state: "checking", url: config.url });
  try {
    const health = await clientFactory(config).checkHealth();
    renderStatus({ state: "connected", url: config.url, health });
  } catch (error) {
    renderStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
