# Catálogo de conjuros depurado — 16 de octubre de 2026

**Actualización posterior:** se [reemplazaron 274 entradas antiguas en las fichas](SPELL_OLD_REPLACEMENT.md), incluyendo Levantar maldición de Varka por Quitar maldición tras la confirmación del usuario. También se retiró Púas plateadas de Skitrixx por pedido del usuario. Quedan 315 entradas aprendidas y ninguna usa `old`. Las cifras de uso de 275 entradas `old` que aparecen abajo describen el estado al terminar la limpieza inicial. El catálogo continúa conservando sus 242 archivos antiguos, todos sin uso en ECE.

Se aplicó el criterio acordado: conservar las versiones españolas del tutorial, los custom de ECE y las versiones antiguas que ya usan las fichas. La limpieza afecta **la plantilla compartida y ECE**. Las copias de las otras 18 campañas no se modificaron.

## Resultado aplicado y verificado

| Clasificación | Plantilla compartida | ECE |
| --- | ---: | ---: |
| `manual_jugador` | 361 | 361 |
| `xanathar` | 95 | 95 |
| `custom` | — | 2 |
| `old` | — | 242 |
| Total | 456 | 700 |

Los 458 registros activos de ECE son los 456 del tutorial más **Forjar Constructo** y **Transferir Eco**. Están en español y usan las reglas de 2014. Los `old` están excluidos de las nuevas elecciones; conservan sus versiones originales, incluso cuando una entrada anterior estaba en inglés o usaba reglas de 2024. Se reemplazarán expresamente en otra tarea.

Cada fila resultante tiene una sola clasificación. Los favoritos conservan su mecanismo interno y no se muestran como otro origen; no había marcadores de favorito en las filas de conjuros depuradas.

Se sustituyeron las 1.629 filas anteriores de la plantilla por las 456 definiciones actuales del tutorial. En ECE se conservaron los identificadores de los dos custom, se retiraron 1.634 filas anteriores —incluida una que ya estaba borrada lógicamente— y se incorporaron las 456 actuales y 242 archivos `old`. No se restauró la fila inglesa de Word of Radiance que el usuario había borrado.

## Conjuros aprendidos: 316 entradas protegidas

| Situación | Entradas aprendidas |
| --- | ---: |
| Coinciden con las versiones actuales del Manual | 28 |
| Coinciden con las versiones actuales de Xanathar | 8 |
| Usos de los dos custom | 5 |
| Versiones anteriores conservadas como `old` | 275 |
| Total | 316 |

Las 275 entradas antiguas utilizan 242 definiciones diferentes. No son 242 personajes ni 242 conjuros necesariamente distintos: algunas versiones comparten nombre, pero difieren en descripción o datos. Se comparan las definiciones y no solo los nombres. La normalización de etiquetas equivalentes de escuela/daño y del orden de clases/componentes evita crear archivos redundantes por diferencias de representación.

Los datos persistidos de las 316 entradas aprendidas **no se reescribieron**: se comprobó su huella antes y después, incluyendo sus revisiones. La interfaz resuelve la procedencia del ejemplar aprendido contra la versión conservada y muestra `old`, manteniendo su texto y reglas. Esta comprobación también se realizó a través de los adaptadores reales de carga de la aplicación.

Las versiones inglesas generadas por tutoriales tempranos que no coinciden con el catálogo actual también se conservan como `old`. El nombre Mal de ojo de nivel 6 sigue correspondiendo a la versión de Eyebite de esa ficha; no se convirtió en Hex de nivel 1. Phantasmal Force de 2024 tampoco se convirtió silenciosamente en la variante de 2014.

La entrada Levantar maldición no tenía definición guardada. Se conservó una referencia `old` marcada como pendiente, con el nombre y nivel originales y sin inventar su efecto. Los dos usos custom sin definición se vinculan a su contenido de campaña, como ya permitía el catálogo.

## Aplicación

- Los 456 conjuros del generador llevan identificadores de catálogo estables y una clasificación de origen. Las claves de progresión del personaje no cambiaron.
- El selector de origen muestra Manual del Jugador, Xanathar, Custom y `old` cuando corresponde. El GM ya no tiene un cuadro libre para añadir clasificaciones contradictorias a un conjuro.
- Los `old` son visibles como versiones conservadas, con aviso de reemplazo pendiente y sin acciones de edición/eliminación en el catálogo. No aparecen como opciones nuevas de aprendizaje.
- La ficha conserva la definición `old` en vez de sustituirla por otra traducción o por una versión actual homónima al mostrarla. Tampoco se vuelve a guardar automáticamente un `old` como contenido nuevo al editar una ficha.
- El guardado de conjuros con origen simplificado no vuelve a añadir las antiguas etiquetas de idioma. Los lectores mantienen compatibilidad con las otras campañas.
- La carga permite mostrar archivos `old` en su idioma/edición anterior, mientras el catálogo activo queda en español/2014.
- La eliminación de un conjuro activo por nombre no puede seleccionar accidentalmente una versión `old` homónima.
- Se corrigieron las tres inconsistencias mecánicas concretas detectadas en el catálogo actual: Zancada prodigiosa dura una hora sin concentración; Garrote dura un minuto; Círculo de poder requiere concentración. Si una ficha había aprendido otra versión, se preservó como `old`.

La depuración no convierte las descripciones en una transcripción editorial certificada. Sigue vigente el cotejo de redacción documentado en la auditoría inicial; no se presentan como traducción oficial verificada los textos que no lo son.

## Recuperación y ejecución

Antes de aplicar cambios se guardaron los registros completos de la plantilla y de ECE, incluidos los borrados lógicos, las 316 entradas de conjuro de las fichas y las huellas de las otras campañas. La copia recuperable está en:

`tmp/spell-cleanup/backup-before.json.gz`

El directorio también contiene los JSON originales, `plan.json`, los resultados, huellas SHA-256 y `rollback.sql`. Contiene datos de campaña y está excluido de Git y del paquete distribuido. El script de recuperación verifica las huellas posteriores antes de restaurar, para no sobrescribir cambios más recientes por accidente. No se ejecutó la recuperación.

Herramientas reproducibles:

- `scripts/prepare-spell-catalog-cleanup.mjs`: prepara el plan desde las copias de lectura y comprueba que todas las versiones aprendidas sobreviven a la proyección de interfaz. No ejecuta SQL.
- `scripts/build-spell-cleanup-sql.mjs`: genera los scripts de aplicación/recuperación, la copia comprimida y sus huellas. No ejecuta SQL.
- `scripts/verify-spell-catalog-cleanup.mjs`: valida el resultado real exportado a través de los adaptadores de la aplicación.

La aplicación de datos se ejecutó como una transacción, con bloqueos breves y verificaciones de integridad de plantilla, ECE y conjuros aprendidos antes de eliminar registros. No hubo cambios de esquema ni instalaciones de funciones. No se modificó `.localstorage/` ni el directorio de respaldo Toolset.

## Validación completada

- 976 pruebas generales aprobadas; pruebas específicas de origen, conservación de versiones, carga y protección de homónimos aprobadas.
- Comprobación de tipos y compilación de producción aprobadas; salida actual `dist-v2/assets/v2-DJTqXxcg.js`.
- Los 700 registros de ECE cargan correctamente mediante el adaptador real: 458 activos y 242 `old`.
- Las 456 definiciones de base de datos coinciden con las que utiliza el tutorial.
- Las 316 entradas aprendidas conservan sus reglas y clasificación prevista al mostrarse.
- Texto, componentes y demás contenido de ambos custom conservados.
- Huella exacta de las 316 filas aprendidas sin cambios después de la operación.
- Huellas exactas de las copias de catálogo de las otras 18 campañas sin cambios.

Para continuar, el paso pendiente es elegir el reemplazo correcto de cada versión `old` en sus fichas y retirar su archivo únicamente cuando ninguna ficha siga usándolo. Esta entrega no ejecuta esos reemplazos.
