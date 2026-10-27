# Entrega 1.0.34 — 2026-10-27

## Alcance implementado

| Fix | Resultado |
| --- | --- |
| F01 | Ascenso tolerante a cambios ajenos, reintentos, protección de revisión e idempotencia; borrador y confirmación recuperables ante fallos. |
| F02 | Rebase de daño/curación, registro de operaciones y deduplicación de cola nativa entre GMs. Deshacer no restaura estados que borrarían trabajo ajeno. |
| F03 | Iniciativa de la hoja identificada por personaje, tirada y combate; ACK, reintentos y asignación sólo si falta. Épocas invalidan resultados anteriores a limpiar iniciativas o cambiar asociaciones. |
| F04 | Panel Personajes del GM: abrir/editar, renombrar, exportar, archivar/reactivar, desvincular miniatura y eliminar con confirmación. Limpieza de referencias y guardas de permisos en la base. |
| F05 | Descripción y requisitos de invocaciones antes de elegir, navegación con teclado y catálogo accesible de opciones no disponibles. |
| F06 | Auditoría de las 450 criaturas, diez correcciones en campaña y cuatro en plantillas compartidas, verificadas contra captura previa. |
| F07 | Seis salvaciones y dieciocho habilidades con bonificadores numéricos; entradas antiguas desconocidas conservadas. Botones de tirada en detalles de combate. |
| F08 | Investigación concluida sin API pública para enfocar una miniatura. No hay botón nuevo sin soporte. |
| F09 | Selector experimental de publicación «Solo total»; el registro GM conserva el desglose y los resultados nativos GM-only no se publican. Privacidad real pendiente de prueba con dos clientes. |
| F10 | Tooltip de experiencia existente conservado y cubierto por las pruebas; no se agregó otro indicador. Ticket abierto para validación del build instalado. |

## Catálogo y datos

Se conservaron capturas completas antes y después en `.tmp/monster-audit-2026-10-26/`, excluidas de Git y del paquete. No se modificó `.localstorage/`.

- Cuatro variantes de Caballero Resonante: reunida la continuación de Corrección del Eco con su rasgo.
- Troll de Hielo importado: reunidos los párrafos fragmentados en sus tres rasgos, conservando el texto.
- Gigante de Escarcha: Sabiduría corregida según la copia inglesa conservada.
- Cría de Dragón de Bronce, Diablo Óseo y Diablo Punzante: corregidas etiquetas de habilidad/salvación según sus pares conservados.
- Aboleth: recuperadas cuatro puntuaciones que un editor anterior había convertido a 10 al no reconocer las claves españolas. La normalización ahora reconoce esas claves.

La verificación posterior encontró **440 registros de campaña y 426 plantillas compartidas intactos**, diez y cuatro corregidos respectivamente, y **cero diferencias inesperadas** en los payloads. Incluye inventarios y campos ajenos a las reparaciones. Evidencia exacta: [cambios](monster-repairs-2026-10-26.json), [SQL ya aplicado](monster-repairs-2026-10-26.sql), [verificación](monster-repair-verification-2026-10-27.json).

[Auditoría inicial](monster-audit-2026-10-26.json) y [posterior](monster-audit-2026-10-27.json): los casos con alertas estructurales bajaron a cuatro. Coincidir con una fuente conservada no constituye un cotejo editorial completo de reglas. Diecisiete registros personalizados no coinciden literalmente con el catálogo compartido; eso incluye cambios intencionales y reparaciones documentadas.

Pendientes de fuente: fórmula `21d80+64` en las dos copias del Caballero del Eco Roto; PG/fórmula contradictorios en los Trolls de Hielo y un ataque sin nombre. Las criaturas personalizadas sin fuente independiente requieren revisión del GM. Enredadera ya conserva dos acciones multilínea; no se reemplazaron sus reglas.

## Base de datos

Aplicada `20261027024255_protect_character_administration.sql`: dos triggers, función con `search_path` vacío y sin ejecución directa para anon/authenticated. Comprueba el rol de miembro owner/GM para archivar, reactivar o borrar personajes, incluso mediante RPCs antiguas. Prueba reproducible: [character_administration.sql](../../supabase/tests/character_administration.sql); ensaya claims de jugador/owner y revierte todas las escrituras.

Los asesores de seguridad y rendimiento se consultaron antes y después. Las advertencias preexistentes sobre [funciones SECURITY DEFINER públicas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [índices de claves foráneas](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) no se alteraron en esta entrega. La función nueva es SECURITY INVOKER y no agrega endpoints públicos.

## Capacidades y comprobaciones pendientes

Las [API públicas](https://symbiote-docs.talespire.com/api_doc_v0_1.md.html) y el [esquema de URLs](https://talespire.com/url-scheme) ofrecen bookmarks, sin foco directo sobre una instancia de miniatura. Obtener su posición no habilita mover la cámara. Esta función depende de soporte externo.

«Solo total» usa resultados silenciosos y publicación de `result: { value: total }`. No garantiza ocultar un modificador deducible de las caras de los dados físicos. Verificar con un GM y un jugador la bandeja, dados, etiquetas, historial y mensajes antes de considerarlo privado.

La revisión visual se interrumpió cuando Computer Use no pudo verificar con confianza la URL de Chrome. No se realizaron más acciones de interfaz. Las pruebas de interfaz usan DOM automatizado; no equivalen a revisar la presentación dentro de TaleSpire ni a una sesión real con dos GMs y un jugador.

Distribuir el ZIP público 1.0.34 a todos los participantes para validar comunicación. El manifiesto local «Code» mantiene su canal aislado; el empaquetado restaura el nombre y canal públicos. Esta entrega genera un artefacto local y no publica en GitHub ni mod.io. Los tickets no se cerraron automáticamente.

## Validación de entrega

- `npm run typecheck`: correcto.
- `npx vitest run test/v2 --maxWorkers=2 --testTimeout=30000`: **137 archivos, 1274 pruebas correctas**. Incluye concurrencia de GMs, ascenso, entrega/ACK de iniciativa, botón de iniciativa de la hoja, administración, selector de invocaciones y edición de monstruos.
- Prueba SQL de permisos ejecutada con éxito y `ROLLBACK`; dos triggers activos, ejecución directa de la función denegada a anon/authenticated.
- `npm run package:modio`: correcto; ejecuta `npm run build:v2 -- --emptyOutDir=false` y verifica estructura y ausencia de secretos de servidor en el paquete. Advertencia existente de tamaño del bundle; sin errores de compilación.
- ZIP local: `release/Talespire_CharSheet-1.0.34-modio.zip`, seis archivos, manifiesto público 1.0.34 y canal `10f34bc9-dfa2-4623-a691-bf0a1fb2d9d4`.
- Build: `12549bec344f720717b4221cfd440a9f4c79dffc936e9a59a99e9a2ebbb9bb5b`, cotejado con el hash recalculado de los fuentes.
- SHA256 del ZIP: `E53A725901221C8CAF53172B904F4B155F67BD0163739C5BA5AC90221589BE1E`.

La revisión visual dentro de TaleSpire y las pruebas con clientes reales siguen pendientes según lo explicado arriba.
