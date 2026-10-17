# Etiquetas de conjuros: revisión y propuesta

**Histórico:** la propuesta de varias dimensiones de este documento fue reemplazada por el criterio simplificado pedido por el usuario. La aplicación real, sus cantidades y verificaciones están en [Catálogo de conjuros depurado](SPELL_CATALOG_CLEANUP.md).

Revisión de solo lectura del 16 de octubre de 2026. Complementa la [auditoría de catálogos](SPELL_CATALOG_UNIFICATION_AUDIT.md). **No se cambiaron etiquetas, conjuros, fichas ni datos de campaña.** Los archivos de propuesta no son una migración ejecutable.

## Hallazgo principal

Existen ocho etiquetas en los conjuros activos: `official`, `gm`, `imported`, `legacy`, `xge`, `2024`, `es` y `eng`. No hay valores vacíos, repeticiones dentro de una fila, espacios sobrantes ni diferencias de mayúsculas. Tampoco hay filas con ambos idiomas ni con `legacy` y `2024` simultáneamente.

La limpieza necesaria es **de significado y cobertura**: hoy se mezclan autoría, procedencia de importación, libro, edición e idioma en una sola lista. Varias clasificaciones son incompletas o engañosas.

El inventario individual utiliza 1.635 filas: 1.629 de la plantilla compartida y seis importaciones de ECE. No vuelve a contar las copias de la plantilla en cada campaña. También se consultaron las 30.957 filas de conjuros activos de las 19 campañas para comprobar el vocabulario y su consistencia.

## Qué hacer con cada etiqueta actual

| Etiqueta | Plantilla compartida | Importaciones ECE | Validez actual | Recomendación |
| --- | ---: | ---: | --- | --- |
| `official` | 1.629 | 0 | Útil para distinguir contenido oficial, pero también marca las dos traducciones de Asfixiar, que es de terceros. No certifica exactitud del texto | Conservar el concepto «Oficial», corregir la clasificación de terceros y derivarlo de una categoría explícita |
| `gm` | 0 | 6 | Cuatro filas son las dos creaciones de ECE; dos son Fuerza fantasmal oficial importada. No equivale a autoría propia | Sustituir como clasificación por «De campaña» solo donde corresponda. No convertir cualquier importación del GM en homebrew |
| `imported` | 0 | 6 | Correcta como procedencia técnica, redundante con el campo `origin` de estas filas | Conservar en procedencia/historial; retirarla del filtro de tipo de conjuro |
| `legacy` | 193 | 6 | Ambigua: solo aparece en Xanathar y las importaciones; falta en los otros 732 registros sin etiqueta 2024. Incluye una importación oficial y conjuros de campaña | Reemplazar por edición explícita. Retirar tras adaptar lectores y persistencia. No inferir «2014» solamente por esta etiqueta |
| `xge` | 193 | 0 | Válida: las filas se corresponden con las 95 identidades de Xanathar y sus duplicaciones/traducciones | Conservar su información como libro; normalizar a `book:xge` y mostrar «Guía de Xanathar para todo» |
| `2024` | 704 | 0 | Útil como edición declarada, pero faltan las dos filas legacy de Starry Wisp. Las 704 no identifican su libro en el campo de fuente | Normalizar a edición 2024, corregir Starry Wisp y cotejar fuente. No asignar PHB 2024 a todas por deducción |
| `es` | 815 | 3 | Útil y funcional: participa en la carga de contenido español | Mantener el idioma como dato explícito. En la nueva representación, `lang:es`; conservar compatibilidad hasta cambiar los lectores |
| `eng` | 814 | 3 | Útil y funcional: identifica contenido inglés que hoy no se carga en la vista española | Normalizar el idioma a `en` y, si se proyecta como etiqueta, `lang:en`. Conservar alias de lectura para `eng` |

Las cantidades son **filas**, no conjuros distintos, y cada fila tiene varias etiquetas. No deben sumarse como cantidades de conjuros.

`favorite` también tiene significado para el código: controla favoritos y se oculta de los filtros generales. No apareció en ninguna fila activa de conjuro consultada. Debe preservarse si aparece durante la migración; no es una etiqueta de autoría, libro o reglas. Las futuras etiquetas libres del GM también deben conservarse.

## Clasificación recomendada

Recomiendo guardar las decisiones importantes en campos validados y producir las etiquetas visibles a partir de ellos. Las etiquetas libres quedarían para organizar la campaña. Así un cambio en un nombre visible no puede alterar edición o disponibilidad.

| Dimensión | Representación propuesta | Qué se muestra |
| --- | --- | --- |
| Tipo de contenido | `content:official`, `content:third-party`, `content:homebrew` | Oficial, De terceros, De campaña |
| Reglas de la variante | `rules:2014`, `rules:2024` | D&D 2014, D&D 2024 |
| Libro o publicación | `book:phb-2014`, `book:xge`, `book:tcoe`, `book:ftod`, `book:scc`, `book:llok`, `book:loe` | Nombre completo del libro en español cuando esté identificado |
| Idioma del texto | `lang:es`, `lang:en` | Español, Inglés |
| Variante creada para la campaña | `variant:campaign`, con vínculo a la definición de origen | Variante de campaña |
| Organización libre del GM | Por ejemplo `eco`, `constructos` | Las palabras elegidas por el GM |

`book:phb-2024` sería válido cuando la fuente esté identificada, como en Starry Wisp. Para los registros 2024 sin fuente, dejar el libro pendiente; no inventar una atribución para llenar el filtro. Los códigos son internos: el usuario debería ver «Manual del Jugador 2014», «Guía de Xanathar para todo», etc.

Cada **variante** tiene una edición de reglas. Cada **traducción** tiene un idioma. Una misma identidad puede tener traducciones en ambos idiomas y variantes de distintas ediciones, sin presentarlas como un único registro contradictorio. Si hay varias publicaciones verificadas de la misma variante, se conservan sus referencias; el filtro puede encontrar cualquiera de ellas.

En los campos de datos conviene distinguir:

- Identidad del conjuro y, cuando corresponda, identidad de la variante original.
- Tipo de contenido: oficial, tercero o creación de campaña.
- Edición de reglas, separada del año de publicación. Un libro posterior a 2014 puede usar las reglas de 2014.
- Referencias de fuente: libro, edición/impresión, idioma y página.
- Idioma y estado del texto: pendiente de cotejo o cotejado contra una edición concreta. «Oficial» no significa «traducción oficial verificada».
- Procedencia técnica: importación, plantilla compartida o creación local, conservando `origin` y los identificadores existentes durante la transición.
- Disponibilidad por campaña y uso en el tutorial. Estar etiquetado como oficial no concede automáticamente disponibilidad ni acceso por clase.

Estos conceptos no deben depender de que el GM escriba correctamente una etiqueta libre. Los prefijos reservados se gestionarían desde controles específicos, con etiquetas legibles, y no desde el cuadro libre «Etiquetas de campaña».

## Ejemplos aplicados al inventario

| Conjuro | Clasificación propuesta | Observación |
| --- | --- | --- |
| Rayo de fuego / Saeta de fuego | Oficial · D&D 2014 · Manual del Jugador 2014 · Español | Mismo conjuro con alias; las etiquetas no sustituyen su identificador |
| Absorber elementos | Oficial · D&D 2014 · Xanathar · Español | Conservar la procedencia de Xanathar utilizada por el proyecto |
| Forjar Constructo | De campaña · D&D 2014 · Español; ámbito ECE | Sigue siendo una importación técnica, pero no un conjuro de un libro oficial |
| Transferir Eco | De campaña · D&D 2014 · Español; ámbito ECE | Conservar texto y materiales propios |
| Fuerza fantasmal importada | Oficial · D&D 2014 · Manual del Jugador 2014 · Español/Inglés en sus traducciones | Quitar la clasificación de autoría GM; conservar que fue importado |
| Púas plateadas | Oficial · D&D 2014 · Strixhaven · Español | Otro suplemento oficial; disponibilidad de campaña por decidir |
| Asfixiar / Suffocate | De terceros · D&D 2014 · Lairs of Etharis · Español/Inglés en sus traducciones | El `official` actual no es una clasificación válida de su autoría |
| Starry Wisp en el grupo antiguo | Oficial · D&D 2024 · Manual del Jugador 2024 | Corregir también la edición de datos, no únicamente agregar una etiqueta |
| Una modificación real del GM sobre un conjuro oficial | De campaña · Variante de campaña · edición correspondiente | Vincular la base oficial sin presentar la modificación como texto oficial |

La etiqueta de campaña no debe incluir el nombre «ECE» como identidad técnica: ya existe un identificador de campaña. El nombre puede cambiar. El ámbito se guarda como dato y la interfaz muestra el nombre actual.

Modificar solo etiquetas o normalizar campos no convierte un conjuro en una variante del GM. Las siete diferencias de almacenamiento detectadas en la auditoría anterior son equivalentes al normalizarlas: no se propone marcarlas como siete variantes de campaña.

## Cobertura que falta

- No hay etiqueta explícita de libro para el Manual, Tasha, Fizban, Strixhaven, Kwalish ni Etharis. `official` por sí sola no distingue estos grupos.
- No hay etiqueta `2014` en la base. La aplicación suele obtener ese valor por defecto si falta el año, lo que oculta los dos Starry Wisp mal clasificados.
- Los nueve conjuros de otros suplementos de Wizards están mezclados con el grupo sin `xge`. Por eso **«no tiene xge» no implica «es del Manual»**.
- Los 456 conjuros evaluados del generador tienen `catalog: null`. La información de libro puede derivarse de sus archivos actuales, pero no llega como metadato de catálogo al filtro general. La propuesta incluye una fila para cada uno.
- Las 704 filas etiquetadas 2024 no declaran `source`; su libro debe identificarse por registro. La propuesta conserva la edición declarada sin certificar por ello toda su procedencia o descripción.
- En 14 filas bilingües de la propuesta se mantienen libros señalados como pendientes de confirmar por la auditoría anterior. Son las siete identidades de Tasha/Fizban/Kwalish; no deben migrarse como referencias certificadas sin ese cotejo.

No es conveniente duplicar mediante etiquetas el nivel, las clases, la escuela, los componentes, la concentración, el ritual o el tipo de daño: ya tienen campos propios y varios filtros existentes. Pueden mostrarse como distintivos derivados de esos campos.

## Dependencias del código que impiden limpiar las etiquetas aisladamente

1. **Idioma:** `isSpanishCampaignContent` lee etiquetas, segmentos del identificador y campos de idioma. Reconoce `es`, `eng`, `en` y otros alias, pero no los prefijos propuestos `lang:es`/`lang:en`. Retirar las etiquetas actuales sin adaptar este lector puede ocultar entradas. No debe dependerse de que el idioma siga apareciendo por casualidad en una clave antigua.
2. **Guardado:** `spanishTags` agrega `es` al guardar y elimina los marcadores lingüísticos actuales. Si no se adapta, reintroduciría etiquetas antiguas o conservaría marcadores nuevos incompatibles. La serialización actual fija idioma español para los registros que edita esta interfaz.
3. **Edición:** el normalizador usa el campo `year` y asume 2014 si falta; no interpreta la etiqueta `2024` como fuente de verdad. Los filtros y el catálogo del jugador utilizan ese año. Cambiar solo etiquetas no cambia de manera fiable la edición utilizada.
4. **Autoría frente a procedencia:** el modelo de `origin` admite `official`, `gm` e `imported`, y varias decisiones de prioridad consultan ese campo. La etiqueta `gm` no activa esas decisiones. Agregar o quitarla no resuelve por sí mismo la clasificación de las importaciones de campaña. Hay que separar procedencia de tipo de contenido, sin reescribir identificadores ni cambiar a ciegas los orígenes históricos.
5. **Localización y combinación:** la interfaz puede sustituir una definición inglesa por la local y dar prioridad a definiciones del generador sin metadatos. Deducir etiquetas únicamente desde la base deja esos conjuros sin clasificación visible. Deben conservarse al resolver la identidad y la traducción.
6. **Filtros:** hoy las etiquetas del jugador se combinan con «cualquiera de las seleccionadas». Para filtrar «Oficial» y «Xanathar» como dos condiciones se necesitan grupos separados. Dentro de «Libro», seleccionar Manual y Xanathar debe aceptar cualquiera de esos dos; entre dimensiones se deben cumplir todas las condiciones elegidas.
7. **Edición libre:** el formulario del GM permite escribir las etiquetas de la fila. Los metadatos reservados deben protegerse de ese campo; las etiquetas libres y favoritos deben conservarse.
8. **Copias por campaña:** actualizar la plantilla compartida no actualiza las filas existentes al volver a sembrarla: la operación omite los conflictos. Una migración futura debe considerar la plantilla y sus copias, preservando cambios de campaña y revisiones.

Referencias revisadas: `src/infrastructure/remote/supabase-campaign-content-store.ts`, `src/domain/content/catalog-metadata.ts`, `src/domain/content/content-payload.ts`, `src/domain/spells/spell-catalog.ts`, `src/domain/character/phb-spells.ts`, `src/ui/localized-spells.ts`, `src/ui/browser-app.ts`, `src/ui/gm-tools-panel.ts` y las funciones actuales de lectura/guardado/siembra de contenido. Ninguna función de escritura fue ejecutada.

## Orden propuesto para la limpieza

1. Establecer las dimensiones validadas y la correspondencia entre etiquetas anteriores y nuevas. Mantener un estado pendiente para fuentes e identidades no resueltas.
2. Adaptar carga, guardado, traducción y filtros para que lean las representaciones anteriores y nuevas durante la transición. Mantener claves, usos y revisiones.
3. Generar metadatos para los 456 conjuros del generador y consultar un catálogo común desde el tutorial y la ficha.
4. Revisar la propuesta por registro. Resolver especialmente Hex/Eyebite, Starry Wisp y las referencias de libro pendientes.
5. Preparar una simulación de migración, con respaldo y comprobación de fichas. Actualizar plantilla y copias por campaña sin borrar etiquetas libres ni favoritos.
6. Retirar las etiquetas antiguas redundantes cuando todos los consumidores utilicen los datos normalizados. No cambiar simultáneamente nombres o descripciones como efecto secundario de limpiar etiquetas.

Comprobaciones necesarias para esa implementación: visibilidad de ambos idiomas, conservación de favoritos, persistencia sin reintroducir etiquetas antiguas, filtros por dimensiones, respeto de edición, presencia de conjuros de campaña en el tutorial según disponibilidad, y ausencia de cambios en las definiciones guardadas en fichas por el solo hecho de retaggear.

## Archivos de propuesta individual

- [Frecuencia de etiquetas actuales](spell-audit-2026-10-16/etiquetas-frecuencias.csv).
- [Combinaciones actuales](spell-audit-2026-10-16/etiquetas-combinaciones.csv), agrupadas sin considerar el orden del arreglo.
- [Propuesta para las 1.635 filas de referencia](spell-audit-2026-10-16/etiquetas-por-registro-propuestas.csv): etiquetas anteriores, categoría, edición, idioma, libro propuesto, observaciones y estado «NO aplicada».
- [Propuesta para los 456 conjuros del generador](spell-audit-2026-10-16/etiquetas-generador-propuestas.csv).
- [Resumen verificable](spell-audit-2026-10-16/etiquetas-resumen.json).

Las cantidades de clasificación propuestas son 1.629 filas de contenido oficial, dos de terceros y cuatro de creaciones de campaña. Que la cantidad «oficial» coincida con la actual es casual: salen las dos traducciones de Asfixiar y entran las dos de Fuerza fantasmal importada. La edición propuesta da 929 filas 2014 y 706 filas 2024 tras reclasificar los dos Starry Wisp. Estas cifras describen registros y propuestas, no nuevas identidades ni una migración ya ejecutada.

Se verificaron cobertura de identificadores, totales, vocabulario y ausencia de etiquetas vacías/repetidas. No se cambió código de ejecución, no se compiló la aplicación y no se modificó `.localstorage/`.
