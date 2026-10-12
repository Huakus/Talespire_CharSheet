# Acceso por invitación

Las cuentas nuevas se crean únicamente desde `invite-app-user`. El permiso
global para invitar es independiente del propietario y del rol GM de una campaña.
Los usuarios existentes siguen entrando normalmente y el modo local sigue disponible.

## Permisos y auditoría

- `private.app_inviter_permissions`: usuarios autorizados, quién otorgó el permiso,
  fecha y revocación. No hay administración de este permiso desde el cliente.
- `private.app_invitations`: email, invitador, cuenta creada y resultado del envío.
  `accepted` significa que Auth confirmó el email; no demuestra que el usuario
  haya terminado de elegir una contraseña.
- `can_invite_app_users`: consulta únicamente el permiso del usuario autenticado.
- `reserve_app_invitation` y `finish_app_invitation`: RPC accesibles únicamente
  a `service_role`. La función Edge obtiene el invitador mediante `getUser(token)`.

Las tablas tienen RLS y no conceden acceso directo a los clientes ni a
`service_role`. Los RPC de servidor acceden a ellas con un `search_path` vacío.

Para otorgar permiso desde SQL Editor, usar el email completo de una cuenta
existente (el ejemplo no habilita usuarios por ser GM):

```sql
insert into private.app_inviter_permissions (user_id)
select id from auth.users where lower(email) = lower('usuario@example.com')
on conflict (user_id) do update set revoked_at = null, granted_at = now();
```

Para revocar nuevas invitaciones:

```sql
update private.app_inviter_permissions
set revoked_at = now()
where user_id = (select id from auth.users where lower(email) = lower('usuario@example.com'));
```

La revocación no elimina usuarios ni invalida correos ya enviados.
La función de claves provisorias de campañas rechaza cuentas con este permiso:
sus titulares deben recuperar la contraseña desde su propio correo.

## Restricción del registro

El cliente no llama a `signUp`. La función de servidor reserva una autorización
aleatoria de 256 bits válida durante cinco minutos, guarda únicamente su hash
y la entrega a la API administrativa de invitación en sus metadatos temporales.

El trigger `require_app_invitation_before_insert` en `auth.users` exige que esa
autorización coincida con una reserva privada, el email y un invitador todavía
habilitado. La consume atómicamente y elimina los metadatos secretos antes de
almacenar la cuenta. No se usa `user_metadata` como rol ni como permiso: el valor
por sí solo no autoriza nada sin la reserva y la comprobación del hash.

Esto bloquea nuevas cuentas mediante `signUp`, OTP con creación automática,
OAuth o acceso anónimo, incluso si una versión antigua del cliente conserva
el botón de registro. La API de Auth puede presentar el rechazo del trigger
como un error genérico de creación de usuario. También bloquea altas manuales
que no pasen por este procedimiento: usar la función de invitación para ellas.

Como refuerzo, en Authentication → Sign In / Providers desactivar **Allow new
users to sign up** y **Allow anonymous sign-ins**. La conexión MCP no expone
estos ajustes; el guard de base ya aplica la restricción sin depender de ellos.
No eliminar el trigger sin cerrar primero el registro público o sustituirlo
por un Before User Created Hook con la misma validación de reservas.

## Envío y aceptación

El panel de persistencia y el selector de campañas muestran **Invitar a la
aplicación** únicamente a usuarios autorizados. **Agregar a la campaña** sigue
siendo una operación separada, restringida por las reglas existentes.

El invitado copia el enlace del correo sin abrirlo y lo pega en **Aceptar
invitación**, junto con su email y contraseña nueva. Se verifica con
`verifyOtp({ type: 'invite', ... })`; los enlaces de recuperación o registro
no sirven para esta pantalla. Auth gestiona vencimiento y uso único del enlace.

Límites: 10 envíos por hora, 30 por día y al menos un minuto entre intentos al
mismo email. Los intentos fallidos también cuentan. Una reserva en curso evita
envíos simultáneos al mismo destinatario. Solo se pueden reenviar invitaciones
a cuentas no confirmadas que fueron creadas mediante este sistema.

El correo y la auditoría no forman una sola transacción. Si Auth creó la cuenta
pero se perdió la respuesta o falló la escritura final, se conserva el estado
`created` y se informa el problema; reintentar no crea otra cuenta. Una reserva
`sending` abandonada vence a los cinco minutos. No se almacenan contraseñas,
enlaces de correo ni autorizaciones en texto plano en estas tablas.

La entrega utiliza el proveedor de correo de Auth que ya está configurado.
Comprobar sus límites y destinatarios permitidos antes de invitar personas reales.

El advisor puede señalar `can_invite_app_users` por ser `SECURITY DEFINER`
ejecutable por usuarios autenticados. Es deliberado: solo devuelve un booleano
sobre `auth.uid()`, sin parámetros ni escrituras, para consultar una tabla privada.
No está disponible para `anon`. Ver
[advisor de funciones autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Verificación

Los tests de Vitest cubren autenticación, suplantación del invitador, errores
de permisos/límites, fallos parciales y aceptación de enlaces. El archivo
`supabase/tests/app_invitations.sql` verifica restricciones y ciclo de vida en
una transacción terminada en ROLLBACK. No envía emails ni conserva cuentas de prueba.

`npm run test:integration` también comprueba el rechazo de `signUp` y de la
función Edge sin sesión contra el backend configurado. Usa direcciones de
prueba `.invalid`, nunca destinatarios reales. Los tests de acceso a campañas
ya no crean cuentas mediante registro público: requieren tres cuentas de
prueba previamente invitadas y estas variables de entorno (sin prefijo VITE):
`SUPABASE_TEST_OWNER_EMAIL/PASSWORD`, `SUPABASE_TEST_MEMBER_EMAIL/PASSWORD` y
`SUPABASE_TEST_OUTSIDER_EMAIL/PASSWORD`. Sin esas credenciales, se omiten esos
tests; no usar cuentas personales porque esperan campañas inicialmente vacías.
