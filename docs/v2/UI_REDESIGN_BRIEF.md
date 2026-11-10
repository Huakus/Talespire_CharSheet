# Brief del rediseño: jerarquía y uso durante la partida

Fecha: 2026-11-02.
Estado: alcance y problema confirmados; principios y distribución propuestos.
Documento principal: [plan del rediseño](UI_REDESIGN_PLAN.md).
Implementación iniciada: [estado, límites y siguiente tarea](UI_REDESIGN_PROGRESS.md).

## Necesidad expresada por el usuario

El alcance comprende todo el symbiote, avanzando por etapas.

El usuario confirmó que utiliza el symbiote como **panel lateral abierto
durante gran parte de la partida**. Aún no se conocen sus dimensiones habituales.

El usuario siente que la interfaz se construyó para mostrar toda la información
necesaria, sin suficiente atención al diseño de UI. Entre tantas opciones se
pierden textos y propiedades. Solicita explicación de conceptos, propuestas y
su aplicación a las funcionalidades y al uso del symbiote.

Este diagnóstico de uso es aportado por el usuario. Las capturas posteriores se
revisan en el documento de dirección visual; sigue pendiente medir recorridos
y comprobar tamaños reales dentro de TaleSpire.

## Objetivo de producto propuesto

Que el jugador o GM pueda reconocer el estado relevante, encontrar la acción
que necesita y entender el resultado sin recorrer información ajena a su tarea.
Mantener la cobertura funcional durante la renovación.

El usuario aporta hábitos, problemas y valoración de los bocetos. El asistente
asume la elaboración de alternativas, sus fundamentos y los compromisos de
cada elección, explicándolos en lenguaje simple.

## Primer concepto: jerarquía

La jerarquía define el orden de atención de una pantalla: qué se ve primero,
qué se compara después y qué queda disponible para consultar. Tamaño, peso
tipográfico, contraste, separación y agrupación deben expresar ese orden.

Ejemplo propuesto: durante una partida, los PG y una condición activa tendrán
mayor protagonismo que la lista completa de idiomas. Al consultar un objeto,
su capacidad utilizable deberá distinguirse de sus etiquetas de catálogo.

La jerarquía visual se fundamenta en [NN/g: Visual Hierarchy in UX](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/).
Las prioridades concretas anteriores son hipótesis para este symbiote.

## Tres niveles de información propuestos

Estos niveles describen responsabilidades, no tres columnas ni una estructura
de pantallas ya elegida. El espacio persistente deberá ajustarse al tamaño real
del panel para no desplazar el contenido principal.

| Nivel | Pregunta que responde | Ejemplos de jugador | Ejemplos de GM |
| --- | --- | --- | --- |
| Estado relevante | ¿Qué ocurre y a quién estoy controlando? | Personaje seleccionado, PG, condiciones y efectos activos relevantes | Turno activo, combatiente seleccionado y su estado |
| Tarea actual | ¿Qué puedo hacer y qué necesito saber para hacerlo? | Tirar una prueba, usar un recurso, lanzar un conjuro o gestionar un objeto | Consultar una defensa, tirar una acción o aplicar daño a una criatura |
| Consulta y configuración | ¿Qué necesito entender en detalle o preparar? | Texto completo, procedencia de un valor, progresión y edición | Bloque completo de criatura, asociación con miniatura y edición de contenido |

Un dato puede cambiar de nivel según el contexto. El dinero puede ser
secundario durante un ataque y esencial al comerciar. Una resistencia puede
ser esencial al resolver daño aunque el resto del texto de la criatura esté
en detalle. La estructura debe conservar posiciones y rótulos predecibles.

Mostrar primero lo frecuente y ofrecer acceso al detalle es una aplicación de
[divulgación progresiva](https://www.nngroup.com/articles/progressive-disclosure/).
Como advierte [GOV.UK sobre información desplegable](https://design-system.service.gov.uk/components/details/),
no se debe relegar información que la mayoría de los usuarios necesita para
completar la tarea. No se propone plegar todo indiscriminadamente.

## Principios de diseño para evaluar en bocetos

| Principio | Aplicación propuesta | Cómo revisar si funciona |
| --- | --- | --- |
| Prioridad por tarea | Definir qué debe poder decidir el usuario en cada vista | Pedir que encuentre y resuelva una tarea concreta, sin indicarle dónde |
| Agrupación por significado | Mantener juntos un recurso, su valor y las acciones que lo consumen o recuperan | Comprobar si se entiende qué elemento modifica cada control |
| Lectura por capas | Usar nombre, resumen operativo y detalle completo con acceso reconocible | Localizar una propiedad poco frecuente sin perder la selección ni los filtros |
| Texto legible | Resolver espacio mediante distribución y prioridades; establecer tamaños y contraste al diseñar componentes | Probar con texto largo y el tamaño habitual del panel |
| Acciones reconocibles | Distinguir lectura, ejecución y edición; acompañar iconos ambiguos con texto | Identificar qué ocurrirá antes de pulsar y qué cambió después |
| Color con propósito | Reservar énfasis para selección, acción y estados con significado | Entender el estado también mediante texto o forma y conservar contraste |
| Continuidad | Mantener foco, scroll, borradores y selección durante actualizaciones | Recibir un cambio mientras se escribe o consulta información |

Son propuestas de diseño; no equivalen a especificaciones cerradas de
componentes, paletas o tamaños.

## Ejemplos para el primer recorrido de diseño

### Jugador: elegir y lanzar un conjuro

Primero hay que distinguir el nombre y los datos para elegir: tiempo de
lanzamiento, alcance, resultado pertinente (ataque, salvación, daño o efecto),
disponibilidad, coste y estados relevantes como concentración o preparación.
La acción de lanzar debe quedar vinculada visualmente a ese conjuro y al nivel
elegido. Si no se puede ejecutar, se debe poder entender la causa.

La descripción completa, las excepciones y las opciones de edición necesitan
un acceso claro y una lectura cómoda. Cualquier excepción que cambie la decisión
de lanzamiento deberá mantenerse accesible en ese contexto. No se decidirá
qué información omitir sin revisar ejemplos reales de conjuros de tipos distintos.

### Jugador: consultar o usar equipo

Separar visualmente identidad del objeto, estado de posesión/equipo y capacidades
utilizables. Cantidad, cargas, sintonización e identificación tienen implicaciones
distintas y no deben presentarse como etiquetas equivalentes.

El inventario personal y el catálogo tienen tareas diferentes. Los controles
deben permitir reconocer si se consulta una referencia o una copia poseída.

### GM: resolver el turno de una criatura

La cola debe permitir reconocer el turno y seleccionar al combatiente. En el
contexto seleccionado se necesitan las defensas, acciones y recursos pertinentes.
La configuración de asociaciones y la edición de la criatura deben distinguirse
de las operaciones de combate. El panel no deberá cambiar de objetivo sin que
el GM lo reconozca.

Ya hay patrones de detalle y turno activo en el código actual; se evaluará su
eficacia antes de sustituirlos. Estos ejemplos no afirman que la UI actual
carezca por completo de jerarquía o agrupación.

## Revisión inicial de fuentes

- `renderCharacterForm` en `src/ui/browser-app.ts`: cabecera con identidad,
  PG, CA, iniciativa, modo de tirada, inspiración, monedas y descansos.
- `renderSummaryPlay`: recursos, paneles de clase, efectos activos,
  características, pasivas, habilidades, salvaciones, condiciones y competencias.
- `renderSharedInventoryCard` en `src/ui/inventory-view.ts`: identidad,
  categoría, rareza, peso, estadísticas, descripción, etiquetas, propiedades y
  acciones, con controles provistos por el consumidor.
- `renderCombatant` en `src/ui/gm-app.ts`: turno, datos del combatiente,
  asociación, estados, estadísticas rápidas, accesos de acción y detalle.

Estas fuentes confirman la cantidad y variedad de contenido. No permiten por
sí solas concluir qué se lee mal o cuánto espacio ocupa dentro de TaleSpire.

## Criterios de éxito propuestos

Comparar la interfaz actual y los futuros bocetos con las mismas tareas,
personajes ficticios y tamaños de panel. Registrar tiempo para encontrar la
acción o propiedad, errores, retrocesos, cambios de sección y valoración de
claridad. Establecer objetivos medibles después de obtener una referencia.

Casos mínimos: personaje con pocos recursos, lanzador de nivel alto, inventario
extenso, criatura con varias acciones y textos largos. Revisar teclado, foco,
contraste y pérdida de contexto durante actualizaciones.

Una mejora de estética no cerrará por sí sola una etapa: las tareas elegidas
deben poder completarse y conservar el acceso a la información pertinente.

## Siguiente decisión

Revisar los [lineamientos y alternativas visuales](UI_REDESIGN_VISUAL_DIRECTION.md)
antes de aplicar más cambios de presentación, según el último pedido del usuario.
El verde no es obligatorio. Ninguna paleta o alternativa está elegida todavía.
La [primera propuesta de distribución lateral](UI_REDESIGN_LAYOUT.md) sigue
como referencia funcional.
El tamaño real del panel, la navegación definitiva, el estilo visual y la
tecnología siguen pendientes. El boceto de conversación usa datos ficticios y
solo demuestra organización e interacción local.
