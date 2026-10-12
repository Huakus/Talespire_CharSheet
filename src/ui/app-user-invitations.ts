import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';
import { functionErrorMessage } from './campaign-member-password';
import { parseEmailAuthCredential, updateRecoveredPassword } from './password-recovery';

type InvitationClient = Pick<SupabaseClient, 'rpc' | 'functions'>;
type InvitationAuth = Pick<SupabaseClient['auth'], 'verifyOtp' | 'updateUser' | 'signOut'>;
const InvitationResponseSchema = z.object({ invitationId: z.string().uuid(), email: z.string().email() });

export async function canInviteAppUsers(client: Pick<SupabaseClient, 'rpc'>): Promise<boolean> {
  const result = await client.rpc('can_invite_app_users');
  if (result.error) throw result.error;
  return result.data === true;
}

export async function inviteAppUser(client: InvitationClient, email: string): Promise<z.infer<typeof InvitationResponseSchema>> {
  const result = await client.functions.invoke('invite-app-user', { body: { email: email.trim().toLowerCase() } });
  if (result.error) throw new Error(await functionErrorMessage(result.error));
  return InvitationResponseSchema.parse(result.data);
}

export async function verifyAppInvitation(auth: InvitationAuth, email: string, value: string): Promise<User> {
  const credential = parseEmailAuthCredential(value, 'invite');
  const normalizedEmail = email.trim().toLowerCase();
  const result = credential.kind === 'otp'
    ? await auth.verifyOtp({ email: normalizedEmail, token: credential.token, type: 'invite' })
    : await auth.verifyOtp({ token_hash: credential.tokenHash, type: 'invite' });
  if (result.error) throw result.error;
  if (!result.data.session || !result.data.user) throw new Error('Supabase no inició una sesión de invitación.');
  if (result.data.user.email?.toLowerCase() !== normalizedEmail) {
    await auth.signOut();
    throw new Error('El enlace corresponde a otro email. Usá el email que recibió la invitación.');
  }
  return result.data.user;
}

export function mountAppInvitationSender(container: HTMLElement, client: InvitationClient): void {
  const form = document.createElement('form');
  form.className = 'remote-app-invitation-form';
  form.hidden = true;
  form.innerHTML = `<strong>Invitar a la aplicación</strong>
    <label>Email<input name="invitationEmail" type="email" autocomplete="email" required></label>
    <button type="submit">Enviar invitación</button>
    <small>La persona elegirá su contraseña desde el correo. Después podés agregarla a una campaña.</small>
    <p class="remote-feedback" role="status" aria-live="polite"></p>`;
  container.append(form);
  void canInviteAppUsers(client).then((allowed) => { form.hidden = !allowed; }).catch(() => { form.hidden = true; });
  const input = form.elements.namedItem('invitationEmail') as HTMLInputElement;
  const button = form.querySelector<HTMLButtonElement>('button')!;
  const feedback = form.querySelector<HTMLElement>('.remote-feedback')!;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity() || button.disabled) return;
    button.disabled = true;
    feedback.textContent = 'Enviando invitación…';
    void inviteAppUser(client, input.value).then((result) => {
      feedback.textContent = `Invitación enviada a ${result.email}. Si no llega, podés reenviarla después de un minuto.`;
    }).catch((error: unknown) => {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }).finally(() => { button.disabled = false; });
  });
}

export function mountAppInvitationAcceptance(
  panel: HTMLElement, auth: InvitationAuth, onAccepted: (user: User) => void, onCancel: () => void,
): (email: string) => void {
  const form = document.createElement('form');
  form.className = 'remote-invitation-acceptance-form';
  form.hidden = true;
  form.innerHTML = `<h2>Aceptar invitación</h2>
    <p>Copiá el enlace del correo sin abrirlo y pegalo acá. También podés usar el código de 6 dígitos si aparece en el correo.</p>
    <label>Email invitado<input name="email" type="email" autocomplete="email" required></label>
    <label>Enlace o código<textarea name="credential" rows="3" autocomplete="one-time-code" spellcheck="false" required></textarea></label>
    <label>Contraseña nueva<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
    <label>Repetir contraseña<input name="confirmation" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="remote-actions"><button type="submit">Aceptar y entrar</button><button type="button" class="secondary-button" data-invitation-cancel>Volver</button></div>
    <p class="remote-feedback" role="status" aria-live="polite"></p>`;
  panel.append(form);
  const email = form.elements.namedItem('email') as HTMLInputElement;
  const credential = form.elements.namedItem('credential') as HTMLTextAreaElement;
  const password = form.elements.namedItem('password') as HTMLInputElement;
  const confirmation = form.elements.namedItem('confirmation') as HTMLInputElement;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const cancel = form.querySelector<HTMLButtonElement>('[data-invitation-cancel]')!;
  const feedback = form.querySelector<HTMLElement>('.remote-feedback')!;
  let verified = false;
  confirmation.addEventListener('input', () => confirmation.setCustomValidity(''));
  cancel.addEventListener('click', () => { form.hidden = true; onCancel(); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    confirmation.setCustomValidity(password.value === confirmation.value ? '' : 'Las contraseñas no coinciden.');
    if (!form.reportValidity() || submit.disabled) return;
    submit.disabled = true;
    cancel.disabled = true;
    void (async () => {
      if (!verified) {
        feedback.textContent = 'Verificando invitación…';
        await verifyAppInvitation(auth, email.value, credential.value);
        verified = true;
        email.disabled = true;
        credential.disabled = true;
        credential.value = '';
        cancel.hidden = true;
      }
      feedback.textContent = 'Guardando contraseña…';
      const user = await updateRecoveredPassword(auth, password.value);
      password.value = '';
      confirmation.value = '';
      onAccepted(user);
    })().catch((error: unknown) => {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }).finally(() => { submit.disabled = false; cancel.disabled = false; });
  });
  return (initialEmail) => {
    email.value = initialEmail;
    form.hidden = false;
    credential.focus();
  };
}
