import type { User } from "@supabase/supabase-js";
import type { CampaignRepository, CampaignSnapshot } from "../application/ports/campaign-repository";
import {
  DualCampaignRepository,
  type CampaignReplicationStatus,
} from "../infrastructure/persistence/dual-campaign-repository";
import { createCampaignSnapshot, encodeCampaignEnvelope } from "../infrastructure/persistence/campaign-snapshot";
import { CampaignV2Schema } from "../domain/character/character-v2";
import { createRandomId } from "../shared/id";
import { loadRemoteBackendConfig } from "../infrastructure/remote/backend-config";
import { loadPersistenceMode } from "../infrastructure/remote/persistence-mode";
import {
  createRemoteSupabaseClient,
  SupabaseCampaignDocumentClient,
  type RemoteCampaignSummary,
} from "../infrastructure/remote/supabase-campaign-document-client";
import { SupabaseCampaignContentStore } from "../infrastructure/remote/supabase-campaign-content-store";
import { SupabaseCampaignLoreClient } from "../infrastructure/remote/supabase-campaign-lore-client";
import { SupabaseCampaignFragmentClient } from "../infrastructure/remote/supabase-campaign-fragment-client";
import { SupabaseGranularCampaignRepository } from "../infrastructure/remote/supabase-granular-campaign-repository";
import { SupabaseGranularCampaignReplica } from "../infrastructure/remote/supabase-granular-campaign-replica";
import {
  registerPersistencePanelOpener,
  setAppConnectionStatus,
} from "./app-chrome";
import {
  createCampaignMemberTemporaryPassword,
  updateSignedInPassword,
} from "./campaign-member-password";
import { updateRecoveredPassword, verifyPasswordRecovery } from "./password-recovery";
import { browserSymbiotePreferences } from "./symbiote-preferences";
import { mountAppInvitationAcceptance, mountAppInvitationSender } from "./app-user-invitations";
import { SupabaseCampaignIssueClient } from "../infrastructure/remote/supabase-campaign-issue-client";
import { mountRemoteStartupFailure } from "./remote-startup-failure";

const bindingKeyPrefix = "talespire-charsheet:remote-campaign:";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function createSetupPanel(appRoot: HTMLElement): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "remote-setup";
  appRoot.replaceChildren(panel);
  return panel;
}

async function requestAuthentication(
  panel: HTMLElement,
  supabase: ReturnType<typeof createRemoteSupabaseClient>,
  allowLocalFallback: boolean,
): Promise<User | null> {
  const current = await supabase.auth.getUser();
  if (current.data.user) return current.data.user;

  return new Promise((resolve) => {
    const preferences = browserSymbiotePreferences();
    const rememberedEmail = preferences.rememberedAuthEmail();
    panel.innerHTML = `
      <p class="eyebrow">Persistencia compartida</p>
      <h1>Conectar con Supabase</h1>
      <p>El acceso a las campañas compartidas es por invitación. Iniciá sesión o aceptá el correo que recibiste.</p>
      <form class="remote-auth-form">
        <label>Email<input name="email" type="email" autocomplete="email" value="${escapeHtml(rememberedEmail)}" required></label>
        <label>Contraseña<span class="remote-password-control"><input name="password" type="password" autocomplete="current-password" minlength="6" required><button type="button" class="secondary-button" data-auth-action="toggle-password" aria-pressed="false">Mostrar</button></span></label>
        <label class="remote-remember-user"><input name="rememberEmail" type="checkbox" ${rememberedEmail ? "checked" : ""}> Recordar email en este dispositivo</label>
        <div class="remote-actions">
          <button type="submit" data-auth-action="signin">Iniciar sesión</button>
          <button type="button" data-auth-action="accept-invitation">Aceptar invitación</button>
          <button type="button" class="secondary-button" data-auth-action="local">Continuar solo local</button>
        </div>
        <div class="remote-auth-help">
          <button type="button" class="secondary-button" data-auth-action="reset-password">Recuperar contraseña</button>
          <button type="button" class="secondary-button" data-auth-action="magic-link">Enviar enlace de acceso</button>
        </div>
        <small>Supabase mantiene la sesión iniciada. Sólo se guarda el email si elegís recordarlo; nunca la contraseña.</small>
        <p class="remote-feedback" role="status" aria-live="polite"></p>
      </form>
      <form class="remote-recovery-form" hidden>
        <p class="eyebrow">Recuperar acceso</p>
        <h2>Crear una contraseña nueva</h2>
        <p class="remote-recovery-instructions">En el email nuevo, copiá el enlace de recuperación sin abrirlo y pegalo abajo. Si el mensaje muestra un código de 6 dígitos, también podés usarlo.</p>
        <label>Email<input name="recoveryEmail" type="email" autocomplete="email" readonly required></label>
        <label>Enlace o código<textarea name="recoveryCredential" rows="3" autocomplete="one-time-code" spellcheck="false" required></textarea></label>
        <label>Contraseña nueva<input name="newPassword" type="password" autocomplete="new-password" minlength="6" required></label>
        <label>Repetir contraseña<input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required></label>
        <div class="remote-actions">
          <button type="submit">Cambiar contraseña y entrar</button>
          <button type="button" class="secondary-button" data-auth-action="cancel-reset">Volver</button>
          <button type="button" class="secondary-button" data-auth-action="resend-reset">Enviar correo nuevo</button>
        </div>
        <small>Los enlaces son de un solo uso. Si ya abriste el anterior y viste “Invalid host”, enviá uno nuevo y esta vez copialo sin abrirlo.</small>
        <p class="remote-feedback" role="status" aria-live="polite"></p>
      </form>`;
    const form = panel.querySelector<HTMLFormElement>(".remote-auth-form");
    const feedback = form?.querySelector<HTMLElement>(".remote-feedback");
    const recoveryForm = panel.querySelector<HTMLFormElement>(".remote-recovery-form");
    const recoveryFeedback = recoveryForm?.querySelector<HTMLElement>(".remote-feedback");
    if (!form || !feedback || !recoveryForm || !recoveryFeedback) {
      throw new Error("REMOTE_AUTH_FORM_NOT_FOUND");
    }

    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement;
    const rememberInput = form.elements.namedItem("rememberEmail") as HTMLInputElement;
    const recoveryEmailInput = recoveryForm.elements.namedItem("recoveryEmail") as HTMLInputElement;
    const recoveryCredentialInput = recoveryForm.elements.namedItem("recoveryCredential") as HTMLTextAreaElement;
    const newPasswordInput = recoveryForm.elements.namedItem("newPassword") as HTMLInputElement;
    const confirmPasswordInput = recoveryForm.elements.namedItem("confirmPassword") as HTMLInputElement;
    const cancelResetButton = recoveryForm.querySelector<HTMLButtonElement>('[data-auth-action="cancel-reset"]');
    const resendResetButton = recoveryForm.querySelector<HTMLButtonElement>('[data-auth-action="resend-reset"]');
    const actionButtons = [...panel.querySelectorAll<HTMLButtonElement>("button")];
    const email = (): string => emailInput.value.trim().toLocaleLowerCase();
    const rememberEmail = (): void => preferences.rememberAuthEmail(rememberInput.checked ? email() : null);
    const setBusy = (busy: boolean): void => actionButtons.forEach((button) => { button.disabled = busy; });
    let recoveryVerified = false;

    const showRecovery = (): void => {
      recoveryEmailInput.value = email();
      form.hidden = true;
      recoveryForm.hidden = false;
      recoveryCredentialInput.focus();
    };
    const showInvitation = mountAppInvitationAcceptance(panel, supabase.auth, (user) => {
      preferences.rememberAuthEmail(rememberInput.checked ? user.email ?? null : null);
      resolve(user);
    }, () => { form.hidden = false; emailInput.focus(); });
    panel.querySelector('[data-auth-action="accept-invitation"]')?.addEventListener("click", () => {
      form.hidden = true;
      recoveryForm.hidden = true;
      showInvitation(email());
    });

    const authenticate = async (): Promise<void> => {
      if (!form.reportValidity()) return;
      setBusy(true);
      feedback.textContent = "Iniciando sesión…";
      try {
        const result = await supabase.auth.signInWithPassword({ email: email(), password: passwordInput.value });
        if (result.error) {
          feedback.textContent = result.error.message;
          return;
        }
        rememberEmail();
        const user = result.data.user;
        if (!user || !result.data.session) {
          feedback.textContent = "Revisá tu email para confirmar la cuenta antes de iniciar sesión.";
          return;
        }
        resolve(user);
      } catch (error) {
        feedback.textContent = errorMessage(error);
      } finally {
        setBusy(false);
      }
    };

    const sendResetEmail = async (): Promise<void> => {
      if (!emailInput.reportValidity()) return;
      setBusy(true);
      feedback.textContent = "Enviando email…";
      try {
        const result = await supabase.auth.resetPasswordForEmail(email());
        if (result.error) {
          feedback.textContent = result.error.message;
          return;
        }
        rememberEmail();
        showRecovery();
        recoveryFeedback.textContent = "Correo enviado. Copiá el enlace de recuperación sin abrirlo y pegalo arriba.";
      } catch (error) {
        feedback.textContent = errorMessage(error);
      } finally {
        setBusy(false);
      }
    };

    const sendEmailAction = async (): Promise<void> => {
      if (!emailInput.reportValidity()) return;
      setBusy(true);
      feedback.textContent = "Enviando email…";
      try {
        const result = await supabase.auth.signInWithOtp({ email: email(), options: { shouldCreateUser: false } });
        feedback.textContent = result.error
          ? result.error.message
          : "Enlace de acceso enviado. Revisá tu email.";
        if (!result.error) rememberEmail();
      } catch (error) {
        feedback.textContent = errorMessage(error);
      } finally {
        setBusy(false);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void authenticate();
    });
    panel.querySelector('[data-auth-action="toggle-password"]')?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const visible = passwordInput.type === "text";
      passwordInput.type = visible ? "password" : "text";
      button.textContent = visible ? "Mostrar" : "Ocultar";
      button.setAttribute("aria-pressed", String(!visible));
      passwordInput.focus();
    });
    panel.querySelector('[data-auth-action="reset-password"]')?.addEventListener("click", () => void sendResetEmail());
    panel.querySelector('[data-auth-action="magic-link"]')?.addEventListener("click", () => void sendEmailAction());
    recoveryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      confirmPasswordInput.setCustomValidity(
        newPasswordInput.value === confirmPasswordInput.value ? "" : "Las contraseñas no coinciden.",
      );
      if (!recoveryForm.reportValidity()) return;

      void (async () => {
        setBusy(true);
        try {
          if (!recoveryVerified) {
            recoveryFeedback.textContent = "Verificando el enlace de recuperación…";
            await verifyPasswordRecovery(
              supabase.auth,
              recoveryEmailInput.value.trim().toLocaleLowerCase(),
              recoveryCredentialInput.value,
            );
            recoveryVerified = true;
            recoveryEmailInput.disabled = true;
            recoveryCredentialInput.disabled = true;
            if (cancelResetButton) cancelResetButton.hidden = true;
            if (resendResetButton) resendResetButton.hidden = true;
          }

          recoveryFeedback.textContent = "Guardando la contraseña nueva…";
          const user = await updateRecoveredPassword(supabase.auth, newPasswordInput.value);
          rememberEmail();
          recoveryFeedback.textContent = "Contraseña actualizada. Entrando…";
          resolve(user);
        } catch (error) {
          recoveryFeedback.textContent = recoveryVerified
            ? `El enlace fue verificado, pero no se pudo guardar la contraseña: ${errorMessage(error)}`
            : `No se pudo verificar el enlace o código. Pedí un correo nuevo si ya lo habías abierto: ${errorMessage(error)}`;
        } finally {
          setBusy(false);
        }
      })();
    });
    cancelResetButton?.addEventListener("click", () => {
      if (recoveryVerified) return;
      recoveryForm.reset();
      recoveryFeedback.textContent = "";
      recoveryForm.hidden = true;
      form.hidden = false;
      feedback.textContent = "";
      emailInput.focus();
    });
    resendResetButton?.addEventListener("click", () => void sendResetEmail());
    rememberInput.addEventListener("change", () => {
      if (!rememberInput.checked) preferences.rememberAuthEmail(null);
    });
    panel.querySelector('[data-auth-action="local"]')?.addEventListener("click", () => resolve(null));
    const localButton = panel.querySelector<HTMLButtonElement>('[data-auth-action="local"]');
    if (localButton) localButton.hidden = !allowLocalFallback;
  });
}

async function requestCampaign(
  panel: HTMLElement,
  user: User,
  client: SupabaseCampaignDocumentClient,
  bindingKey: string,
  signOut: () => Promise<void>,
  allowLocalFallback: boolean,
  supabase: ReturnType<typeof createRemoteSupabaseClient>,
): Promise<RemoteCampaignSummary | null> {
  const campaigns = await client.listCampaigns();
  const boundId = window.localStorage.getItem(bindingKey);
  const bound = campaigns.find((campaign) => campaign.id === boundId);
  if (bound) return bound;

  return new Promise((resolve) => {
    panel.innerHTML = `
      <p class="eyebrow">Persistencia compartida</p>
      <h1>Elegir campaña remota</h1>
      <p class="remote-account"></p>
      <div class="remote-campaign-list"></div>
      <section class="remote-app-invitation-slot"></section>
      <form class="remote-create-form">
        <label>Nombre de la campaña<input name="name" maxlength="120" required></label>
        <button type="submit">Crear campaña</button>
      </form>
      <div class="remote-actions">
        <button type="button" class="secondary-button" data-campaign-action="local">Continuar solo local</button>
        <button type="button" class="secondary-button" data-campaign-action="signout">Cerrar sesión</button>
      </div>
      <p class="remote-feedback" role="status"></p>`;
    const account = panel.querySelector<HTMLElement>(".remote-account");
    const list = panel.querySelector<HTMLElement>(".remote-campaign-list");
    const form = panel.querySelector<HTMLFormElement>(".remote-create-form");
    const feedback = panel.querySelector<HTMLElement>(".remote-feedback");
    const appInvitationSlot = panel.querySelector<HTMLElement>(".remote-app-invitation-slot");
    if (appInvitationSlot) mountAppInvitationSender(appInvitationSlot, supabase);
    if (!account || !list || !form || !feedback) {
      throw new Error("REMOTE_CAMPAIGN_FORM_NOT_FOUND");
    }
    account.textContent = user.email ?? user.id;

    if (campaigns.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Todavía no tenés campañas remotas.";
      list.append(empty);
    }
    for (const campaign of campaigns) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "remote-campaign-option";
      button.textContent = campaign.name;
      button.addEventListener("click", () => resolve(campaign));
      list.append(button);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = String(new FormData(form).get("name") ?? "").trim();
      feedback.textContent = "Creando campaña remota…";
      void (async () => {
        const createdAt = new Date().toISOString();
        const snapshot = await createCampaignSnapshot(CampaignV2Schema.parse({
          schemaVersion: 2,
          id: await createRandomId("cmp"),
          revision: 0,
          characters: {},
          encounters: {},
          gm: { noteGroups: [], randomTables: [], googleDocsUrl: "" },
          metadata: { createdAt, updatedAt: createdAt },
        }));
        return client.createCampaign(name, JSON.parse(encodeCampaignEnvelope(snapshot)) as Record<string, unknown>);
      })().then((document) => resolve({
        id: document.campaignId,
        name,
        ownerUserId: user.id,
        updatedAt: document.updatedAt,
      })).catch((error: unknown) => {
        feedback.textContent = errorMessage(error);
      });
    });
    panel.querySelector('[data-campaign-action="local"]')?.addEventListener("click", () => resolve(null));
    const localButton = panel.querySelector<HTMLButtonElement>('[data-campaign-action="local"]');
    if (localButton) localButton.hidden = !allowLocalFallback;
    panel.querySelector('[data-campaign-action="signout"]')?.addEventListener("click", () => {
      void signOut().finally(() => resolve(null));
    });
  });
}

function replicationLabel(status: CampaignReplicationStatus): string {
  switch (status.state) {
    case "idle": return "Réplica esperando datos locales";
    case "syncing": return "Sincronizando con Supabase…";
    case "synced": return `Supabase sincronizado · revisión ${status.remoteRevision}`;
    case "diverged": return "Supabase divergente · no se sobrescribió";
    case "missing": return "Documento remoto inexistente";
    case "unavailable": return `Supabase no disponible · ${status.message}`;
  }
}

function mountRemoteControls(
  appRoot: HTMLElement,
  user: User,
  campaign: RemoteCampaignSummary,
  supabase: ReturnType<typeof createRemoteSupabaseClient>,
  client: SupabaseCampaignDocumentClient,
  bindingKey: string,
  signOut: () => Promise<void>,
): (status: CampaignReplicationStatus) => void {
  const controls = document.createElement("aside");
  controls.className = "remote-controls";
  controls.hidden = true;
  controls.innerHTML = `
    <section id="remote-persistence-panel" class="remote-persistence-panel" role="dialog" aria-modal="true" aria-label="Persistencia compartida">
      <header><div><strong class="remote-campaign-name"></strong><span class="remote-user"></span></div><button type="button" class="secondary-button" data-remote-action="close-panel">Cerrar</button></header>
      <section class="remote-app-invitation-slot"></section>
      <form class="remote-invite-form">
        <input name="email" type="email" placeholder="Email del integrante" required>
        <select name="role"><option value="player">Jugador</option><option value="gm">GM</option></select>
        <button type="submit">Agregar a la campaña</button>
      </form>
      <form class="remote-member-password-form" hidden>
        <strong>Recuperar acceso de un integrante</strong>
        <div>
          <input name="memberEmail" type="email" autocomplete="email" placeholder="Email del integrante" required>
          <button type="submit">Generar clave provisoria</button>
        </div>
        <small>Sólo el dueño puede hacerlo. La cuenta y sus datos no se eliminan.</small>
        <p class="remote-member-password-feedback remote-feedback" role="status" aria-live="polite"></p>
      </form>
      <section class="remote-temporary-password" hidden>
        <strong>Clave provisoria</strong>
        <div>
          <input type="text" readonly autocomplete="off" aria-label="Clave provisoria generada">
          <button type="button" class="secondary-button" data-remote-action="copy-temporary-password">Copiar</button>
        </div>
        <small>Copiala ahora y compartila por privado. Supabase no permite volver a consultar esta clave.</small>
      </section>
      <details class="remote-change-password">
        <summary>Cambiar mi contraseña</summary>
        <form>
          <label>Nueva contraseña<input name="newPassword" type="password" autocomplete="new-password" minlength="8" required></label>
          <label>Repetir contraseña<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label>
          <button type="submit">Guardar mi contraseña</button>
          <small>Usá esto después de entrar con una clave provisoria.</small>
          <p class="remote-own-password-feedback remote-feedback" role="status" aria-live="polite"></p>
        </form>
      </details>
      <div class="remote-panel-actions">
        <button type="button" class="secondary-button" data-remote-action="change">Cambiar campaña</button>
        <button type="button" class="secondary-button" data-remote-action="signout">Cerrar sesión</button>
      </div>
      <small class="remote-panel-feedback remote-feedback" role="status"></small>
    </section>`;
  appRoot.insertAdjacentElement("beforebegin", controls);
  const appInvitationSlot = controls.querySelector<HTMLElement>(".remote-app-invitation-slot");
  if (appInvitationSlot) mountAppInvitationSender(appInvitationSlot, supabase);
  const campaignName = controls.querySelector<HTMLElement>(".remote-campaign-name");
  const userLabel = controls.querySelector<HTMLElement>(".remote-user");
  const invite = controls.querySelector<HTMLFormElement>(".remote-invite-form");
  const memberPasswordForm = controls.querySelector<HTMLFormElement>(".remote-member-password-form");
  const memberPasswordFeedback = controls.querySelector<HTMLElement>(".remote-member-password-feedback");
  const temporaryPasswordPanel = controls.querySelector<HTMLElement>(".remote-temporary-password");
  const temporaryPasswordInput = temporaryPasswordPanel?.querySelector<HTMLInputElement>("input");
  const ownPasswordForm = controls.querySelector<HTMLFormElement>(".remote-change-password form");
  const ownPasswordFeedback = controls.querySelector<HTMLElement>(".remote-own-password-feedback");
  const feedback = controls.querySelector<HTMLElement>(".remote-panel-feedback");
  if (
    !campaignName || !userLabel || !invite || !memberPasswordForm || !memberPasswordFeedback
    || !temporaryPasswordPanel || !temporaryPasswordInput || !ownPasswordForm || !ownPasswordFeedback || !feedback
  ) {
    throw new Error("REMOTE_CONTROLS_NOT_FOUND");
  }
  campaignName.textContent = campaign.name;
  userLabel.textContent = user.email ?? user.id;
  invite.hidden = campaign.ownerUserId !== user.id;
  memberPasswordForm.hidden = campaign.ownerUserId !== user.id;
  const setPanelOpen = (open: boolean): void => {
    if (!open) {
      temporaryPasswordInput.value = "";
      temporaryPasswordPanel.hidden = true;
    }
    controls.hidden = !open;
    controls.classList.toggle("panel-open", open);
  };
  registerPersistencePanelOpener(() => setPanelOpen(true));
  controls.querySelector('[data-remote-action="close-panel"]')?.addEventListener("click", () => setPanelOpen(false));
  controls.addEventListener("click", (event) => {
    if (event.target === controls) setPanelOpen(false);
  });
  invite.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(invite);
    const email = String(values.get("email") ?? "").trim();
    const role = values.get("role") === "gm" ? "gm" : "player";
    feedback.textContent = "Invitando…";
    void client.addMemberByEmail(campaign.id, email, role).then(() => {
      feedback.textContent = "Integrante agregado.";
      invite.reset();
    }).catch((error: unknown) => {
      feedback.textContent = errorMessage(error);
    });
  });
  memberPasswordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!memberPasswordForm.reportValidity()) return;
    const emailInput = memberPasswordForm.elements.namedItem("memberEmail") as HTMLInputElement;
    const submitButton = memberPasswordForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submitButton) return;
    submitButton.disabled = true;
    temporaryPasswordPanel.hidden = true;
    temporaryPasswordInput.value = "";
    memberPasswordFeedback.textContent = "Generando una clave segura…";
    void createCampaignMemberTemporaryPassword(supabase, campaign.id, emailInput.value.trim().toLocaleLowerCase())
      .then((password) => {
        temporaryPasswordInput.value = password;
        temporaryPasswordPanel.hidden = false;
        temporaryPasswordInput.focus();
        temporaryPasswordInput.select();
        memberPasswordFeedback.textContent = "Clave provisoria generada. Copiala antes de cerrar este panel.";
      })
      .catch((error: unknown) => {
        memberPasswordFeedback.textContent = errorMessage(error);
      })
      .finally(() => {
        submitButton.disabled = false;
      });
  });
  controls.querySelector('[data-remote-action="copy-temporary-password"]')?.addEventListener("click", () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(temporaryPasswordInput.value);
        memberPasswordFeedback.textContent = "Clave copiada. Compartila por un canal privado.";
      } catch {
        temporaryPasswordInput.focus();
        temporaryPasswordInput.select();
        memberPasswordFeedback.textContent = "La clave quedó seleccionada. Copiala con Ctrl+C.";
      }
    })();
  });
  ownPasswordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const newPasswordInput = ownPasswordForm.elements.namedItem("newPassword") as HTMLInputElement;
    const confirmPasswordInput = ownPasswordForm.elements.namedItem("confirmPassword") as HTMLInputElement;
    confirmPasswordInput.setCustomValidity(
      newPasswordInput.value === confirmPasswordInput.value ? "" : "Las contraseñas no coinciden.",
    );
    if (!ownPasswordForm.reportValidity()) return;
    const submitButton = ownPasswordForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submitButton) return;
    submitButton.disabled = true;
    ownPasswordFeedback.textContent = "Guardando la contraseña…";
    void updateSignedInPassword(supabase, newPasswordInput.value).then(() => {
      ownPasswordForm.reset();
      ownPasswordFeedback.textContent = "Contraseña actualizada.";
    }).catch((error: unknown) => {
      ownPasswordFeedback.textContent = errorMessage(error);
    }).finally(() => {
      submitButton.disabled = false;
    });
  });
  controls.querySelector('[data-remote-action="change"]')?.addEventListener("click", () => {
    window.localStorage.removeItem(bindingKey);
    window.location.reload();
  });
  controls.querySelector('[data-remote-action="signout"]')?.addEventListener("click", () => {
    window.localStorage.removeItem(bindingKey);
    void signOut().then(() => window.location.reload());
  });
  return (status) => {
    controls.dataset.state = status.state;
    const chromeState = status.state === "synced" ? "ok"
      : status.state === "diverged" || status.state === "missing" || status.state === "unavailable"
        ? "error" : "pending";
    setAppConnectionStatus("persistence", { state: chromeState, label: replicationLabel(status) });
  };
}

export interface RemoteCampaignServices {
  content: SupabaseCampaignContentStore;
  lore: SupabaseCampaignLoreClient;
  issueReporter: SupabaseCampaignIssueClient;
  subscribeCampaignChanges(listener: (snapshot: CampaignSnapshot) => void): () => void;
  subscribeContentChanges(listener: () => void): () => void;
}

export async function configureRemotePersistence(
  primary: CampaignRepository,
  appRoot: HTMLElement,
  onServices?: (services: RemoteCampaignServices) => void,
): Promise<CampaignRepository> {
  const persistenceMode = loadPersistenceMode();
  let recovery: {
    bindingKey: string;
    account: string;
    campaign?: string;
    signOut: () => Promise<void>;
  } | undefined;
  try {
    if (persistenceMode === "local") {
      setAppConnectionStatus("persistence", { state: "disabled", label: "Persistencia remota desactivada · modo local" });
      return primary;
    }
    const config = loadRemoteBackendConfig();
    if (config === null) {
      setAppConnectionStatus("persistence", { state: "disabled", label: "Supabase no configurado" });
      return primary;
    }

    const panel = createSetupPanel(appRoot);
    const supabase = createRemoteSupabaseClient(config, {
      persistSession: true,
      autoRefreshToken: true,
    });
    const allowLocalFallback = persistenceMode !== "remote";
    const user = await requestAuthentication(panel, supabase, allowLocalFallback);
    if (user === null) {
      panel.remove();
      setAppConnectionStatus("persistence", { state: "disabled", label: "Persistencia remota omitida · modo local" });
      return primary;
    }
    const client = new SupabaseCampaignDocumentClient(supabase);
    const fragmentClient = new SupabaseCampaignFragmentClient(supabase);
    const bindingKey = `${bindingKeyPrefix}${config.url}`;
    const signOut = async (): Promise<void> => {
      const result = await supabase.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
    };
    recovery = { bindingKey, account: user.email ?? user.id, signOut };
    const campaign = await requestCampaign(
      panel,
      user,
      client,
      bindingKey,
      signOut,
      allowLocalFallback,
      supabase,
    );
    if (campaign === null) {
      panel.remove();
      setAppConnectionStatus("persistence", { state: "disabled", label: "Persistencia remota omitida · modo local" });
      return primary;
    }
    recovery.campaign = campaign.name;

    window.localStorage.setItem(bindingKey, campaign.id);
    const campaignChangeListeners = new Set<(snapshot: CampaignSnapshot) => void>();
    const content = new SupabaseCampaignContentStore(client, campaign.id);
    onServices?.({
      content,
      issueReporter: new SupabaseCampaignIssueClient(supabase, campaign.id, campaign.name, () => content.captureLoadedEntries()),
      lore: new SupabaseCampaignLoreClient(supabase, campaign.id),
      subscribeCampaignChanges: (listener) => {
        campaignChangeListeners.add(listener);
        return () => campaignChangeListeners.delete(listener);
      },
      subscribeContentChanges: (listener) => {
        const subscription = client.subscribeCampaignContent(campaign.id, listener);
        void subscription.ready.catch(() => undefined);
        return () => { void subscription.unsubscribe(); };
      },
    });
    panel.remove();
    const onStatus = mountRemoteControls(appRoot, user, campaign, supabase, client, bindingKey, signOut);
    if (persistenceMode === "remote") {
      const reportRemoteRevision = (revision: number): void => {
        onStatus({
          state: "synced",
          localChecksum: "remote-authoritative",
          remoteRevision: revision,
        });
      };
      const repository = new SupabaseGranularCampaignRepository(fragmentClient, campaign.id, reportRemoteRevision);
      const initial = await repository.load();
      if (initial === null) throw new Error("La campaña remota no tiene estado granular.");
      let latestReceivedRevision = repository.remoteRevision;
      const subscription = fragmentClient.subscribeCampaign(campaign.id, (signal) => {
        if (signal.revision <= latestReceivedRevision) return;
        latestReceivedRevision = signal.revision;
        if (signal.updatedBy === user.id) {
          reportRemoteRevision(signal.revision);
          return;
        }
        void repository.load().then((snapshot) => {
          if (!snapshot || signal.revision !== latestReceivedRevision) return;
          for (const listener of campaignChangeListeners) listener(snapshot);
        }).catch((error: unknown) => {
          onStatus({
            state: "unavailable",
            localChecksum: "remote-authoritative",
            message: errorMessage(error),
          });
        });
      });
      void subscription.ready.catch((error: unknown) => {
        onStatus({
          state: "unavailable",
          localChecksum: "remote-authoritative",
          message: errorMessage(error),
        });
      });
      return repository;
    }
    const granularRepository = new SupabaseGranularCampaignRepository(fragmentClient, campaign.id);
    const repository = new DualCampaignRepository(
      primary,
      new SupabaseGranularCampaignReplica(granularRepository),
      onStatus,
    );
    const subscription = fragmentClient.subscribeCampaign(campaign.id, () => {
      void repository.checkReplication();
    });
    void subscription.ready.catch((error: unknown) => {
      onStatus({
        state: "unavailable",
        localChecksum: repository.status.state === "idle" ? "unknown" : repository.status.localChecksum,
        message: errorMessage(error),
      });
    });
    return repository;
  } catch (error) {
    setAppConnectionStatus("persistence", { state: "error", label: `Supabase no disponible · ${errorMessage(error)}` });
    appRoot.replaceChildren();
    if (persistenceMode === "remote") {
      const context = recovery;
      mountRemoteStartupFailure(appRoot, {
        message: errorMessage(error),
        retry: () => window.location.reload(),
        ...(context ? {
          account: context.account,
          ...(context.campaign ? { campaign: context.campaign } : {}),
          changeCampaign: () => {
            window.localStorage.removeItem(context.bindingKey);
            window.location.reload();
          },
          signOut: async () => {
            await context.signOut();
            window.localStorage.removeItem(context.bindingKey);
            window.location.reload();
          },
        } : {}),
      });
      throw error;
    }
    const warning = document.createElement("aside");
    warning.className = "remote-controls";
    warning.dataset.state = "unavailable";
    warning.textContent = `Modo local activo · no se pudo preparar Supabase: ${errorMessage(error)}`;
    appRoot.insertAdjacentElement("beforebegin", warning);
    return primary;
  }
}
