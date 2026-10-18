# Catálogo definitivo de objetos: formato y migración sin pérdida de información

17 de octubre de 2026. Incorpora el orden indicado por el usuario después del análisis de hallazgos. Este documento define el diseño propuesto; no crea objetos, modifica fichas ni autoriza ejecutar eliminaciones antes de cumplir las condiciones descritas.

## 1. Orden acordado

1. Definir el formato del objeto, la descripción, las capacidades y su funcionamiento en el symbiote.
2. Preparar el soporte de plataforma necesario para guardar, editar, mostrar y ejecutar ese formato sin perder campos.
3. Construir y validar la base completa de objetos definitivos en español, combinando la información útil de todas las versiones existentes.
4. Cuando esa base esté completa, vincular a ella las copias de personajes y comerciantes, conservando sus estados y personalizaciones.
5. Comprobar que ninguna versión antigua dentro del alcance siga utilizándose y que toda información útil haya sido trasladada o resuelta.
6. Borrar las versiones antiguas reemplazadas. Cuando el catálogo activo solo contenga definitivos, retirar la etiqueta temporal `definitiva`.

Se pueden revisar y ensayar objetos usados durante la preparación, sin migrar todavía las posesiones activas. La fase de construcción conserva los originales ingleses y españoles como material de trabajo. Una copia de seguridad es una protección adicional: no sustituye completar los objetos nuevos con la información útil recuperada.

El alcance sigue siendo el catálogo compartido y ECE. Las copias de las otras campañas se conservan. La condición de cero usos antiguos se evalúa para la retirada dentro de este alcance; no se considera autorización para migrar o borrar contenido de otras campañas.

## 2. Tres piezas separadas

| Pieza | Contenido | Identidad |
| --- | --- | --- |
| Definición definitiva | Nombre, procedencia, clasificación, descripción, requisitos, estadísticas, capacidades y reglas de recursos. | Clave estable y revisión propias, independientes del nombre visible y de índices heredados. |
| Variante de campaña | Relación con la base y diferencias de reglas autorizadas; también puede ser una definición custom sin base oficial. | Identidad propia cuando cambian reglas; un alias por sí solo no necesita duplicar toda la definición. |
| Copia poseída | Propietario, cantidad, ubicación, nombre personal, equipo, sintonización, recursos actuales, contenido almacenado y modificaciones personales. | Mantiene su ID al migrar; referencia la definición y revisión correspondientes. |

Una versión de campaña completa y validada también puede ser definitiva. «Definitiva» no significa «oficial» ni permite fusionar objetos distintos con un mismo nombre.

La definición describe máximos y recuperación; la copia guarda lo gastado y las decisiones del portador. No guardar cantidad poseída, estado de sintonización o cargas actuales como reglas comunes del catálogo. Los valores iniciales de un objeto recién generado se especifican aparte y no se aplican a copias existentes durante la migración.

## 3. Contrato de la definición

Estos bloques definen las responsabilidades del nuevo formato. Los nombres finales de campos y su versión de esquema se concretan antes de implementar; no se deben introducir como campos sueltos en el formato actual esperando que sus serializadores los conserven.

| Bloque | Datos que debe representar |
| --- | --- |
| Identidad y versión | Clave estable, revisión, nombre español, alias de búsqueda, identidad de la base si procede e identificadores externos como referencias, no como identidad deducida. |
| Procedencia | Oficial/custom, libro o autoría, edición de reglas, página o sección cuando se conoce, fuentes de las que se recuperó cada bloque y estado del cotejo. Identificar un libro no lo habilita automáticamente en la campaña. |
| Clasificación | Familia, subtipos, mágico/no mágico, rareza, consumible y propiedades mediante valores estables con etiquetas españolas. Admitir munición, monturas, vehículos y accesorios. |
| Magnitudes y economía | Peso y unidades; precio base cuando existe, precio de campaña y criterio comercial separados. Ausencia de precio no equivale a precio cero. |
| Descripción | Bloques españoles de texto, listas y tablas; separación entre reglas, ambientación y notas del GM. Identificar traducciones propias y procedencia de fragmentos recuperados. |
| Estadísticas | Arma, armadura, escudo, herramientas, capacidad de transporte u otros datos específicos que correspondan a la familia. Separar base, bonificaciones y efectos condicionados. |
| Requisitos de uso | Posesión, llevar puesto, empuñar, sintonización, restricciones del portador y condiciones específicas de cada capacidad. Separar requisito del estado actual de la copia. |
| Capacidades | Identificador estable, nombre, activación/disparador, requisitos, objetivo/alcance, coste, resolución, efectos, duración y finalización. |
| Recursos | Identificador estable, tipo, capacidad/máximo, costes vinculados, recuperación por evento y cantidad/fórmula, límites y consecuencias de agotamiento cuando correspondan. |
| Contenido y relaciones | Conjuros concedidos o almacenados, componentes consumibles, objetos contenidos y sus restricciones cuando proceda. Una capacidad debe referenciar datos reales, no solo un nombre libre. |
| Resolución en el symbiote | Qué se ejecuta automáticamente, qué se resuelve con una interacción asistida y qué exige adjudicación narrativa del GM. Las limitaciones deben ser explícitas por capacidad. |
| Validación y recuperación | Resultados de revisión editorial y funcional, conflictos resueltos, versiones antiguas de origen, mapa de sustitución y diferencias justificadas. La evidencia de trabajo no llena la descripción pública del objeto. |

Los bloques no aplicables se omiten de la presentación. En preparación, «desconocido», «no corresponde», cero, falso y «sin recuperación» son estados diferentes. Antes de declarar definitiva una entrada, los datos necesarios para sus reglas deben estar resueltos; no se rellenan con valores por defecto para pasar una validación.

## 4. Formato de descripción y recuperación bilingüe

La presentación utiliza nombre/tipo/fuente en la cabecera; después descripción y capacidades con párrafos, listas y tablas legibles según el contenido del objeto. No obliga a fabricar texto para bloques que la fuente no contiene.

Para cada objeto se comparan todas las versiones candidatas, incluidas las inglesas: descripción, estadísticas, propiedades, requisitos, capacidades, recursos, notas y modificaciones. Se conserva el origen de cada aportación. Información contradictoria se registra como conflicto; no se mezclan automáticamente todos los beneficios en una definición nueva.

Cuando falta información española, se recupera de la versión inglesa antes de retirarla. Para el texto final se usa la traducción oficial española cuando esté disponible; si se necesita traducir desde el inglés, la traducción debe ser fiel, revisada y distinguible de un texto oficial español cotejado. La base activa definitiva se presenta en español. El texto inglés de trabajo se conserva con su procedencia hasta comprobar que no queda información útil pendiente de trasladar.

La limpieza de HTML debe conservar texto, jerarquía, condiciones y tablas; no se limita a borrar etiquetas. El JSON incrustado se recupera como estructura candidata, comparando exterior e interior antes de decidir qué definición o variante representa. Los originales completos y diferencias permanecen en la evidencia de recuperación, fuera del catálogo activo final.

Para cada campo o fragmento de una versión antigua debe constar uno de estos destinos: incorporado a la definición, conservado en una variante o copia personal, repetido ya representado, o descartado por error demostrado con motivo documentado. Lo no resuelto bloquea la retirada.

## 5. Capacidades y mecánicas que debe cubrir el diseño

| Familia funcional | Representación y comportamiento necesarios |
| --- | --- |
| Armas y armaduras | Datos base y bonificaciones aplicables, propiedades, requisitos, CA, ataques y daños sin duplicar bonificaciones ya incluidas. |
| Daño adicional | Componentes por tipo, condición/disparador, objetivo y gasto; permitir elegir opciones sin aplicar siempre todo el daño. |
| Atributos y otros efectos | Sumar, fijar o establecer mínimos según la regla; ventajas, resistencias, inmunidades, movimiento y otros efectos con requisitos, acumulación y finalización. No simular fijar un atributo mediante una suma. |
| Conjuros | Referencia al conjuro, nivel permitido, atributo/CD/ataque o valores fijos, componentes y costes/excepciones propios del objeto. Vincular al objeto y capacidad concretos que los conceden. |
| Recursos | Distinguir cargas recargables, usos por capacidad, reservas finitas y componentes consumidos. Expresar evento de recuperación y cantidad o tirada; no rellenar siempre al máximo. |
| Almacenamiento | Contenido real, capacidad y coste de espacio, alta y retirada de cada elemento; conservar los datos de origen que requiera la regla, incluido el lanzador de un conjuro almacenado. |
| Efectos temporales | Activación, objetivos, duración, concentración si corresponde, fin anticipado y modificaciones que deben retirarse. Mantenerlos vinculados a su instancia de origen. |
| Consumo y adjudicación | Registrar cantidades, costes y resultados de acciones asistidas de forma coherente, sin descontar dos veces ni aplicar efectos si falla el uso. Las reglas narrativas se muestran y registran sin inventar automatismos. |

El modelo debe permitir representar el texto completo y las reglas de todas las familias encontradas, y detectar capacidades que todavía no tienen soporte. Un campo libre de notas no convierte una función pendiente en implementada. La resolución manual narrativa es válida cuando es la forma prevista de usar la capacidad; no se usa para ocultar un efecto de ficha que falta implementar.

## 6. Condiciones para marcar `definitiva`

La etiqueta es temporal y no es una categoría física ni una fuente. Solo se asigna cuando el objeto cumple conjuntamente:

- Identidad y variantes resueltas, sin confusión por nombre o índice.
- Información útil recuperada de las versiones españolas e inglesas, con conflictos cerrados y procedencia trazable.
- Presentación completa en español y estado editorial descrito con honestidad, sin atribuir una traducción propia a la edición española oficial.
- Estadísticas, requisitos, capacidades y recursos completos y consistentes para esa definición.
- Datos que sobreviven a guardar, editar, exportar, importar y volver a cargar sin perder campos.
- Capacidades utilizables según lo declarado, con costes, condiciones y efectos comprobados; sin soporte faltante disimulado mediante texto.
- Pruebas de las familias de mecánicas y una revisión del objeto concreto; las pruebas de carga por sí solas no demuestran fidelidad a las reglas.

No hace falta que el objeto conceda poderes, tenga precio fijo o muestre un botón Usar para ser completo. Un objeto sencillo puede ser definitivo con sus datos correctos y sin capacidades adicionales.

## 7. Bloqueos reales del formato actual

La inspección del código muestra puntos que deben resolverse antes de poblar el formato nuevo:

- El payload de equipo actual deriva del borrador de una copia poseída e incluye cantidad, equipo, sintonización y cargas actuales. Hay que separar definición y estado sin perder el formato legado durante la transición.
- Los esquemas y serializadores actuales no declaran los bloques nuevos de procedencia, texto estructurado y mecánicas. Añadirlos solo al JSON no garantiza que sobrevivan al editor y a la próxima escritura.
- El payload versionado de inventario de monstruos/NPC omitía `catalog`. Esto ya se corrigió para nuevas escrituras: la referencia se conserva también en comerciantes, con pruebas de serialización y recarga. Los NPC existentes todavía no se migraron.
- La búsqueda y algunas operaciones de catálogo todavía identifican por nombre. Los nombres homónimos y los alias requieren claves estables en edición, clonación, selección, compra y venta.
- La biblioteca local del tutorial y las rutas de importación/clonación deben crear referencias al catálogo nuevo o definiciones nuevas bajo el mismo contrato. Si siguen creando copias antiguas, la migración nunca se cierra.
- Conjuros y acciones concedidos por objetos se vinculan a IDs de instancia y capacidad. Migrar requiere conservarlos o remapearlos verificablemente, sin conceder duplicados ni dejar vínculos rotos.

Los adaptadores legados siguen disponibles durante la preparación y migración. Se revisarán también los problemas de equipar/sintonizar, acceso a capacidades y recuperación identificados en la auditoría.

## 8. Construcción completa antes de migrar posesiones

Se prepara un manifiesto finito del alcance: todas las entradas antiguas compartidas y de ECE, sus candidatos, variantes y datos de copias que puedan aportar información ausente. También se examinan los objetos sin coincidencia de personajes y comerciantes; no se supone que el catálogo antiguo contenga todo.

Cada identidad válida tiene un destino: definición definitiva base o de campaña, variante definitiva, o contenido exclusivamente personal que conserva su información y no necesita convertirse en objeto universal. Cada duplicado tiene una equivalencia demostrada; cada error descartado tiene un motivo. Cualquier destino desconocido mantiene el caso abierto.

Los objetos nuevos se construyen en una colección o vista de preparación distinguible mediante `definitiva`, conservando el catálogo antiguo utilizable hasta el cambio. No se crean dos opciones indistinguibles para jugadores durante esta convivencia. Se permite preparar lotes por familia, pero se inicia la migración activa cuando el manifiesto completo de este alcance esté resuelto y sus destinos necesarios estén listos.

## 9. Vincular copias sin reiniciar personajes o comercios

Antes de escribir se prepara una simulación por copia: versión antigua, destino, datos conservados, campos corregidos, personalizaciones y vínculos afectados. La referencia de catálogo y la configuración de reglas se migran juntas cuando corresponde; cambiar solo la referencia puede dejar estadísticas antiguas funcionando.

Se conservan los IDs de instancia, propietario, cantidad, ubicación, nombre personal, notas, equipo y sintonización válidos, recursos actuales, contenidos almacenados y cambios autorizados. Corregir un máximo no repone cargas. Cuando el estado viejo es indeterminado o una restricción nueva entra en conflicto con la copia, se resuelve ese caso explícitamente antes de aplicarlo.

Las diferencias se comparan contra la versión antigua que originó la copia, cuando existe. Si no se puede distinguir una personalización de un error, no se sobrescribe por deducción. Una modificación útil se conserva como variante o ajuste de la copia con identidad y motivo propios.

En comerciantes se migra el inventario del NPC que realmente aporta el stock. Varias tiendas pueden compartir ese NPC: se actualiza una vez y se preservan cantidades, precios propios y asociaciones de las tiendas. También se contemplan entradas comerciales heredadas por nombre, NPC no vinculados a tiendas y rutas de compra/venta.

Se validan conjuros concedidos/almacenados, acciones, capacidades, efectos activos y recursos vinculados. Las operaciones deben ser recuperables, detectar cambios concurrentes y poder repetirse sin duplicar objetos o conceder recursos.

## 10. Retirada y cierre

No basta con contar referencias explícitas: hay copias antiguas sin referencia y rutas basadas en nombres. Antes de retirar una versión se verifica:

1. Destino definitivo completo, diferencias resueltas e información útil trasladada.
2. Cero usos pendientes en personajes, comerciantes/NPC, relaciones comerciales heredadas, conjuros, acciones, efectos y recursos del alcance.
3. Cero copias antiguas aún sin clasificar; las coincidencias solo por nombre no se dan por resueltas automáticamente.
4. Tutorial, editor, importaciones, clonaciones y comercio ya producen y conservan el formato nuevo.
5. Las copias de otras campañas mantienen sus definiciones y su acceso; retirar una fila compartida no rompe una dependencia externa al alcance.
6. Copia de recuperación, mapa de sustituciones y comprobaciones anteriores/posteriores disponibles, sin conservar por ello un catálogo activo duplicado.

Cumplidas esas condiciones, se borran las versiones reemplazadas dentro del alcance. Los IDs antiguos pueden quedar en el registro de migración como evidencia o redirección, sin requerir que sobreviva la definición vieja en el catálogo activo.

Cuando todas las entradas activas sean definitivas se retira `definitiva` de etiquetas y filtros. Se conservan las fuentes y la trazabilidad que sigan siendo útiles. La validación permanece en el flujo de creación y edición: quitar la etiqueta no debe permitir que vuelvan a entrar objetos incompletos como si estuvieran validados.

## 11. Siguiente entregable

La [implementación de preparación](EQUIPMENT_FORMAT_IMPLEMENTATION.md) contiene el contrato separado del formato activo, conservación íntegra de originales, contabilidad de recuperación, editor del GM y persistencia de borradores. Se corrigió la pérdida de referencias en inventarios de NPC. Las decisiones sobre fuentes oficiales de 2014 existentes, traducciones propias revisadas y resolución asistida con una lista visible de automatizaciones pendientes fueron confirmadas por el usuario. «Hoja Fásica» queda exclusivamente en la variante de Stix.

Los 806 borradores ya están guardados en ECE, separados de las opciones utilizables y cargados bajo demanda al abrir la preparación del GM. Once tienen un primer cotejo de equipo básico, con 220 destinos de campos originales comprobados; los otros 795 siguen pendientes de ese cotejo. Ninguno se presenta como definitivo. El siguiente trabajo es cotejar y completar las demás familias reales, integrar su ejecución y cerrar la cobertura de información del manifiesto completo. La migración de posesiones y la retirada de versiones antiguas siguen siendo posteriores.
