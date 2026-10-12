# Reportes de problemas y pedidos de cambio

El botón con icono de bug aparece inmediatamente antes de la campanita en
las vistas de jugador y GM. Requiere una campaña remota conectada. El formulario
solo pide una descripción de entre 10 y 8.000 caracteres: no admite imágenes,
archivos, capturas de pantalla ni otros adjuntos.

## Qué se conserva y cuándo

Al abrir el formulario se congela el contexto del cliente y se solicita una
captura al servidor. Se puede escribir la descripción mientras se prepara el
contexto; el envío queda habilitado cuando la captura está guardada. Escribir
la descripción o reintentar no cambia el contexto original. Un UUID de petición
permite recuperar el resultado de una captura cuyo envío o respuesta se perdió.
Las solicitudes tienen un timeout de 30 segundos para poder reintentar sin
dejar el formulario bloqueado si la conexión deja de responder.

La captura está limitada a la campaña remota activa, por ejemplo ECE:

- Estado del servidor: fila de campaña, miembros y roles, revisiones de
  personajes y todos los fragmentos activos de esa campaña.
- Catálogo activo de esa campaña: conjuros, equipo, monstruos, tiendas y checklist.
- Cliente: campaña cargada, personaje seleccionado, checksum y revisiones,
  valores pendientes de formularios, pantalla/filtros relevantes, últimas
  40 acciones y notificaciones, estado de conexiones y entorno del navegador.
- Catálogo que este cliente tenía cargado, aunque haya quedado desactualizado.
- Versión, fecha de build, hash SHA-256 de las fuentes y nombres de los bundles
  JS/CSS cargados (sin URLs ni parámetros); lista de
  migraciones que estaba aplicada en el servidor.

No se incluye lore, campañas ajenas, tablas de Auth, contraseñas, sesiones ni
tokens de acceso. El recolector de formularios omite controles de contraseña,
archivos, valores binarios data/blob y nombres de campos de credenciales.
Los identificadores de usuario que figuran en miembros/revisiones son los de
los datos de campaña; no se copian perfiles de Auth.

La lectura de las tablas del servidor y su catálogo se hace en una única
sentencia SQL y por tanto usa un mismo snapshot MVCC. Se guardan hora de inicio
y fin de la lectura. La hora del cliente se conserva por separado: no se afirma
que dos relojes ni los estados de cliente y servidor sean idénticos.

El estado corresponde al momento de abrir el reporte, no a un error anterior
que ocurrió antes de abrirlo. Las notificaciones preservan la hora del error si
la aplicación lo registró durante esta sesión. El contexto del cliente se
identifica como información proporcionada por el cliente; no se usa para permisos.

## Almacenamiento

- `private.campaign_issue_snapshots`: copias de estado y catálogo, identificadas
  por campaña, tipo y SHA-256 de su JSONB. No se pueden actualizar. Una restricción
  verifica que contenido y hash coincidan.
- `private.campaign_issue_contexts`: captura, autor, fechas, referencias a las
  copias y contexto del cliente con su hash.
- `private.campaign_issue_reports`: descripción, autor, fecha, estado de gestión
  y referencia a la captura. El UUID devuelto al jugador permite buscar el reporte.

Las copias idénticas se reutilizan. Cliente y servidor usan la misma representación
canónica del catálogo; si tenían la misma versión, comparten una sola copia.
Si diferían, se conservan ambas para investigar desincronización. JSONB se guarda
con almacenamiento EXTENDED y compresión TOAST pglz de PostgreSQL, sin archivos
de Storage ni adjuntos descargables en el flujo del usuario.

Una captura puede enviarse durante 24 horas. Las capturas sin reporte de más de
siete días se eliminan al crear otra captura del mismo usuario; se recogen las
copias huérfanas antiguas de esa campaña. Los reportes enviados y las copias a
las que apuntan se conservan, incluso si luego se elimina la campaña.
Límites: diez capturas por hora y treinta por día por usuario, incluidos
formularios abiertos sin enviar. Los reintentos con el mismo UUID no cuentan otra vez.

## Permisos y APIs

Las tres tablas están en `private`, tienen RLS y niegan acceso directo a clientes.
Los RPC públicos usan SECURITY INVOKER. Las funciones que escriben o leen datos
privados están en `issue_reporting`, un esquema que no debe agregarse a los
esquemas expuestos de la Data API. Siempre usan un search_path vacío y permisos
EXECUTE específicos.

- `capture_campaign_issue_context`: exige sesión y membresía de la campaña.
  Devuelve solamente ID y fecha de captura, nunca datos privilegiados.
- `submit_campaign_issue_report`: exige que la captura sea propia y que la cuenta
  siga siendo miembro. Los reintentos devuelven el mismo reporte; no lo duplican
  ni sobrescriben una descripción ya recibida.
- `read_campaign_issue_report`: únicamente `service_role` o herramientas de
  administración. Reconstruye el paquete completo desde las copias conservadas.

## Investigar un reporte

Desde SQL Editor o MCP de administración:

```sql
select r.id, r.description, r.status, r.created_at, c.capture_started_at,
       c.client_context->'build' as build,
       c.client_context->>'selectedCharacterId' as character_id,
       c.server_state_hash, c.server_catalog_hash, c.client_catalog_hash
from private.campaign_issue_reports r
join private.campaign_issue_contexts c on c.id=r.context_id
order by r.created_at desc;
```

Para recuperar todo el contexto de una referencia:

```sql
select public.read_campaign_issue_report('UUID-del-reporte'::uuid);
```

Para buscar únicamente los fragmentos de un personaje, sin descargar el catálogo:

```sql
select f.value
from private.campaign_issue_reports r
join private.campaign_issue_contexts c on c.id=r.context_id
join private.campaign_issue_snapshots s
  on s.campaign_id=c.campaign_id and s.hash=c.server_state_hash
cross join lateral jsonb_array_elements(s.payload->'fragments') f
where r.id='UUID-del-reporte'::uuid
  and (f.value->>'parent_id'='ID-del-personaje'
       or f.value->>'entity_id'='ID-del-personaje');
```

No restaurar ni sobrescribir la campaña activa para investigar. El hash de build
identifica las fuentes; conservar los builds/versiones publicados para reproducir
también el comportamiento del código antiguo. Las capturas de datos por sí solas
no reconstruyen una versión de código que no se haya conservado.

## Comprobaciones

`npm run check` verifica tipos, pruebas y build. Las pruebas de DOM cubren el
campo único, captura pendiente, reintentos, descripción conservada y prevención
de envíos duplicados. `supabase/tests/campaign_issue_reports.sql` verifica permisos,
aislamiento de ECE, captura idempotente, catálogos compartidos, compresión,
inmutabilidad y recuperación del diagnóstico en una transacción con ROLLBACK.
