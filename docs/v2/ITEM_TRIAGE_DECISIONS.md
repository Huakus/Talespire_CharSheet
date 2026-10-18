# Objetos: análisis y propuestas de resolución

17 de octubre de 2026. Análisis posterior a la clasificación; **no se modificaron objetos, etiquetas, inventarios ni código de aplicación** en esta etapa. Las propuestas siguientes no están ejecutadas.

**Orden actualizado por el usuario:** las prioridades de revisión de este informe se conservan, pero la migración activa de posesiones espera a que esté completa la base definitiva española. El [diseño de catálogo y migración](ITEM_DEFINITIVE_CATALOG_SPEC.md) incorpora recuperación bilingüe, preservación de copias, migración de comerciantes y retirada final de versiones antiguas y de la etiqueta temporal `definitiva`.

Se comprobó por SELECT que los catálogos compartido y de ECE siguen coincidiendo con las exportaciones verificadas después del etiquetado. Se volvieron a leer los inventarios de ECE: 241 copias en 16 fichas. Este informe sustituye los conteos de inventarios de la auditoría anterior; aquella instantánea se conserva como registro histórico.

La conclusión principal es que hay que resolver identidades y datos antes de decidir qué versiones retirar. Las etiquetas detectan señales, no certifican reglas ni indican que todas las filas marcadas estén rotas.

## Tratamiento de cada grupo

Los grupos se superponen; sus cantidades no deben sumarse como objetos distintos.

| Grupo | Hallazgo | Propuesta |
| --- | --- | --- |
| Fuente pendiente: 753 entradas españolas | Hay 238 coincidencias exactas de índice con la biblioteca SRD local. No prueban identidad: existe al menos un índice de arma básica aplicado a una versión +1. | Identificar por familia, cotejar estadísticas e índice y registrar procedencia real. No convertir todo `official` en Manual del Jugador ni todo `imported` en custom. |
| Sin descripción: 102 | Incluye equipo sencillo, siete nombres de armas con bonificación y cuatro pociones de curación. Las 102 figuran sin rareza, lo que demuestra que ese campo no sirve por sí solo para decidir si son mundanas. | Para equipo simple, usar los datos y el texto que tenga realmente la fuente; si solo tiene una fila de tabla, no inventar prosa oficial. Priorizar pociones y armas mágicas para recuperar reglas y rareza. |
| Revisar descripción: 80 | Predomina HTML literal; Núcleo Luciente contiene además una definición serializada. | Preparar conversiones que conserven palabras, párrafos, listas y tablas. Separar recuperación de formato de corrección de reglas. Recuperar el JSON del núcleo como versión candidata independiente. |
| Revisar datos: 110 | Son 79 categorías fuera del vocabulario del editor, 17 daños mezclados y 14 recursos sin recuperación declarada. | Aplicar tres tratamientos distintos, detallados debajo; no corregir los 110 con una sola transformación. |
| Revisar funciones: 171 | Menciones de conjuros o cargas sin representación estructurada suficiente. Una referencia a un conjuro no demuestra que el objeto lo conceda. | Leer las capacidades y clasificarlas como efecto pasivo, acción, conjuro, recurso o resolución manual; implementar por familias, empezando por los objetos usados. |
| Conflicto de versión: 18 filas | Son nueve grupos con diferencias en datos de reglas. Hay además dos grupos homónimos sin estas diferencias: 11 grupos/22 filas en total. | Resolver los once grupos, incluidos los dos que la etiqueta de conflicto no marca. No eliminar por coincidencia de nombre. |
| Versión local: 20 | ECE tiene 18 cambios de nombre y dos de datos de arma frente al catálogo compartido. Algunos nombres locales introducen errores o ambigüedad. | Conservar alias y personalizaciones intencionales; corregir errores demostrados. Una diferencia local no es automáticamente una variante autorizada. |
| Equivalencia inglesa: 803 | Todas tienen al menos un candidato español; algunos candidatos tienen identidad, texto o datos incompletos. | Conservar solo español cuando equivalencia e integridad estén comprobadas. Recuperar antes el español ausente/incompleto; después migrar referencias y retirar el inglés redundante. |

### Las 110 revisiones de datos

| Subgrupo | Cantidad | Acción propuesta |
| --- | ---: | --- |
| `tools` | 33 | Unificar con `tool` y preservar el subtipo y las competencias. Es vocabulario, no un cambio de objeto. |
| `mounts-and-vehicles` | 40 | Incorporar al vocabulario admitido por el editor y distinguir monturas, vehículos y accesorios. No degradar todo a equipo genérico para quitar la alerta. |
| `equipment` | 6 | Revisar Munición +1/+2/+3, Flecha de la Matanza, Flecha y Virotes de ballesta; clasificarlos como munición conservando efectos especiales. |
| Fórmulas con barra | 17 | Separar daño base, daño adicional, tipo, disparador y gasto. `1d8/2d10` no se puede reemplazar por una suma incondicional. |
| Recursos sin recuperación | 14 | Distinguir reservas finitas, componentes consumidos, usos especiales y recursos recargables. Declarar explícitamente la ausencia de recuperación cuando corresponda. |

El anillo de los tres deseos ejemplifica una reserva finita: no corresponde inventarle una recarga al amanecer. Las armas +1/+2/+3 y las armaduras +1/+2/+3 también necesitan validar rarezas con tablas distintas; varios valores guardados no coinciden. [Reglas oficiales de objetos de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/magic-items).

## Resolución propuesta de los once grupos homónimos

Las identidades siguientes se apoyan en índices, estadísticas y candidatos ingleses. Los nombres españoles definitivos se deben cotejar con la fuente española correspondiente; aquí no se certifican traducciones.

| Nombre repetido | Diferencia concreta encontrada | Qué propongo |
| --- | --- | --- |
| Daga del Umbral | Una definición tiene Hoja Fásica y la otra no. JuanPi, Stix y Delerion referencian la primera. La capacidad menciona específicamente a Stix. | Mantener ambas hasta resolver si el poder es del objeto o del personaje. Después conservar una base o dos variantes explícitas. No añadir el poder a otras copias ni inventar un gasto de cargas. |
| Anillo de salto | Solo cambia la capitalización del nombre en la definición normalizada; reglas y descripción coinciden. | Candidato claro a unificación después de comprobar requisitos y referencias. Una misma definición incompleta duplicada no se vuelve completa al fusionarla. |
| Camisote de Mallas +2 | Una fila es `Chain Shirt-2`, armadura media; la otra `chain-mail-2`, armadura pesada. Sus estadísticas son distintas. | Conservar ambas, corregir el nombre que las confunde y revisar rareza y bono efectivo de CA. En los datos actuales el bono aparece como nota pasiva sin bonos estructurados. |
| Gran hacha +1 | Una usa el índice básico `greataxe`, aunque concede +1; la otra usa `greataxe-1`. Difieren precio, rareza y contenido. | Cotejar y consolidar las versiones +1; reparar el índice. Conservar el Greataxe inglés básico hasta recuperar una verdadera versión española del arma básica. |
| Arco Largo | Una fila es `longbow`; la otra `vicious-longbow`, con efecto mágico propio. | Conservar dos objetos y nombrarlos de forma inequívoca. La copia de Arturo coincide por nombre, sin referencia: resolver cuál posee antes de vincularla. |
| Malla de Adamantina | Comparten índice; difieren en requisitos de Fuerza y desventaja de Sigilo. | Candidato a una definición corregida mediante cotejo de la armadura base, antes de migrar y retirar la otra. |
| Espada larga +1 | Comparten índice; difieren peso, precio y rareza. Garrick tiene referencia explícita; Borgar solo coincide por nombre. | Consolidar después de cotejar datos. Conservar precios autorizados de campaña como tales; no elegir un precio porque sea mayor o porque venga de una fila más detallada. |
| Carro | Una fila es `cart`; la otra `carriage`. Costes y pesos diferentes. | Conservar ambos vehículos y corregir nombres. No son duplicados del mismo objeto. |
| Cota de Mallas +3 | Una fila es `chain-mail-3`; la otra `splint-armor-3`. | Conservar ambas armaduras; corregir el nombre de la segunda y revisar rareza y bonificación efectiva. |
| Alabarda +3 | Mismo tipo de arma, pero diferencias en alcance, rareza, precio y vocabulario. | Candidato a unificación después de cotejar datos y distinguir precio base de precio de campaña. |
| Anillo de Protección | Una descripción declara el bono; otra solo dice que ofrece protección. Los datos mecánicos normalizados restantes coinciden. | Conservar una definición cotejada que incluya las reglas. Validar rareza y sintonización; no elegir la descripción más genérica. |

La distinción entre armaduras y entre los dos vehículos se contrastó con las [tablas oficiales de equipo de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment). No se aplicó ninguna fusión.

## Objetos de campaña e importaciones

El collar de hablar con los muertos y las dos definiciones de Daga del Umbral ya están identificados expresamente como custom. El collar no necesita otra reparación por estos hallazgos.

Hay 14 entradas españolas importadas que deben conservarse mientras se determina autoría y relación con posibles bases oficiales:

- Cristal Luciente, Cristal Carmsí, Cristal de Reserva y Núcleo Luciente.
- Capa de Carisma +1, Capa con runas, Túnica de Agati y Amuleto de mago.
- Varita de Armadura de Mago, Varita de molestar y Bastón de Acelerar.
- Pergamino de Erudito, Sombra del Segador y Joyas.

Mi propuesta es revisar estas 14 entradas como un lote de campaña, sin declararlas todas custom por su vía de importación. La ambientación propia de varias es evidencia para investigar, no una confirmación de autoría. En particular, Varita de molestar no debe fusionarse automáticamente con una varita de Xanathar por la coincidencia inglesa “Wand of Annoyance”.

En Núcleo Luciente, recuperar el objeto «Adaptado» incrustado sin descartar las reglas exteriores ni decidir todavía cuál debe ser la definición activa. Para Joyas y otros bienes descriptivos no hace falta inventar un botón Usar.

## Copias de personajes y prioridades concretas

La lectura actual arroja 48 referencias explícitas, 107 coincidencias de nombre únicas, dos ambiguas y 84 sin coincidencia automática. Son copias, no 84 tipos únicos ni objetos sobrantes. Las dos ambiguas por nombre son Arco largo de Arturo y Espada larga +1 de Borgar.

Las copias sin coincidencia incluyen alias, equipo del tutorial en inglés y objetos de trama. Ejemplos: `Spellbook`, `Orb`, `Priest's Pack`, Bolsa de monedas, mapas y material de campaña. Hay que preparar correspondencias conservando datos personales; no eliminarlas ni vincularlas únicamente por traducción del nombre.

| Caso prioritario | Hallazgo actual | Acción propuesta |
| --- | --- | --- |
| Daga del Umbral, tres portadores | Referencias explícitas a la definición con Hoja Fásica, pero copias personales distintas. | Resolver la decisión del GM antes de propagar capacidades. Conservar la sintonización y las cargas actuales de cada portador. |
| Anillo de Almacenamiento de Hechizos, Delerion | Guarda 5/5 cargas con recuperación al amanecer, sin sintonización requerida en el dato normalizado. | Rehacerlo como almacenamiento de conjuros, con su contenido real y datos del lanzador. No convertir automáticamente el 5/5 en cinco niveles de conjuros ya cargados. |
| Perla De Poder, Delerion | Recurso 0/0, recuperación vacía y sin requisito estructurado de sintonización. | Recuperar la definición y comparar con la copia; no reponer usos ni sintonizarlo en nombre del jugador. |
| Varita de Armadura de Mago, Delerion | La copia tiene 0/0 y sin requisitos, mientras que el candidato de catálogo tiene 3 cargas y sintonización. | Confirmar identidad y reglas de campaña antes de migrar. El catálogo no determina cuántas cargas le quedan a esa copia. |
| Bastón del marchitamiento, Delerion | Copia 0/0; catálogo con daño mezclado y sin requisitos completos. | Corregir definición y soporte; verificar elegibilidad para sus poderes sin alterar la posesión. |
| Perla de poder, Maelion | Referencia explícita y recuperación `dawn`; el resto del flujo usa `at-dawn`. | Unificar el evento de recuperación preservando el uso disponible actual. |
| Guanteletes de Fuerza de Ogro | Sin requisito de sintonización ni efecto estructurado; no se detectó una copia por referencia o nombre. | Corregir la definición y añadir soporte para fijar atributos; prioridad posterior a los objetos usados. |
| Tridente y Jabalina | Tipo de daño incorrecto o mal escrito. | Corregir tras cotejo; revisar variantes y copias relacionadas para que no sobreviva el error en otra fila. |

El anillo oficial almacena hasta cinco niveles de conjuros y requiere sintonización. Los guanteletes fijan Fuerza en 19 cuando corresponde y requieren sintonización. El bastón exige sintonización por clérigo, druida o brujo; no basta ser mago. Estos son requisitos para la propuesta, sin conceder acceso nuevo a ningún personaje. [Reglas oficiales de objetos de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/magic-items).

## Cambios de plataforma que conviene preparar

1. Mantener separados equipar, sintonizar y estar habilitado para una capacidad. Revisar el borrado de sintonización al desequipar y la comprobación del botón genérico Usar.
2. Hacer que categorías, propiedades, tipos de daño y eventos de recuperación usen valores estables con etiquetas españolas. Admitir monturas/vehículos y munición correctamente.
3. Distinguir usos recargables, reservas finitas, componentes consumidos y almacenamiento. Las recuperaciones deben expresar evento y cantidad o fórmula, sin rellenar siempre al máximo.
4. Representar daños adicionales condicionados, bonos reales de CA y efectos que fijan un atributo. Una nota pasiva no aplica por sí sola una bonificación.
5. Vincular equipo de tutorial, catálogo y posesiones por identidad estable, preservando alias, modificaciones y recursos de cada copia.

Estas necesidades provienen de la inspección y la auditoría anterior; no se implementaron en esta fase de análisis.

## Orden propuesto y decisiones pendientes

Primero resolvería los once grupos homónimos y las identidades de los objetos usados. En paralelo prepararía normalización de vocabulario y validaciones por familia: rareza, bonos, sintonización, tipo de daño y recursos. Así la limpieza de texto no oculta errores de reglas.

Con el orden actualizado, primero se concreta el formato y su soporte; después se construye toda la base definitiva con información recuperada de las versiones españolas e inglesas. Una vez completa, se migran referencias y configuración de las copias de personajes y comerciantes, preservando sus estados y personalizaciones. Solo al verificar que no hay usos antiguos pendientes se retiran equivalentes ingleses y duplicados verdaderos del alcance, manteniendo las copias de las otras campañas. Al cierre deja de ser necesaria la etiqueta temporal `definitiva`.

Solo necesitan una decisión de campaña los puntos que los datos no resuelven: alcance de Hoja Fásica, autoría/versión de importaciones, personalizaciones y precios intencionales, y contenido real del anillo o estado actual de los recursos. Las reglas oficiales y las erratas demostradas se cotejan; no hace falta pedir una decisión del GM por cada corrección técnica.

## Listados completos

- [Propuesta para cada una de las 806 entradas españolas](item-triage-2026-10-17/plan-por-entrada.csv).
- [Once grupos homónimos con claves, índices y usuarios](item-triage-2026-10-17/versiones-homonimas.csv).
- [241 copias de personajes y su relación con el catálogo](item-triage-2026-10-17/copias-personajes.csv).
- [Resumen reproducible](item-triage-2026-10-17/resumen.json).
- [803 candidatos de equivalencia inglesa de la clasificación anterior](item-tags-2026-10-17/correspondencias-ingles.csv).

Generación offline: `node scripts/analyze-equipment-triage.mjs`. El script comprueba que los checksums de catálogo leídos por SELECT coincidan con las exportaciones analizadas y no ejecuta consultas ni cambios remotos. La lectura de inventarios usada en este informe está en `tmp/item-tags/triage-live-context.json`, fuera del repositorio. No se leyó ni modificó `.localstorage/`.
