# Revisión de catálogos de conjuros — 16 de octubre de 2026

**Aplicación posterior:** después de esta auditoría, el usuario eligió conservar el tutorial, los custom y las versiones usadas como `old`. La depuración aplicada a plantilla/ECE se documenta en [Catálogo de conjuros depurado](SPELL_CATALOG_CLEANUP.md). Las cantidades y propuestas de esta auditoría describen el estado anterior.

**Estado: propuesta para decidir con el GM. No se modificaron conjuros, fichas ni datos de campaña.**

La revisión específica de etiquetas, sus dependencias y la clasificación propuesta por registro está en [Etiquetas de conjuros](SPELL_TAGS_AUDIT.md).

La recomendación es conservar el formato del generador como base de un único catálogo, corregir sus errores, incorporar el contenido de campaña y convertir los nombres alternativos en traducciones o alias. Las reglas de 2024 y los otros suplementos deben conservar su procedencia y disponibilidad propia. No conviene reemplazar toda la base por la lista nueva ni fusionar únicamente por nombre.

## Resultado de la comparación

| Grupo | Encontrado | Tratamiento propuesto |
| --- | ---: | --- |
| Generador actual | 456 conjuros: 361 PHB + 95 Xanathar | Conservar identidades y formato; corregir datos y revisar texto literal |
| Base oficial anterior, sin etiqueta 2024 | 925 filas en ambos idiomas | Normalizar y vincular con identidades, traducciones y fuentes |
| Coincidencias PHB/Xanathar en esas filas | 421 identidades propuestas; una contiene datos mezclados | 420 con una entrada utilizable; reparar el registro híbrido de Hex |
| Duplicación adicional dentro del mismo idioma | 62 filas excedentes, en 62 pares | 29 pares tienen payload idéntico; 33 tienen diferencias que deben conservarse para cotejo antes de retirar una copia |
| Conjuros adicionales a los 456 del generador | 11 identidades, 22 filas bilingües | 9 de otros suplementos de Wizards, 1 de un tercero y 1 de 2024 mal etiquetado; decidir disponibilidad |
| Base etiquetada 2024 | 704 filas: 352 en cada idioma | Mantener separada y fuera del generador 2014 por defecto |
| Importaciones en ECE | 6 filas: tres pares bilingües | Dos conjuros de campaña y una importación de un conjuro del PHB |

Las cantidades anteriores se superponen cuando se indica: los 62 excedentes y las 22 filas adicionales ya forman parte de las 925. **Una fila no equivale a un conjuro diferente.** Dos traducciones tampoco son dos reglas diferentes.

El catálogo compartido contiene 1.629 filas oficiales. Hay copias de ese catálogo en 19 campañas: 30.951 filas oficiales y las seis importaciones de ECE, 30.957 en total. La revisión de contenido se hizo sobre la plantilla compartida y las diferencias de campaña, sin contar cada copia como un conjuro nuevo.

Las siete filas oficiales cuyo almacenamiento de campaña difiere de la plantilla —Animate Dead, Charm Monster, Dragon's Breath, Ice Knife, Mind Spike, Vitriolic Sphere y Agarre de Tierra de Maximiliano— resultan equivalentes después de aplicar el normalizador actual. Sus diferencias son de representación, campos vacíos o estructura heredada; no se identificó una variante de reglas del GM entre ellas.

## Qué conservar, fusionar, corregir y separar

### Conservar

- Los 456 identificadores actuales del generador. Se utilizan en elecciones, progresión y rasgos: cambiarlos rompería vínculos aunque el nombre visible fuera correcto.
- Los textos y metadatos originales de cada fuente como procedencia e historial, hasta completar el cotejo.
- Los conjuros propios de campaña, sus componentes, restricciones, traducciones y usos guardados.
- Las definiciones guardadas en personajes anteriores. Una migración de catálogo no debe cambiar sus reglas silenciosamente.

### Fusionar como una identidad con traducciones y alias

Ejemplos cotejados: Patrón hipnótico/Pauta hipnótica; Contrahechizo/Contraconjuro; Pequeña choza/Cobijo seguro de Leomund; Pirotécnica/Pirotecnia; Mano arcana/Mano de Bigby. Estos ejemplos no requieren dos opciones distintas en el selector.

Los 29 pares con payload idéntico son los primeros candidatos a retirar como filas redundantes **después** de redirigir referencias y conservar sus identificadores como alias. En los otros 33 pares hay diferencias de texto o datos: no corresponde borrar una copia sin registrar qué se conserva y por qué. El inventario identifica todas las filas de estos grupos.

Las versiones inglesas deben pasar a ser traducciones/alias de la misma identidad, sin aparecer como opciones duplicadas en español. No propongo eliminar su información de procedencia.

### Corregir antes de publicar la unificación

| Caso | Problema comprobado | Corrección propuesta |
| --- | --- | --- |
| Mal de ojo / Hex, en la base | Nivel 1, alcance 90 pies y clase brujo, pero descripción y página de Eyebite | Reparar la entrada de Hex desde su fuente. Conservar la fila original como evidencia; no reasignar automáticamente personajes homónimos |
| Zancada prodigiosa, en el generador | Duración «Concentración, hasta 1 minuto», mientras el indicador de concentración es falso | Duración 1 hora, sin concentración. La base antigua también tiene duración y concentración incorrectas |
| Garrote / Shillelagh, en el generador | Duración 1 asalto | Duración 1 minuto |
| Círculo de poder, en el generador | El texto exige concentración, pero el indicador es falso | Marcar concentración y conservar hasta 10 minutos |
| Tromba/Tormenta de meteoritos, en la base | Nivel 8, conjuración | Nivel 9, evocación |
| Truco de la cuerda, en la base | Nivel 3, conjuración | Nivel 2, transmutación |
| Hablar con las plantas, en la base | Nivel 1 y sin bardo | Nivel 3; bardo, druida y explorador |
| Zona de verdad, en la base | Conjuración | Encantamiento |
| Corcel fantasma, en la base | No figura como ritual | Ritual |
| Puerta dimensional en inglés y Corona de locura en español, en la base | Falta bardo en sus listas | Restaurar su disponibilidad para bardo |
| Hasta disipado, en la base | Se usó una duración como nombre | Identificarlo como Proyectar imagen por su descripción; conservar el nombre anterior como dato heredado |
| Agnazzars Scorcher | Errata en el nombre, además de otra entrada Aganazzar's Scorcher | Una identidad de Aganazzar; corregir nombre y vincular alias |

Zancada prodigiosa fue contrastada con la [ficha oficial de reglas 2014](https://www.dndbeyond.com/spells/2171-longstrider). Garrote y los casos SRD se contrastan con el catálogo SRD conservado en el proyecto y el [SRD 5.1 oficial](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf). Círculo de poder presenta una contradicción interna verificable entre texto y dato de concentración. Esta tabla es una lista de correcciones detectadas, no una certificación de que todos los demás campos estén libres de errores.

## Contenido de campaña

| Conjuro | Datos actuales | Presencia en fichas | Propuesta |
| --- | --- | ---: | --- |
| Forjar Constructo / Forge Construct | Nivel 3; clérigo y mago; ritual de una hora; materiales y cristales de campaña | 3 entradas guardadas | Conservar como conjuro de ECE, con español como presentación y su texto propio intacto |
| Transferir Eco / Transfer Echo | Nivel 4; mago; ritual de una hora; componentes y efecto de Eco propios de campaña | 2 entradas guardadas | Conservar como conjuro de ECE, con español como presentación y su texto propio intacto |
| Fuerza fantasmal / Phantasmal Force (importado) | Nivel 2; reglas 2014; dos idiomas | No se atribuye por nombre la ficha homónima de 2024 a esta importación | Vincular con Fuerza fantasmal 2014. Conservar el texto importado en historial y corregir los saltos de línea escapados |

Los seis registros están guardados con origen `imported` y etiqueta `gm`. El código actual concede prioridad especial solo a origen `gm`, por lo que **origen de importación** y **autoría de campaña** deben representarse por separado. Una importación puede contener tanto un conjuro oficial como uno creado por el GM.

La lista del tutorial se obtiene exclusivamente del catálogo incluido en el código. No consulta los conjuros de campaña. Por eso un conjuro personalizado puede existir en la ficha y no estar disponible en creación/subida de nivel. El catálogo unificado debe alimentar ambas interfaces y respetar clase, nivel, campaña y reglas habilitadas.

## Entradas adicionales que hoy no están en el generador

Estas son todas las identidades adicionales identificadas en la base anterior. Los nombres españoles reflejan la base actual; no se certifican como traducciones editoriales oficiales.

| Conjuros | Procedencia | Propuesta |
| --- | --- | --- |
| Mente fragmentada / Mind Sliver; Látigo mental de Tasha; Mezcla cáustica de Tasha; Spirit Shroud | Tasha, procedencia propuesta; Spirit Shroud declara la página 108 en la base | Conservar como suplemento adicional; decidir si se habilita para ECE. Falta cotejar edición, clases y texto |
| Lanza psíquica de Raulothim; Hielo vinculante de Rime | Fizban, procedencia propuesta | Conservar como suplemento adicional; decidir habilitación y verificar fuente/texto |
| Púas plateadas / Silvery Barbs; Vórtice deformado / Vortex Warp | Strixhaven | Conservar como suplemento adicional. Púas plateadas ya tiene un uso guardado |
| Torre de Galder | Lost Laboratory of Kwalish, procedencia propuesta | Conservar aparte; verificar edición y descripción |
| Asfixiar / Suffocate | Grim Hollow: Lairs of Etharis, contenido de terceros | Conservar aparte con autoría correcta. No etiquetarlo como PHB, Xanathar ni creación propia del GM |
| Starry Wisp | 2024, aunque estas dos filas están etiquetadas como legacy | Corregir la edición. No incorporarlo a la lista oficial de PHB 2014 |

Se verificó Strixhaven mediante la [presentación oficial del suplemento](https://marketplace.dndbeyond.com/category/SRC-00080) y la [explicación oficial de Silvery Barbs](https://www.dndbeyond.com/posts/1371-silvery-barbs-snatch-a-victory-from-the-jaws-of). Suffocate figura en el índice de [Lairs of Etharis](https://www.dndbeyond.com/sources/dnd/loe). Starry Wisp aparece entre las novedades del [PHB 2024](https://www.dndbeyond.com/posts/1810-updates-in-the-players-handbook-2024). Las procedencias señaladas como propuestas no equivalen a un cotejo del texto completo del libro correspondiente.

## Cobertura: qué falta realmente

No encontré un conjuro identificable como PHB/Xanathar en la base anterior que falte por identidad en los 456 del generador. Esto no certifica la integridad de cada descripción ni sus metadatos.

En sentido inverso, **35 conjuros del generador no tienen una entrada oficial en el catálogo antiguo**, y Hex solo tiene la entrada híbrida mencionada. Fuerza fantasmal es uno de los 35: en ECE existe adicionalmente como importación. Quedan por lo tanto 34 sin entrada de catálogo antigua ni importada en ECE, además de reparar Hex.

Los nombres que siguen son los del generador actual y también están sujetos al cotejo de traducción:

| Conjuro | Nivel | Situación en el catálogo antiguo |
| --- | ---: | --- |
| Látigo de espinas | 0 | Sin entrada oficial |
| Disco flotante de Tenser | 1 | Sin entrada oficial |
| Duelo obligado | 1 | Sin entrada oficial |
| Golpe abrasador | 1 | Sin entrada oficial |
| Golpe iracundo | 1 | Sin entrada oficial |
| Impacto enmarañador | 1 | Sin entrada oficial |
| Mal de ojo / Hex | 1 | Registro híbrido |
| Ráfaga de espinas | 1 | Sin entrada oficial |
| Terribles carcajadas de Tasha | 1 | Sin entrada oficial |
| Cordón de flechas | 2 | Sin entrada oficial |
| Fuerza fantasmal | 2 | Importado en ECE |
| Sentido animal | 2 | Sin entrada oficial |
| Arma elemental | 3 | Sin entrada oficial |
| Aura de vitalidad | 3 | Sin entrada oficial |
| Conjurar bombardeo | 3 | Sin entrada oficial |
| Flecha relampagueante | 3 | Sin entrada oficial |
| Golpe cegador | 3 | Sin entrada oficial |
| Manto del cruzado | 3 | Sin entrada oficial |
| Aura de pureza | 4 | Sin entrada oficial |
| Golpe asombroso | 4 | Sin entrada oficial |
| Hiedras atrapadoras | 4 | Sin entrada oficial |
| Carcaj rápido | 5 | Sin entrada oficial |
| Castigo desterrador | 5 | Sin entrada oficial |
| Conjurar descarga | 5 | Sin entrada oficial |
| Círculo de poder | 5 | Sin entrada oficial |
| Onda destructiva | 5 | Sin entrada oficial |
| Baile irresistible de Otto | 6 | Sin entrada oficial |
| Esfera congelante de Otiluke | 6 | Sin entrada oficial |
| Guardas y custodias | 6 | Sin entrada oficial |
| Invocación instantánea de Drawmij | 6 | Sin entrada oficial |
| Espada de Mordenkainen | 7 | Sin entrada oficial |
| Magnifica mansión de Mordenkainen | 7 | Sin entrada oficial |
| Telepatía | 8 | Sin entrada oficial |
| Tsunami | 8 | Sin entrada oficial |
| Palabra de poder sanar | 9 | Sin entrada oficial |
| Tormenta de venganza | 9 | Sin entrada oficial |

## Descripciones exactamente iguales al manual

**El estado actual no cumple ese requisito.** El catálogo nuevo mezcla extracción de PDF, resúmenes y correcciones redactadas para la aplicación. Se detectaron 17 descripciones con aclaraciones/erratas añadidas explícitamente. Contagio tiene una introducción resumida; Perno de Caos utiliza un resumen porque su descripción no está en el PDF aportado. También hay correcciones de extracción y cambios de redacción. La base anterior tampoco constituye una fuente literal certificada: contiene traducciones alternativas, resúmenes y errores.

El PDF de Xanathar aportado acredita en su página 3 la traducción de **Alvaro1555**, y no una edición editorial española oficial. El PDF del Manual conserva el ISBN y los créditos ingleses, sin acreditar en esos créditos una edición editorial española. Por tanto, no puedo certificar la traducción oficial española de ninguno de los dos archivos a partir de esos datos. Además, la página 237 del Manual aportado ya imprime mal la duración de Longstrider: copiarla literalmente propagaría ese error.

Para cumplir el requisito hacen falta:

1. Una edición española oficial verificable por libro y una referencia de impresión/erratas. Si no está disponible, el registro debe quedar como «texto pendiente de cotejo», sin presentarlo como oficial literal.
2. Un campo de texto literal conservado sin resúmenes ni aclaraciones intercaladas, con libro, idioma, edición y página.
3. Campos separados para erratas, explicaciones breves, automatización y decisiones del GM. El texto literal puede coexistir con una regla corregida, mostrando la errata que justifica la diferencia.
4. Verificación de párrafos, listas, tablas, componentes y apartado de niveles superiores. Normalizar saltos de línea no autoriza a reescribir frases.

Las descripciones propias de campaña se conservan como textos del GM; no se sustituyen por una supuesta descripción oficial. Esta revisión no incluye una transcripción ni una certificación palabra por palabra de los 456 textos.

## Fichas existentes que requieren atención

Se consultaron 316 entradas de conjuro guardadas: 312 indican 2014, una indica 2024 y tres no tienen edición. 48 proceden del generador. Son entradas guardadas, no cantidades de personajes distintos.

- **Mal de ojo, nivel 6:** la ficha contiene la definición de Eyebite. Debe vincularse con Mirada penetrante, manteniendo su contenido, aunque otra entrada de catálogo use ese mismo nombre para Hex.
- **Phantasmal Force, 2024:** la ficha contiene la variante que inflige 2d8. La versión 2014 inflige 1d6. Mantener la variante actual hasta decidir expresamente si se convierte; no tratarla como duplicado de la importación 2014.
- **Llamar a los muertos:** dos entradas corresponden por su efecto a Toll the Dead. La definición guardada tiene clases en una cadena y una lista distinta de la del generador; necesita normalización y cotejo antes de vincularla.
- **Paso atronador:** corresponde por descripción y metadatos a Thunder Step; conservarlo como alias.
- **Levantar maldición:** una entrada sin definición. Es candidato a Quitar maldición, pero el nombre solo no permite confirmarlo. Queda pendiente, sin asignación automática.
- **Púas plateadas:** un uso de Strixhaven ya guardado. Deshabilitar un suplemento para nuevas elecciones no debe quitarlo de la ficha.
- Los cinco usos de los dos conjuros de campaña deben sobrevivir a la unificación, incluidos los que no tienen definición completa.

## Cambios de estructura necesarios después de decidir

1. **Identidad estable:** una familia de conjuro con identificador, variantes por edición y variantes de campaña. Conservar las claves actuales del generador y los identificadores antiguos como correspondencias.
2. **Traducciones y procedencia:** nombres, alias y texto por idioma; libro/página/impresión; origen de importación separado de la autoría oficial, de terceros o del GM. La validación actual elimina varios campos de fuente que sí existen en los JSON de entrada.
3. **Reglas consultables:** nivel, clases, escuela, componentes, duración, concentración y ritual en campos normalizados. No inferir la edición por ausencia de año ni la identidad únicamente por un nombre traducido.
4. **Disponibilidad por campaña:** PHB 2014 y Xanathar como base; creaciones ECE habilitadas solo allí; otros libros y 2024 con selección explícita. Los suplementos deshabilitados conservan sus definiciones y usos anteriores.
5. **Una consulta compartida por ficha y tutorial:** los mismos identificadores y reglas de disponibilidad para búsqueda, creación, aprendizaje, preparación, intercambio y subida de nivel. Aplicar también los límites y la prevención de selecciones duplicadas.
6. **Migración revisable:** correspondencia por registro y definición, simulación sin escritura, respaldo previo a la migración real, tratamiento explícito de casos ambiguos, comprobación de fichas e historial y posibilidad de reversión. Las consultas de esta auditoría no son un respaldo completo ni una migración.

La presentación actual mezcla el catálogo local y el remoto y elimina duplicados por nombre visible. Además, la traducción de nombres ingleses puede sustituir la definición completa por la local. Esto explica que una versión quede oculta o que dos traducciones aparezcan como opciones distintas. Debe sustituirse por resolución de identidad, edición y variante, conservando la procedencia.

## Decisiones propuestas al GM

| Decisión | Recomendación |
| --- | --- |
| Catálogo de referencia de la aplicación | Formato nuevo, corrigiendo errores y completando procedencia; no aceptar todas sus descripciones como literales |
| Duplicados | Fusionar referencias y alias; retirar las filas redundantes solo después de conservar sus diferencias y verificar usos |
| Forjar Constructo y Transferir Eco | Conservar y habilitar para ECE, según sus clases y niveles actuales |
| Fuerza fantasmal importada | Incorporar a la identidad 2014; mantener su historial |
| Nueve conjuros de otros suplementos de Wizards y Asfixiar de un tercero | Conservar separados; decidir cuáles se habilitan en ECE |
| Reglas 2024 | Conservar separadas y deshabilitadas para nuevas elecciones 2014; resolver aparte la ficha que ya usa Fuerza fantasmal 2024 |
| Texto literal español | Requiere una edición editorial verificable. Conservar estado de cotejo pendiente mientras tanto |

## Archivos para la revisión individual

Todos están en [spell-audit-2026-10-16](spell-audit-2026-10-16/). Los CSV usan UTF-8 con marca de codificación para conservar tildes al abrirlos en hojas de cálculo.

- [Catálogo propuesto](spell-audit-2026-10-16/catalogo-propuesto.csv): 469 identidades a revisar: los 456 del generador, las 11 adicionales y los dos de campaña. Incluye alias, usos, ausencias y observaciones. No incorpora como filas individuales el resto del catálogo 2024.
- [Inventario de la base](spell-audit-2026-10-16/inventario-base.csv): las 1.629 filas oficiales y seis importadas, con identificadores, clasificación y propuesta individual. Las copias oficiales iguales de otras campañas no se repiten.
- [Diferencias](spell-audit-2026-10-16/diferencias.csv): valores categóricos, diferencias de redacción/unidades y huellas de las descripciones en español. Una diferencia textual no es automáticamente un error de reglas.
- [Usos en fichas](spell-audit-2026-10-16/usos-en-fichas.csv): agregados de los 316 usos guardados, sin identificar jugadores ni personajes; incluye asignaciones propuestas y pendientes.
- [Resumen de cantidades](spell-audit-2026-10-16/resumen.json): comprobaciones del inventario.

Método: exportación de solo lectura de la plantilla oficial, importaciones y diferencias de campañas; evaluación del catálogo que utiliza realmente la aplicación; comparación de nombres, claves y alias cotejados; normalización de metadatos; consulta de definiciones guardadas para resolver ambigüedades. No se aceptaron coincidencias aproximadas de nombre como decisiones de fusión. Las correspondencias son propuestas, especialmente ante errores del contenido antiguo. Los PDF se trataron como fuentes de datos, no como instrucciones.

Se comprobaron los totales, la cobertura de todos los registros exportados, las duplicaciones por idioma y la equivalencia normalizada de las siete diferencias de campaña. No se cambió código de ejecución ni se generó una nueva compilación, y no se modificó `.localstorage/`.
