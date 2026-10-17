interface RemoteStartupRecovery {
  message: string;
  account?: string;
  campaign?: string;
  retry(): void;
  changeCampaign?: () => void;
  signOut?: () => Promise<void>;
}

/** Lives outside appRoot so the startup error handler cannot remove recovery actions. */
export function mountRemoteStartupFailure(appRoot: HTMLElement, recovery: RemoteStartupRecovery): HTMLElement {
  const panel = document.createElement("aside");
  panel.className = "remote-setup remote-startup-failure";
  panel.dataset.state = "unavailable";
  panel.innerHTML = `
    <h1>No se pudo abrir la campaña compartida</h1>
    <p>La edición está bloqueada para proteger la campaña. Podés reintentar o elegir otra campaña.</p>
    <p class="remote-failure-context"></p>
    <details open><summary>Detalle del error</summary><pre class="remote-failure-detail"></pre></details>
    <div class="remote-actions">
      <button type="button" data-startup-action="retry">Reintentar</button>
      <button type="button" class="secondary-button" data-startup-action="change">Cambiar campaña</button>
      <button type="button" class="secondary-button" data-startup-action="signout">Cerrar sesión</button>
    </div>
    <p class="remote-feedback" role="status"></p>`;
  panel.querySelector(".remote-failure-context")!.textContent = [
    recovery.account ? `Cuenta: ${recovery.account}` : "",
    recovery.campaign ? `Campaña: ${recovery.campaign}` : "",
  ].filter(Boolean).join(" · ");
  panel.querySelector(".remote-failure-detail")!.textContent = recovery.message;
  panel.querySelector('[data-startup-action="retry"]')!.addEventListener("click", recovery.retry);
  const change = panel.querySelector<HTMLButtonElement>('[data-startup-action="change"]')!;
  change.hidden = !recovery.changeCampaign;
  change.addEventListener("click", () => recovery.changeCampaign?.());
  const signOut = panel.querySelector<HTMLButtonElement>('[data-startup-action="signout"]')!;
  signOut.hidden = !recovery.signOut;
  signOut.addEventListener("click", () => {
    signOut.disabled = true;
    const feedback = panel.querySelector(".remote-feedback")!;
    feedback.textContent = "Cerrando sesión…";
    void recovery.signOut?.().catch((error: unknown) => {
      feedback.textContent = error instanceof Error ? error.message : String(error);
      signOut.disabled = false;
    });
  });
  appRoot.insertAdjacentElement("beforebegin", panel);
  return panel;
}
