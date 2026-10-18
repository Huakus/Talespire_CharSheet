# Clasificación inicial de objetos

17 de octubre de 2026. Aplicada a Supabase: catálogo compartido y campaña ECE. Las copias de las otras campañas se conservaron. Criterios: [organización acordada](ITEM_ORGANIZATION_CRITERIA_DRAFT.md).

Se clasificaron 1.572 definiciones compartidas y 1.609 de ECE. Cambiaron las etiquetas de 3.180 filas: 1.572 compartidas y 1.608 de ECE; el collar de hablar con los muertos ya tenía su única etiqueta necesaria, `custom`. No se eliminaron entradas ni se modificaron nombres, descripciones o reglas.

## Etiquetas controladas

| Etiqueta | Significado |
| --- | --- |
| `manual_jugador` | Fuente declarada: Manual del Jugador. No certifica todavía el texto. |
| `xanathar` | Fuente declarada: Guía de Xanathar para Todo. No certifica todavía el texto. |
| `custom` | Contenido de campaña identificado expresamente. No se deduce de `imported`. |
| `fuente_pendiente` | No hay identificación bibliográfica inequívoca. `official` tampoco la demuestra. |
| `pendiente_traduccion` | Inglés sin correspondencia española identificada. Preparada para futuros casos; actualmente no hay filas en este grupo. |
| `revisar_equivalencia` | Inglés con uno o más candidatos españoles. Falta confirmar integridad y equivalencia. |
| `descripcion_pendiente` | Descripción vacía. |
| `revisar_descripcion` | Señales de HTML, serialización, escapes, codificación dañada o dos campos de texto distintos. |
| `revisar_datos` | Categoría no canónica, daño ambiguo, recuperación sin especificar o definición que no carga. |
| `revisar_funciones` | El texto menciona cargas sin recurso o conjuros sin capacidades estructuradas. Es una señal para investigar: no confirma una concesión de conjuro ni un fallo funcional. |
| `conflicto_version` | Mismo nombre e idioma con datos de reglas diferentes. Son candidatos que deben revisarse antes de fusionar. |
| `version_local` | La definición de ECE difiere de la compartida con la misma clave. Puede ser un cambio intencional o un error; la etiqueta no decide cuál. |

Fuente, revisión editorial, revisión funcional y diferencias de versión son dimensiones distintas. Las etiquetas de revisión pueden superponerse. No se ha asignado ninguna certificación de texto completo, traducción oficial o automatización verificada.

Los marcadores técnicos heredados (`es`, `eng`, `official`, `gm`, `imported`, `legacy`, `phb`, `xge`) se conservan en almacenamiento para no romper cargas, importaciones o metadatos existentes. La interfaz oculta ese ruido y muestra las etiquetas controladas con nombres legibles. Para campañas sin migrar, `phb` y `xge` se presentan con los mismos nombres de fuente sin escribir sus datos. Se preservaron `favorite`, `ece` y las agrupaciones personales.

## Resultado entre las entradas españolas de ECE

| Grupo | Entradas |
| --- | ---: |
| Total visible en español | 806 |
| Manual del Jugador declarado | 2 |
| Xanathar declarado | 48 |
| Contenido de campaña confirmado | 3 |
| Fuente pendiente | 753 |
| Sin descripción | 102 |
| Revisar descripción | 80 |
| Revisar datos | 110 |
| Revisar funciones | 171 |
| Conflicto de versión | 18 |
| Versión local | 20 |

Las 753 fuentes pendientes incluyen importaciones y entradas con origen de fila `official`; no se inventó su libro. Los tres objetos de campaña confirmados son el collar de hablar con los muertos y las dos definiciones de Daga del Umbral.

## Versiones inglesas

Se acepta el criterio del usuario: **cuando exista una versión española equivalente y completa, conservar solo la española**. No se mantendrá la inglesa activa como referencia por defecto.

En ECE hay 803 entradas inglesas y todas tienen al menos un candidato español por índice, nombre o correspondencia revisada de nombres. Eso no prueba que las traducciones estén completas. Algunas incluyen descripciones vacías, reglas adaptadas o versiones divergentes. Esta fase solo aplicó etiquetas: no retiró ninguna candidata antes de comprobarla. Las correspondencias por nombre añadidas expresamente pueden consultarse en `scripts/prepare-equipment-tags.mjs`; no establecen identidades definitivas.

Las entradas inglesas siguen fuera del catálogo habitual español. Se consultan por ahora en el [informe de correspondencias](item-tags-2026-10-17/correspondencias-ingles.csv). No se implementó todavía un área específica para editarlas en la interfaz.

## Interfaz y verificación

- Filtros y tarjetas del catálogo, inventario y comercio muestran nombres legibles de las etiquetas; las búsquedas admiten esos nombres.
- Las copias poseídas consultan primero su clave de catálogo, incluso si se renombraron. Cuando solo hay un nombre y varias definiciones, no se toma arbitrariamente una. Sus datos personales permanecen intactos.
- Se comprobó la igualdad de todas las definiciones antes y después, incluidas las proyectadas por el cargador real: siguen cargando 789 entradas españolas compartidas y 806 de ECE.
- Los checksums de todos los fragmentos de campaña, del contenido protegido de otras campañas y de las entradas compartidas que no son equipo se conservaron. Los 241 objetos de inventarios de ECE permanecen iguales.
- La operación incrementó las revisiones de las filas de ECE modificadas y la revisión de campaña de 1166 a 1167.
- Validación: TypeScript, 71 pruebas de clasificación/interfaz/persistencia y compilación con `npm run build:v2 -- --emptyOutDir=false`.

Archivos de revisión: [clasificación de ECE](item-tags-2026-10-17/clasificacion-ece.csv), [resumen](item-tags-2026-10-17/resumen.json) y [verificación](item-tags-2026-10-17/verificacion.json).

Preparación reproducible sin conexión: `scripts/prepare-equipment-tags.mjs`; comprobación de exportaciones posteriores: `scripts/verify-equipment-tags.mjs`. Copia completa comprimida, checksums, SQL aplicado, simulación con rollback y recuperación protegida: `tmp/item-tags/`, excluido del repositorio. Los scripts no ejecutan SQL por su cuenta. No se modificó `.localstorage/`.
