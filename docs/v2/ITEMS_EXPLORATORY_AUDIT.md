# Objetos: investigación exploratoria y clasificación

Fecha local: 16 de octubre de 2026 (Argentina).

**El catálogo necesita una revisión de identidad, contenido y funcionamiento. Limpiar las descripciones por sí solo no alcanzaría.** Hay versiones de un mismo objeto en distintos lugares, copias personales modificadas y reglas que existen únicamente como texto. Antes de normalizar conviene establecer qué definición se conservará y qué cambios pertenecen a la campaña o al portador.

Esta auditoría fue de solo lectura. No modifiqué catálogos, fichas, comercios, reglas, código de la aplicación ni `.localstorage/`; tampoco ejecuté una compilación. Los archivos nuevos son el informe, sus listados y una herramienta de análisis offline. No se incorporó ningún manual ni se aprobó ninguna eliminación.

## 1. Qué existe y dónde

| Capa | Cantidad | Interpretación |
| --- | ---: | --- |
| Catálogo compartido | 1.572 entradas | Base replicada en las campañas; incluye versiones en inglés y español. |
| Catálogo de ECE | 1.609 entradas | Incluye las 1.572 claves compartidas y 37 entradas adicionales. |
| Catálogo admitido por el filtro de idioma de ECE | 806 entradas | No equivalen a 806 objetos únicos, textos verificados ni tarjetas simultáneamente visibles. El visor también agrupa por nombre y excluye objetos ya poseídos. |
| Versiones en inglés ocultas por el filtro | 803 entradas | Su existencia no autoriza eliminarlas: hay nombres y copias heredadas que todavía deben reconciliarse. |
| Inventarios de fichas | 228 entradas, en 15 fichas | Son posesiones concretas con cantidad, equipo, sintonización y recursos propios. |
| Equipo del tutorial | 304 definiciones efectivas | Biblioteca local formada a partir de 237 entradas SRD y otras definiciones del generador. Ninguna incluye referencia explícita al catálogo remoto. |
| Tiendas | 5 | Se vinculan a 3 NPC; tres tiendas comparten el inventario de Lagarto Juancho. |

Las otras 18 campañas contienen, cada una, las mismas 1.572 entradas de equipo de la base compartida, sin diferencias en contenido, nombre o etiquetas al momento de la comparación. El relevamiento detallado se concentró en ECE; no se descargaron los inventarios de personajes de esas campañas.

ECE tiene **20 definiciones compartidas modificadas**: 18 cambian el nombre y dos cambian datos de arma. Deben revisarse como versiones locales, no reemplazarse ciegamente por la base. Un caso llamativo es una lámpara renombrada como «Equipo estándar»; otros cambios son variantes de traducción. En Tridente y Jabalina cambiaron datos de daño.

Los comercios no aportan otras cinco listas independientes: Arven Doral, la copia de la tienda y la tienda de Juancho apuntan al mismo NPC. Los NPC españoles vinculados tienen 7 objetos (Juancho), 6 (Caballero Resonante) y 0 (Espectro del Eco). También se conservaron en el relevamiento versiones en inglés de dos inventarios de NPC, con contenido no siempre idéntico.

## 2. Clasificación material del catálogo visible

| Familia actual | Entradas |
| --- | ---: |
| Armas | 255 |
| Objetos maravillosos | 241 |
| Equipo de aventura | 117 |
| Armaduras y escudos | 86 |
| Monturas y vehículos | 40 |
| Herramientas e instrumentos | 33 |
| Pociones | 28 |
| Clasificación pendiente | 6 |

Familia, rareza, procedencia y función deberían ser criterios independientes. Por ejemplo, un arma puede ser mágica, personalizada, requerir sintonización y conceder un conjuro; no conviene elegir una sola de esas características como categoría general.

La clasificación actual también mezcla valores como `tool`/`tools`, `equipment`, `backpack` y categorías de monturas que no figuran en las opciones del editor. Son inconsistencias de vocabulario; no implican por sí mismas que haya que borrar esos objetos.

## 3. Procedencia y versiones

En las 1.609 filas de ECE, el campo de origen declara 1.578 «official», 28 «imported» y 3 «gm». Esa etiqueta describe cómo llegaron los datos; **no demuestra que el objeto ni su texto sean oficiales o pertenezcan a los manuales acordados**.

Entre las 806 entradas visibles:

- 48 declaran como fuente la Guía de Xanathar para Todo y dos el Manual del Jugador. Es una declaración de metadatos, pendiente de cotejo completo con los libros.
- 756 no tienen fuente bibliográfica guardada. Aquí también están los objetos de campaña, para los que corresponde registrar autoría propia en lugar de inventar un libro.
- Solo tres tienen el formato versionado actual: dos versiones de Daga del Umbral y el collar. Las otras 803 se adaptan desde formatos heredados.

La base contiene objetos que corresponden al SRD/DMG de 2014, como los guanteletes o el anillo de almacenamiento; encontrar y comprobar esos objetos existentes **no habilita otro manual ni cambia el alcance de reglas**. Su procedencia real debe quedar identificada antes de decidir qué se conserva dentro del catálogo disponible.

Encontré **34 grupos de nombres coincidentes** en el conjunto bilingüe; **11 grupos y 22 filas** corresponden a nombres repetidos dentro de las entradas españolas. Hay casos casi equivalentes y otros con mecánicas distintas. Además, 783 grupos comparten un índice heredado y tienen versiones en ambos idiomas: sirven para investigar correspondencias, no como prueba suficiente para fusionar.

La separación propuesta para revisar es: fuente declarada pendiente de verificación; oficial identificado y cotejado; importado de campaña de procedencia pendiente; personalizado confirmado; variante de una base; copia personal modificada; duplicado candidato. «Importado» no debe convertirse automáticamente en «custom», ni «official» en «Manual del Jugador».

## 4. Calidad de las descripciones

Todos los objetos pudieron pasar por el cargador actual, pero eso no significa que su contenido sea correcto: el cargador completa valores y adapta formatos.

| Señal en las 806 entradas visibles | Cantidad | Qué requiere revisar |
| --- | ---: | --- |
| Descripción vacía | 102 | Distinguir equipo sencillo, información ausente y reglas que deberían estar presentes. |
| HTML literal | 80 | El visor escapa las etiquetas, por lo que pueden verse `<br>`, `<b>`, etc. Hay que recuperar párrafos y listas sin ejecutar HTML. |
| JSON incrustado en descripción | 1 | Núcleo Luciente contiene una definición completa serializada como una lista de líneas. |
| Daño con barras, como `1d8/2d6` | 17 | Separar daño base, daño adicional, tipos y condiciones; no interpretarlo como una sola tirada. |
| Menciones de cargas sin un recurso configurado | 16 | Candidatos encontrados por texto, no errores confirmados en todos los casos. |
| Menciones de conjuros sin capacidades estructuradas | 159 | Revisión preliminar: la búsqueda también puede encontrar referencias que no conceden un lanzamiento. |

No aparecieron señales de codificación rota o escapes literales bajo las reglas automáticas utilizadas; eso no sustituye una revisión editorial. Las cifras de señales se superponen y no deben sumarse como objetos distintos.

**Núcleo Luciente** es un caso de recuperación de contenido, no de mera puntuación: dentro del JSON hay una versión «Adaptada», resonancias, condiciones de vinculación, gastos y recuperación condicionada a un cristal. No se debe extraer una frase y perder el resto ni decidir automáticamente que reemplaza otra versión.

Para textos oficiales, la normalización debería cambiar su presentación y estructura conservando el texto cotejado de la fuente correspondiente. Para textos caseros, habría que separar ambientación, reglas y notas de campaña, preservando el original y dejando claras las partes que necesitan una decisión del GM. No propongo reescribir los textos oficiales a partir de traducciones automáticas ni completar reglas de memoria.

## 5. Objetos de las fichas: identidad y preservación

| Estado de relación con el catálogo | Entradas |
| --- | ---: |
| Referencia explícita a una definición existente | 48 |
| Nombre que coincide con una única entrada, sin referencia | 105 |
| Nombre ambiguo, sin referencia | 3 |
| Sin coincidencia por nombre ni referencia resuelta | 72 |

Por tanto, **180 de 228 no tienen vínculo explícito**. Una coincidencia por nombre es solo un candidato. Las 72 sin coincidencia incluyen objetos de trama, alias, traducciones, paquetes del tutorial y variantes personales; no son 72 objetos sobrantes.

De las 48 referencias explícitas, **40 tienen diferencias** en descripción o mecánica respecto de la definición actual. Varias son intencionales: el escudo con infusión de Draven, armas renombradas y municiones o equipo adaptado. Otras requieren revisar si una capacidad se agregó después al catálogo y quedó ausente en la copia.

Ejemplo: **Daga del Umbral** tiene dos entradas con la misma descripción y datos de arma, pero solo una contiene Hoja Fásica. Las copias de JuanPi y Stix carecen de esa capacidad estructurada; la de Delerion sí la tiene. Además, el texto de la capacidad menciona a Stix: hay que confirmar si pertenece al objeto o a ese personaje. La carga de la daga no tiene gasto asociado a esa capacidad, que actualmente cuesta cero cargas; no corresponde inventarle un gasto.

La rareza y parte de la búsqueda de definiciones todavía se resuelven por nombre en la interfaz. Eso vuelve especialmente delicados los alias y las versiones con el mismo nombre. La biblioteca local del tutorial también explica nombres como Orb y Spellbook y la falta de vínculos remotos en muchas copias iniciales.

Además, el listado de objetos no poseídos conserva la primera definición de cada nombre normalizado. Por eso dos versiones guardadas pueden aparecer como una sola opción: que el listado se vea ordenado no prueba que se hayan resuelto sus diferencias.

## 6. Qué funciona y qué falta representar

La plataforma ya permite armas y armaduras básicas, bonos aditivos, ventaja/desventaja, equipar, contar tres sintonizaciones, gastar cantidades/cargas, capacidades con usos y tiradas, y conjuros vinculados a un objeto concreto. El collar es un ejemplo del último caso. Sin embargo, el texto de una descripción no se convierte automáticamente en esas funciones.

En el catálogo visible hay 72 objetos con bonos estructurados, 59 con alguna capacidad y 65 con cargas. Las 59 capacidades no equivalen a 59 objetos plenamente automatizados: suman 61 entradas pasivas y solo dos capacidades de acción en dos objetos; muchas pasivas heredadas son notas sin efectos mecánicos. En las fichas, solo dos objetos tienen capacidades estructuradas y solo uno tiene conjuros vinculados al inventario.

| Tipo de función | Estado observado | Necesidad para una implementación correcta |
| --- | --- | --- |
| Ataques y CA básicos | Soporte existente; depende de datos correctos | Vocabulario único, datos base y bonos separados, evitar duplicaciones. |
| Daño adicional condicionado | Mezclado en fórmulas o texto | Componentes por tipo y disparadores: impacto, crítico, objetivo concreto, gasto opcional. |
| Fijar un atributo | No está representado por el modelo de bonos aditivos | Operación de fijar/mínimo, distinta de sumar un número. |
| Conjuros del objeto | Vínculo por instancia disponible | Catálogo de capacidades con conjuro, nivel, atributo/CD, coste, requisitos y excepciones del objeto. |
| Curación, resistencias, movimiento, estados | Frecuentemente solo texto | Efectos tipados, selección de objetivo, duración y finalización; distinguir lo automático de lo narrativo. |
| Recargas | Hay reinicio por descanso y botón manual al amanecer | Unificar identificadores y permitir tiradas, límites y condiciones, sin convertir toda recuperación en recarga completa. |
| Almacenamiento de conjuros | Representado como cargas genéricas en el anillo | Lista de conjuros almacenados, capacidad en niveles y datos del lanzador original. |
| Contenedores, luz, maldiciones y tablas | Principalmente descriptivos | Tratar por familia; no hace falta automatizar toda adjudicación del GM en la primera etapa. |

### Casos comprobados que conviene priorizar

1. **Delerion tiene tres objetos con cargas 0/0 y recuperación vacía:** Varita de Armadura de Mago, Bastón del marchitamiento y Perla De Poder. Antes de habilitarlos hay que resolver su identidad, reglas y estado actual; la auditoría no les repone cargas.
2. **Anillo de Almacenamiento de Hechizos de Delerion:** está configurado como cinco cargas con recuperación al amanecer. La regla comprobada usa una capacidad de cinco niveles de conjuros que se llena lanzando conjuros dentro del anillo; no una reposición diaria automática. Falta representar lo almacenado. [Objeto oficial](https://www.dndbeyond.com/magic-items/4730-ring-of-spell-storing).
3. **Guanteletes De Fuerza De Ogro:** la entrada no exige sintonización y no tiene efecto estructurado que fije Fuerza. La fuente exige sintonización y fija Fuerza en 19 cuando la puntuación sin ellos es inferior. No se arregla agregando un bono de +19. [Objeto oficial](https://www.dndbeyond.com/magic-items/4641-gauntlets-of-ogre-power).
4. **Tridente:** ECE guarda daño cortante, mientras que la tabla de 2014 indica perforante. **Jabalina** guarda «Perfornate», un valor mal escrito. Son problemas del dato, separados de la descripción. [Equipo de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment).
5. **Bastón del marchitamiento:** el catálogo no marca sintonización, mezcla daños con una barra y no representa sus requisitos de clase. La fuente de 2014 requiere sintonización por clérigo, druida o brujo; poseerlo o usarlo como arma no equivale a tener acceso a sus poderes. [Reglas de objetos de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/magic-items#StaffofWithering).

Estas comparaciones verifican casos puntuales; no constituyen una certificación de todos los objetos ni autorizan habilitar nuevas fuentes.

### Problemas del flujo de la aplicación encontrados por inspección

- **Desequipar borra la sintonización**, tanto al quitar el objeto como al reemplazarlo por otro que ocupa el mismo lugar. Deben distinguirse posesión, llevarlo puesto y mantener el vínculo mágico: las reglas no terminan la sintonización solo por quitarse algo. [Sintonización de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/magic-items#Attunement).
- El botón genérico **Usar** y su operación de dominio no comprueban sintonización, a diferencia de las capacidades y conjuros de objeto. Hay que unificar las condiciones de acceso.
- El editor ofrece `dawn`, pero el botón de recuperación usa `at-dawn`. Maelion tiene dos recursos con `dawn` que no coinciden con ese botón.
- Existe un botón de amanecer: **no falta por completo ese flujo**. Su operación actual rellena el recurso al máximo, sin una fórmula de recuperación. En el catálogo visible hay 45 recursos `at-dawn`, uno `at-dusk`, 14 sin regla, tres de descanso corto y dos de descanso largo.
- **Usar una poción** reduce cantidad; no calcula ni aplica automáticamente su curación o efecto. Una tirada insertada en el texto tampoco equivale a aplicar el resultado a la ficha.

Se revisaron las rutas del cargador/normalizador, inventario, proyecciones, descansos, editor de capacidades, conjuros de objeto y visor. No se modificó ninguna de ellas.

## 7. Organización y estándar propuestos para discutir

Cada objeto debería distinguir **definición**, **variante de campaña** y **copia poseída**. La definición reúne nombre, fuente, reglas y capacidades; la variante conserva los cambios autorizados; la copia guarda propietario, cantidad, estado, sintonización y recursos gastados. El alias de una espada o un escudo infundido no deberían obligar a duplicar y descoordinar la definición base.

Para revisar una entrada propongo esta ficha de contenido:

| Bloque | Contenido |
| --- | --- |
| Identidad | Nombre en español, alias, clave estable, objeto base si es una variante. |
| Procedencia | Libro/autoría, reglas 2014, página cuando esté verificada, estado de cotejo. |
| Clasificación | Familia, rareza, forma de llevarlo, mágico/no mágico, consumible. |
| Descripción | Texto de fuente y ambientación de campaña claramente separados; párrafos, listas y tablas legibles. |
| Requisitos | Sintonización y sus requisitos de clase, lanzamiento, competencia u otros; reglas especiales autorizadas. |
| Capacidades | Nombre, disparador/acción, alcance/objetivo, condición, efecto, tirada/CD, duración. |
| Recursos | Cargas/usos/capacidad, coste por opción, evento y fórmula de recuperación, consecuencias de agotamiento. |
| Estado de implementación | Automatizado, asistido con confirmación del GM o solo descriptivo. |

El motor debe interpretar capacidades declaradas, no intentar deducir reglas de la descripción cada vez que se usa el objeto. Para usos condicionales o narrativos, la interfaz puede explicar y registrar la resolución del GM sin fingir una automatización completa.

## 8. Orden recomendado para el trabajo posterior

1. **Resolver identidad y excepciones de objetos usados**, empezando por los casos anteriores y las dos versiones de Daga del Umbral. Conservar un mapa de correspondencias y los cambios propios de cada ficha.
2. **Acordar el estándar de datos y texto**, incluyendo procedencia pendiente y las diferencias entre definición/variante/posesión. No dar por válidas las etiquetas actuales.
3. **Corregir los flujos comunes** de sintonización, acceso, recargas y vínculo con catálogo/tutorial. Esto evita que una limpieza vuelva a degradarse al crear otro personaje.
4. **Recuperar y normalizar contenido por familias**, separando correcciones de formato de cambios de reglas; cotejar los textos oficiales con las fuentes admitidas.
5. **Implementar capacidades por familias**, empezando por los objetos en uso. Ofrecer un indicador claro de qué hace la aplicación y qué requiere resolución en mesa.
6. **Revisar duplicados y posibles retiradas al final**, cuando las copias y los comercios estén vinculados y verificados. La similitud de nombre o tener una versión inglesa oculta no basta para borrar.

No hace falta decidir aún cuál de cada par se elimina. El siguiente entregable útil sería una lista pequeña de objetos usados con: versión propuesta, diferencias que se conservan, reglas faltantes y decisión pendiente del GM.

## Archivos de respaldo del análisis

- [Catálogo clasificado: 1.609 filas](item-audit-2026-10-16/catalogo-clasificado.csv).
- [Inventarios clasificados: 228 filas](item-audit-2026-10-16/inventarios-clasificados.csv).
- [20 versiones de ECE divergentes de la base](item-audit-2026-10-16/versiones-divergentes.csv).
- [34 grupos de nombres coincidentes](item-audit-2026-10-16/duplicados-por-nombre.csv).
- [Resumen de datos y ejemplos](item-audit-2026-10-16/resumen.json).
- [Verificación final de la instantánea](item-audit-2026-10-16/verificacion.json).

La comprobación final confirmó que las claves/revisiones/fechas del catálogo de ECE y las revisiones de sus inventarios seguían coincidiendo con la extracción. Los hashes de los payloads compartidos también coincidían. Las consultas remotas utilizadas fueron únicamente SELECT. Las señales automáticas son candidatos de revisión, no una orden de cambios, ni una auditoría completa de fidelidad de todos los textos. Las instantáneas de trabajo están en `tmp/item-audit/`; `scripts/audit-existing-items.mjs` analiza esos archivos offline y genera los listados.
