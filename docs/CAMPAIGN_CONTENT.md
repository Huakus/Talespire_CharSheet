# Catálogo de contenido por campaña

## Fuente autoritativa

Cuando `VITE_PERSISTENCE_MODE=remote`, conjuros, equipo, monstruos, tiendas y checklist se leen y escriben en `public.campaign_content_entries`. Cada fila pertenece a una campaña mediante `campaign_id`; por lo tanto, la ejecución local y la instalada en TaleSpire muestran el mismo contenido siempre que inicien sesión y seleccionen la misma campaña remota.

El documento de campaña no contiene el catálogo. Mantener filas independientes evita reescribir varios megabytes de contenido cada vez que cambia un PG o avanza una ronda.

Los miembros pueden leer el catálogo. Solo el propietario o un miembro con rol `gm` puede crear, editar, etiquetar o eliminar entradas mediante las RPC versionadas. Las eliminaciones son lógicas (`deleted_at`) y las escrituras verifican `revision` para detectar ediciones concurrentes.

## Procedencia y etiquetas

`origin` conserva una procedencia estable:

- `official`: contenido base sembrado al crear la campaña.
- `gm`: contenido creado dentro del control de GM.
- `imported`: copia importada desde el almacenamiento legado.

`tags` es una lista editable por el GM y sirve para búsqueda y organización. Cambiar las etiquetas de una entrada oficial no cambia su `origin`.

## Migración y despliegue

La migración `20260808000100_campaign_content_catalog.sql` crea las tablas, políticas, RPC, publicación Realtime y la semilla oficial. También carga la semilla en campañas existentes y agrega automáticamente el catálogo a campañas nuevas.

Para regenerar la migración desde los JSON de referencia de desarrollo:

```powershell
node scripts/generate-campaign-content-migration.mjs
```

Para aplicar migraciones en el Supabase local:

```powershell
npm run backend:migrate
```

El despliegue remoto debe aplicar la misma migración antes de publicar el nuevo Symbiote.

## Importación del almacenamiento legado

En GM > Contenido aparece `Importar contenido local legado` únicamente cuando TaleSpire expone almacenamiento global legado y la campaña usa Supabase. Antes de confirmar muestra cuántos conjuros, objetos, monstruos, tiendas y tareas copiará.

La operación es aditiva: lee el origen legado, crea filas con procedencia `imported` y conserva duplicados con un sufijo. No escribe, elimina ni transforma `.localstorage/`. Después de verificar la campaña remota, el usuario puede decidir por separado qué hacer con el origen antiguo.

## Compatibilidad

Sin persistencia remota, el modo legado sigue usando el almacenamiento global de TaleSpire para el contenido creado por el usuario. En modo remoto no se transmite el catálogo completo por el canal Sync de TaleSpire: GM y jugadores lo leen directamente desde Supabase, evitando duplicación y límites de tamaño del transporte.
