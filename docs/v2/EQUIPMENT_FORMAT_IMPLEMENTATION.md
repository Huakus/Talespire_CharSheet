# Formato, recuperación y preparación del catálogo de objetos

Estado actual al 18 de octubre de 2026: la [migración activa de inventarios y catálogo español](EQUIPMENT_MIGRATION_2026-10-18.md) está aplicada en ECE, revisión 1284. Hay 828 definiciones normalizadas, 241 copias de personajes y 24 existencias de comerciantes con referencias actualizadas. Otras 25 entradas permanecen apartadas para revisión. Se integraron los adaptadores descritos en ese informe y se conservan límites explícitos para los poderes asistidos; no se declara todo el catálogo definitivo o totalmente automatizado. Los 853 registros de preparación se conservan sin cambios como archivo de recuperación.

El resto de este documento relata las etapas de preparación anteriores, hasta la revisión 1212; sus pendientes y cifras corresponden a esas etapas. Continúa el [diseño del catálogo definitivo](ITEM_DEFINITIVE_CATALOG_SPEC.md).

## Implementado

### Contrato de preparación

`src/domain/equipment/equipment-definition.ts` define un formato independiente, identificado como `equipment-definition-draft`, versión 1. No se registra como payload activo de equipo para evitar que una interfaz que todavía no lo soporta lo normalice o pierda información.

La definición separa identidad, procedencia, clasificación, economía, descripción, requisitos, estadísticas, capacidades y recursos. No admite cantidad poseída, equipamiento, sintonización actual ni cargas actuales. Los campos desconocidos se rechazan explícitamente, sin descartarlos silenciosamente al guardar.

Las descripciones permiten párrafos, listas y tablas con referencia de fuente y condición editorial. Se preserva el texto exacto, incluidos espacios y saltos. La procedencia distingue texto oficial español, traducción revisada, contenido de campaña y material sin revisar. Se valida la estructura rectangular de las tablas y la existencia de fuentes y bloques referenciados.

El borrador representa costes, disparadores, requisitos, duración, daño condicionado, bonos que suman/fijan/establecen mínimos, curación, conjuros, condiciones, defensas, movimiento, almacenamiento y reglas todavía no representadas. Esas declaraciones **no son una implementación de sus efectos**. Las mecánicas singulares pueden conservar el contenido original como `unmodeled`, que bloquea la finalización.

El comprobador de completitud exige una política explícita y registro de adaptadores verificados. Detecta referencias inexistentes, identificadores repetidos, recursos incompletos, costes imposibles, requisitos desconocidos, revisiones pendientes y efectos sin soporte. Una acción narrativa no puede ocultar un efecto sobre la ficha ni descontar recursos sin un adaptador que lo haga. El formato sin integración de plataforma también bloquea la finalización.

Este comprobador es una condición necesaria de contenido, no una autorización de migración o borrado. La cobertura de recuperación, los usos antiguos y las comprobaciones de campaña deben validarse por separado. Actualmente no se asigna la etiqueta `definitiva` ni se registra ningún adaptador nuevo de ejecución.

### Conservación y cobertura de información

`src/domain/equipment/equipment-recovery.ts` captura filas originales completas y las identifica mediante SHA-256. La captura no pasa por el normalizador heredado de equipo. `src/shared/lossless-json.ts` valida JSON sin reconstruir ni eliminar claves desconocidas; rechaza funciones, valores indefinidos, ciclos y otras entradas que no sobrevivirían a una serialización JSON.

Se conserva la diferencia entre cero, falso, null, objetos vacíos y listas vacías. Cada campo original puede quedar incorporado, representado por un duplicado real, conservado en una variante/copia personal o descartado por un error justificado. Se requieren motivo y revisión explícita. Los destinos deben existir; una decisión de duplicidad comprueba además que el valor sea igual. Una traducción o transformación requiere revisión y no se certifica por comparación automática de texto.

Una copia de seguridad no marca la recuperación como completa. Todo campo sin resolución queda pendiente. Tampoco basta con completar esta contabilidad para declarar correctas las reglas o permitir una eliminación.

### Referencias en stock de comerciantes

Se corrigió `src/domain/content/content-payload.ts`: guardar un monstruo/NPC conserva ahora el campo `catalog` de cada objeto de su inventario. La metadata del NPC sigue fuera de su propio payload; las referencias de sus posesiones se conservan donde corresponden. Los payloads anteriores que no incluían ese campo siguen cargando con referencia nula.

Las pruebas comprueban la conservación de ID de instancia, referencia/revisión de catálogo, nombre personal, cantidad y cargas actuales a través de serialización y recarga, incluido el flujo de guardado del almacén remoto simulado. Esta corrección aplica a futuras escrituras realizadas por esta versión; no se modificaron NPC existentes mediante SQL.

## Material de trabajo preparado

`scripts/prepare-equipment-definition-workspace.mjs` trabaja con exportaciones locales y no se conecta a la base. Captura y vuelve a verificar todos los originales, conserva capturas anteriores si cambian las entradas de origen y mantiene las decisiones de revisión en un archivo separado que no sobrescribe.

| Material | Registros |
| --- | ---: |
| Catálogo compartido | 1.572 |
| Catálogo de ECE | 1.609 |
| Copias de personajes de ECE | 241 |
| NPC con stock o vinculados a tiendas, incluyendo un inventario vacío vinculado | 5 |
| Tiendas de ECE | 5 |
| Total de originales archivados y verificados | 3.432 |

La cuenta incluye las filas completas de NPC y tiendas, no solo las descripciones de sus objetos. Hay 106.893 valores/campos originales pendientes de revisión, incluyendo metadata técnica; no son 106.893 errores ni reglas. No se resolvieron ni descartaron automáticamente para reducir esa cuenta.

Los catálogos e inventarios proceden de las instantáneas verificadas de la fase anterior. El contexto de comerciantes se obtuvo mediante SELECT durante esta entrega, conservando tanto versiones inglesas como españolas con stock y las asociaciones de tiendas. Se deberán refrescar todas las entradas relevantes antes de una migración activa: este archivo de trabajo no se presenta como una instantánea transaccional actual de toda la campaña.

El archivo completo y su índice están en `tmp/equipment-definitions/`, excluido del repositorio. El [resumen de preparación](equipment-format-2026-10-17/preparacion.json) registra conteos y checksum. No se modificó `.localstorage/`.

## Siete ejemplos de formato

Los [ejemplos exportados](equipment-format-2026-10-17/ejemplos-sinteticos.json) son sintéticos, independientes de las reglas de los manuales y del equipo de los personajes:

| Ejemplo | Qué comprueba |
| --- | --- |
| Equipo sencillo | Definición sin poderes, precio desconocido y conservación exacta de texto. |
| Arma condicionada | Daño base y adicional separados con condición y disparador. |
| Armadura | CA base, Destreza, límites y bonificación separados. |
| Reserva finita | Usos que explícitamente no se recuperan; coste que necesita ejecución registrada. |
| Objeto que concede un conjuro | Conjuro, nivel, atributo, requisitos, coste y recuperación aleatoria. |
| Almacenamiento | Capacidad separada del contenido que deberá conservar cada copia. |
| Dispositivo custom complejo | Listas, tablas y regla singular preservada que todavía bloquea la finalización. |

Todos sobreviven a serializar y volver a cargar. Todos siguen como borradores: la [validación de ejemplos](equipment-format-2026-10-17/validacion-ejemplos.json) muestra los bloqueos, sin atribuir soporte de ejecución que no existe.

## Decisiones confirmadas por el usuario

1. Conservar los objetos oficiales existentes de otras fuentes y validar sus reglas originales de 2014, sin ampliar las opciones del generador de personajes.
2. Admitir una traducción fiel revisada desde el inglés, identificada como propia, cuando falte la oficial española; preferir esta última cuando se consiga.
3. Admitir efectos automáticos o una resolución asistida explícita. Enumerar lo que aún falta automatizar; declarar un procedimiento manual no equivale a implementar un adaptador.
4. «Hoja Fásica» pertenece exclusivamente a la variante de Daga del Umbral de Stix. Las demás dagas conservan sus reglas.

La política vive en `src/domain/equipment/equipment-policy.ts`. Los candidatos sin cotejar no reciben procedencia oficial ni reglas por inferencia. Los conflictos de campaña que no cubren estas respuestas quedan expresamente abiertos.

## Interfaz y persistencia de preparación

En **Control de GM → Contenido → Equipo → Catálogo definitivo en preparación**, el GM puede preparar un objeto existente, crear un borrador, buscarlo, editar datos básicos, fuentes, párrafos, listas y tablas, e importar/exportar el registro completo. El acceso es un desplegable situado encima del buscador de objetos, no una pestaña independiente. Las capacidades y recursos se conservan aunque todavía no todos sus campos tengan controles de edición específicos. Se muestran los originales, bloqueos de completitud y tareas de automatización.

`equipment-preparation` es un envoltorio de payload de versión 2 para la definición, archivos originales y decisiones de recuperación. Se guarda bajo una clave independiente `gm:equipment:preparation:…`, con revisión optimista y verificación de los originales. Las listas activas de equipo lo separan; los clientes anteriores tampoco lo interpretan como un objeto utilizable. Guardar un borrador no sobrescribe por nombre una definición antigua ni la convierte en definitiva.

La edición preserva textos no modificados, incluidos saltos de línea y espacios. Los errores de validación o guardado conservan el trabajo en el formulario. Se impiden cambios de selección que descarten una edición abierta. La revisión se invalida al modificar contenido.

Esta separación es funcional, no una nueva frontera de privacidad: las filas usan las reglas de acceso de contenido de campaña existentes. No se deben interpretar las notas del GM como almacenamiento secreto frente a miembros con acceso al catálogo.

## Catálogo real y piloto guardado

`scripts/prepare-real-equipment-drafts.mjs` preparó **806 borradores locales** que conservan las **803 entradas inglesas de ECE**, además de sus contrapartidas españolas y compartidas. Las relaciones bilingües son candidatos de cotejo; no certifican equivalencias ni combinan automáticamente poderes. Se recuperaron 81 capacidades candidatas y se enumeraron 243 tareas de automatización; son un punto de partida, no una auditoría funcional completa.

El [resumen local](equipment-preparation-2026-10-17/preparacion-real.json) y la [lista de automatización](equipment-preparation-2026-10-17/automatizacion-pendiente.json) describen ese material. Los archivos completos de trabajo permanecen en `tmp/equipment-definitions/`.

Se guardó un **piloto de 12 borradores en ECE**, tras una simulación con rollback y guardas de concurrencia. Incluye las dos dagas del Umbral, el collar de hablar con los muertos, Núcleo Luciente, la varita de Armadura de Mago, el bastón del marchitamiento, Perla de Poder, Munición +1, Poción de curación, Guanteletes de Fuerza de Ogro, Anillo de Almacenamiento de Hechizos y Reloj de arena. Siguen pendientes de cotejo y no conceden poderes nuevos.

La [verificación del piloto](equipment-preparation-2026-10-17/piloto-verificado.json) confirma 1.609 filas antiguas de equipo y la misma proyección española activa de 806 objetos. No cambiaron los originales de catálogo, fichas, versiones de personajes, stock de NPC, catálogo compartido ni contenido de otras campañas. Se verificaron por checksum los originales completos guardados en los borradores. La revisión de campaña pasó de 1.167 a 1.168.

La variante de Stix se distingue de la daga base. El mismo identificador antiguo aparece también en copias de otros personajes: la futura sustitución tendrá que resolverse por copia, no mediante una redirección global que conceda «Hoja Fásica» a todos.

En la etapa del piloto se mantuvieron los demás borradores localmente hasta separar la carga del material de revisión. Esa separación y la publicación del conjunto se completaron en la etapa siguiente, descrita más abajo.

### Primer cotejo de contenido real

Después del piloto se contrastaron **11 definiciones de equipo básico** con las tablas/reglas originales de 2014 y las páginas 125 y 127 del PDF español aportado. Incluye Ábaco, Almádena, Balanza de mercader, Campanilla, Espejo de acero, Martillo, Pala, Pico de minero, Reloj de arena, Piedra de afilar y Poción de curación.

Se corrigieron nombres, se separaron precio base y precios propios, se dejaron los pesos no especificados como desconocidos y se representó la curación/consumo de la poción sin atribuirle ejecución ya implementada. Los textos nuevos son traducciones propias revisadas: cotejar el PDF aportado no acredita por sí solo que su traducción corresponda a la edición española oficial. No se convirtió en cero el guion del peso de Campanilla ni se conservó por defecto «ninguna» como rareza de una poción mágica.

La [revisión de fuentes](equipment-preparation-2026-10-17/cotejo-equipo-basico.json) alimenta `scripts/review-equipment-basic-batch.mjs`. Se documentaron y comprobaron **220 destinos de campos originales**; la cobertura total de recuperación sigue abierta. El script no altera los archivos originales ni opera sobre inventarios.

Esta revisión se guardó mediante otra transacción simulada y protegida: actualizó dos borradores del piloto y añadió nueve. Hay ahora **21 borradores guardados en ECE**, once de ellos con este primer cotejo; continúan sin ser objetos definitivos. La [verificación posterior](equipment-preparation-2026-10-17/cotejo-guardado-verificado.json) confirma que las 806 opciones españolas activas, los catálogos antiguos, fichas, stock, versiones y otras campañas permanecen iguales. La revisión de ECE es 1.169. La verificación del piloto anterior se conserva como evidencia histórica de esa etapa.

## Validación y trabajo pendiente

Pasaron TypeScript, 114 pruebas en doce archivos —contrato, recuperación, política, preparación, editor, persistencia, payloads, NPC, comercio, interfaz y transferencia de contenido— y `npm run build:v2 -- --emptyOutDir=false`. La preparación local verificó la recarga íntegra de los 3.432 originales y las verificaciones de escritura confirmaron que las 806 opciones activas no cambiaron. Se revisó visualmente la interfaz renderizada con los registros del piloto en un navegador local aislado. No se modificó `.localstorage/`.

Falta cotejar identidad, texto y reglas de todas las familias; completar estadísticas; resolver conflictos y cobertura de recuperación; implementar y probar adaptadores de efectos y recursos; integrar tutorial, comercio e inventarios con el formato nuevo, y preparar la simulación de migración por copia. No se declaró ningún objeto definitivo, no se migró ninguna posesión y no se borraron versiones antiguas.

Continúa vigente el orden: primero completar la base entera y sus funciones declaradas; después migrar los usos; por último retirar versiones sin uso y la etiqueta temporal.

## Catálogo de preparación completo y carga bajo demanda

La colección de **806 borradores ya está guardada en ECE**: se añadieron los 785 que faltaban mediante ocho lotes protegidos, conservando íntegramente los 21 existentes. Antes del primer guardado se ejecutó una simulación con rollback. Cada lote comprobó los originales protegidos, la revisión de campaña, la colección de preparación anterior y la igualdad completa de los payloads insertados. Se rechazaban destinos existentes en lugar de sobrescribirlos.

El [informe del conjunto guardado](equipment-preparation-2026-10-17/catalogo-guardado-verificado.json) verifica las claves completas, las ocho revisiones consecutivas de guardado y los checksums posteriores. Las 1.609 filas antiguas de equipo, las fichas, stock, versiones de personajes, catálogo compartido y otras campañas no cambiaron. La revisión de ECE es 1.177. Los 3.181 originales de catálogo incluidos en esta colección vuelven a validar sus SHA-256; cubren las 803 entradas inglesas de ECE.

La carga normal usa `listCampaignContent(campaignId, "active")`: el filtro se aplica en el servidor e incluye correctamente los payloads antiguos sin campo `format`. La proyección activa también descarta preparaciones como defensa adicional. Los archivos de cotejo, aproximadamente 7 MB sin comprimir, se solicitan únicamente al abrir la sección de preparación mediante `loadEquipmentPreparations()`. Se mantiene una caché independiente y el guardado de un borrador no contamina el catálogo activo.

El GM puede actualizar explícitamente los borradores. La carga inicial no entra en un bucle de reintentos si falla, y la actualización se bloquea mientras hay una edición abierta. La pantalla muestra el progreso de cotejo: **11 con identidad, texto y reglas revisados; 795 pendientes de ese cotejo**. Esos once todavía necesitan cerrar la recuperación de información y la integración correspondiente: no hay ningún objeto definitivo.

Pasaron **135 pruebas en dieciséis archivos**, TypeScript y la compilación con `--emptyOutDir=false`. Las pruebas adicionales cubren la separación de consultas mediante el SDK instalado, el filtro que conserva los formatos antiguos, la carga al abrir, el reintento explícito y la conservación de la edición ante errores de conexión. Si el guardado se confirma y luego falla la recarga, la pantalla conserva el registro y su revisión devueltos por el servidor e informa que el cambio sí se guardó. También se comprobaron las rutas de arranque remoto y colaboración de GM/jugadores.

El siguiente trabajo de contenido sigue siendo completar los 795 cotejos pendientes y las mecánicas de cada familia. La disponibilidad de los 806 borradores resuelve su acceso y conservación; no certifica sus reglas ni adelanta la migración de posesiones.
