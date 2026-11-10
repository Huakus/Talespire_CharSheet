# Convivencia y transición entre interfaces

Fecha: 2026-11-03.
Estado: primera implementación autorizada y realizada el 2026-11-03. Selector
local y piloto de consulta disponibles; validación real en TaleSpire pendiente.
Leer [continuidad y siguiente tarea](UI_REDESIGN_PROGRESS.md) al retomar.

Último ajuste, 2026-11-09: cabecera común con selector/Editar/Más opciones en
todas las secciones, sin clase repetida debajo del nombre. **El bloque completo
desde nivel hasta Desventaja está dentro de Ficha**, también en Personajes del
GM; no se repite en la cabecera ni en las demás vistas. Reúne cifras principales
y una franja de identidad/controles: valores sin títulos ni etiquetas visibles,
tooltips con los nombres de campo, Inspiración con nombre/estado en línea y
controles de 26 px para mouse (44 px táctiles). Modos apilados verde/rojo, PG
con barra y resaltado verde→rojo y elección de color mediante `editCharacter`
se conservan; nivel mantiene el aro de 54 px y PX en tooltip/panel.
Nueva y el único HTML de revisión conservan el mismo patrón. Actual continúa
por defecto, la elección de interfaz sigue local y la edición general/descansos
siguen en Actual. Inspección real dentro de TaleSpire pendiente.

Entrega vigente 2026-11-08: Nueva ya permite PX/subida guiada, inspiración,
ventaja/desventaja temporal o bloqueada y pruebas d20 de habilidades, atributos
y salvaciones, mediante lógica/comandos compartidos. A 0 PG solo permite gestionar
salvaciones de muerte y curar. El tercer éxito recupera 1 PG en una operación
atómica compartida con Actual (cambio pedido por el usuario). Selector local,
Actual por defecto y regreso siguen disponibles. Ataques/conjuros, descansos,
edición general y otras operaciones todavía se realizan desde Actual.
El texto siguiente conserva el contrato y antecedentes de las primeras entregas.

Entrega posterior autorizada el 2026-11-04: Nueva incorpora la Ficha compacta
revisada con personajes reales, iconos oficiales locales y tooltips de procedencia.
Usa las proyecciones del dominio, protege fuentes de objetos sin identificar y
marca los desgloses faltantes. El jugador inicia en Ficha; el GM entra por
Personajes. Las operaciones de la maqueta no se trasladaron: las acciones siguen
en Actual. Revisión visual en TaleSpire pendiente; contrato y próximos pasos en
`UI_REDESIGN_PLAN.md` y `UI_REDESIGN_PROGRESS.md`.

Corrección posterior a la primera prueba del usuario: los imports condicionales
se convertían, al minificar, en una carga con el CSS de Actual también para Nueva.
Se reemplazaron por un registro de loaders independientes. La nueva prueba V2
`interface-build.test.ts` comprueba los CSS del build real con minificación;
no basta con verificar imports simulados o el servidor de desarrollo.
Origen: el usuario pregunta cómo probar la interfaz nueva y volver a la actual
sin cambiar la experiencia de los demás jugadores.
Referencias: [plan](UI_REDESIGN_PLAN.md), [brief](UI_REDESIGN_BRIEF.md).

## Primera entrega implementada

El control «Interfaz» aparece sobre la aplicación y permanece disponible aunque
falle una vista. Permite elegir Actual o Nueva para la siguiente recarga; no
interrumpe ni recarga automáticamente una sesión de juego/edición. Guardar y
resolver las operaciones antes de usar Recargar de TaleSpire sigue siendo una
acción explícita del usuario. Ocultar el panel no aplica el cambio.

Nueva ofrece un piloto de lectura de los datos existentes. Su regreso a Actual
es inmediato y forzado por URL si hace falta, porque no hay edición ni acciones
de juego en ese piloto. La elección inicial continúa siendo Actual.

`src/main.ts` prepara los servicios compartidos y carga `classic-views.ts` o
`next/next-views.ts`. La presentación no seleccionada y su CSS no se importan.
Las vistas clásicas permanecen sin modificaciones. El piloto GM evita el
sembrado de contenido y no arranca la sincronización de combate de `GmApp`.

Esta entrega adapta la propuesta inicial: el selector se aplica en la siguiente
recarga en lugar de intentar resolver todos los borradores y operaciones para
cambiar inmediatamente desde un editor activo. Esa transición inmediata queda
pendiente; ver el estado detallado y las pruebas en `UI_REDESIGN_PROGRESS.md`.

## Experiencia objetivo

La ubicación definitiva dentro de Ajustes se evaluará en el rediseño. La primera
entrega expone Interfaz sobre la aplicación, con dos opciones rotuladas:

- **Actual:** seleccionada por defecto durante la transición.
- **Nueva · en pruebas:** activación voluntaria en este cliente.

La elección se recuerda en el almacenamiento local de preferencias del cliente,
separado del documento de campaña. No se envía como cambio de personaje,
catálogo, permisos o estado de combate, ni como un mensaje para otros clientes.
Se conserva un regreso visible desde la nueva interfaz y un acceso de
recuperación durante el arranque que no dependa de que la nueva UI funcione.

La preferencia es por instalación/perfil local, no una configuración de todos
los miembros de la campaña ni una preferencia sincronizada entre equipos.
Si dos personas usan el mismo perfil local, pueden compartir la elección;
no se promete aislamiento por cuenta sin diseñarlo expresamente.

## Alcance de la independencia

Cada cliente puede mostrar una interfaz distinta sobre el mismo modelo de juego.
Ejemplo: el GM utiliza Actual, un jugador Nueva y otro Actual.

Cambiar de presentación no debe escribir cambios de campaña. Las acciones de
juego ejecutadas desde cualquiera de las dos interfaces conservan sus efectos
y se sincronizan como hoy. Gastar un recurso o aplicar daño desde Nueva cambia
los datos compartidos; volver a Actual muestra ese resultado. El selector no
restaura una copia anterior de la ficha ni revierte operaciones.

Una preferencia local limita el alcance de la elección visual. No impide que
un error en una operación de juego afecte datos compartidos: las operaciones
deben seguir usando la lógica existente y verificarse antes de habilitarlas.

## Fundamento en el código actual

- `src/ui/symbiote-preferences.ts` ya encapsula preferencias mediante
  `window.localStorage` con el prefijo `talespire-charsheet:v2:preference`.
  Captura errores para que una preferencia no bloquee el symbiote.
- `src/main.ts` prepara servicios e integraciones y arranca `BrowserApp` o
  `GmApp` según el entorno y rol. También abre fichas de jugador desde el GM.
- `BrowserApp` dispone de `savePendingChanges()` y `stop()`, pero no registra
  todas las funciones de desuscripción devueltas durante el arranque.
- `GmApp.stop()` libera polling y recursos de miniaturas; otras suscripciones
  de su arranque no se conservan para liberarlas allí.
- `FormDraftStore` mantiene borradores en memoria. Una recarga los pierde si
  no se guardan o resuelven expresamente antes de cambiar.
- `src/main.ts` importa estilos actuales globalmente. Cargar otra interfaz
  requiere aislar estilos y efectos de importación.
- El arranque del GM incluye sincronización de personajes y preparación de
  contenido. Su ejecución e idempotencia deben revisarse para que seleccionar
  o recuperar una vista no genere escrituras de campaña redundantes.

Estas observaciones justifican comenzar con recarga del panel en lugar de
mantener dos aplicaciones montadas o intercambiarlas en vivo inmediatamente.

## Arquitectura propuesta

Un arranque compartido establece el entorno, rol, permisos, repositorios,
operaciones e integraciones. Un contenedor de interfaz consulta la preferencia
local y carga únicamente la presentación elegida.

```text
Preferencia local → Contenedor de interfaz
                         ├─ Actual
                         └─ Nueva
                               ↓
              Casos de uso e integraciones compartidos
                               ↓
                    Mismos datos de campaña
```

Límites de implementación:

1. Mantener una única interfaz activa por panel. No arrancar ambas ocultando una
   con CSS: duplicaría suscripciones y podría duplicar efectos de juego.
2. Cargar el código de presentación elegido mediante importación diferida,
   evitando ejecutar módulos de la nueva UI para quienes usan Actual.
3. Compartir operaciones de dominio/aplicación y adaptadores. La nueva interfaz
   no reimplementa reglas, permisos, contadores ni escrituras de datos.
4. Extraer controladores de interacción reutilizables cuando una acción esté
   hoy acoplada a `BrowserApp` o `GmApp`. Cada extracción se verifica también
   con Actual antes de consumirla desde Nueva.
5. Separar estilos comunes de los específicos. El arranque no debe cargar
   globalmente el CSS de ambas presentaciones. Los estilos nuevos deben tener
   alcance de su raíz y no modificar controles de Actual o del arranque.
6. Mantener formatos y protocolo compatibles durante la convivencia. Un cambio
   de datos que requiera migración se evalúa como una entrega independiente.
7. Las fichas abiertas desde el GM deben respetar una regla explícita de selección
   de UI; propuesta inicial: la misma preferencia local del cliente, con regreso
   seguro al panel GM. Su ciclo de guardado/cierre debe cubrirse en pruebas.

Una clave candidata es `interface-version` dentro del prefijo existente, con
valores `classic` y `next`. Ausencia, valor inválido o versión no disponible
resuelven a Actual. El mecanismo concreto se confirmará al implementar.

## Cambio inmediato desde un editor: objetivo posterior

El procedimiento siguiente aún no está implementado. La primera entrega guarda
la preferencia sin interrumpir la sesión; no ejecuta automáticamente estos pasos.

1. El usuario elige la otra interfaz desde Ajustes.
2. Comprobar que no haya operaciones en curso, incluidos dados con resultados
   pendientes, guardados, transacciones de comercio o asistentes a medio confirmar.
   Esperar su resolución o mantener el selector temporalmente deshabilitado con
   explicación; no repetir ni cancelar transacciones por cambiar la UI.
3. Completar los guardados automáticos que ya correspondían. Si fallan o hay
   conflicto, permanecer en la vista actual mostrando el problema.
4. Resolver formularios de guardado explícito y borradores: ofrecer guardar,
   continuar editando o descartar expresamente. Cambiar de UI no equivale a
   confirmar una edición que el usuario no había enviado.
5. Recordar el personaje seleccionado y escribir solo la preferencia visual.
   No copiar ni exportar la campaña para realizar el cambio.
6. Recargar únicamente la WebView del symbiote mediante el mecanismo validado
   en TaleSpire; recuperar rol, acceso y datos vigentes. No se necesita reiniciar
   la partida ni recargar los clientes de los demás jugadores.

El reload debe validarse con la reinyección e inicialización del API. Si el
almacenamiento de preferencias no está disponible, informar que la elección
no pudo persistirse y mantener la vista actual; no entrar en un bucle de recarga.

Los registros e historiales que hoy solo viven en memoria pueden perderse con
una recarga. Inventariarlos antes de habilitar el selector. No prometer
continuidad de deshacer, filtros o registros de sesión sin implementar su
conservación. La protección de datos guardados y borradores es condición previa.

## Recuperación

El contenedor conserva un control «Usar interfaz actual» fuera de la UI nueva.
Puede añadirse un parámetro local de arranque como `?ui=classic` para diagnóstico,
sin modificar archivos de campaña ni el manifest de todos los usuarios.

Si la carga inicial de Nueva falla, presentar la recuperación y cambiar a
Actual con una recarga controlada. Esto también elimina posibles estilos
parcialmente cargados. Evitar reintentos infinitos.

Un fallo después de enviar una operación requiere consultar su resultado por
la ruta existente. No reproducir comandos al recuperarse ni interpretar volver
a Actual como deshacer datos. La recuperación visual no sustituye la revisión
de una operación fallida.

## Primer paso: contrato y referencia funcional

El trabajo de planificación previo consistió en convertir esta estrategia en
una especificación pequeña y verificable de la primera entrega, antes de
modificar el arranque. Abarcó cuatro partes:

1. **Recorrido del selector:** entrada en Ajustes, elección, tratamiento de
   cambios pendientes, recarga y retorno. Incluir su equivalente GM y la hoja
   que se abre desde el GM.
2. **Límite técnico:** señalar qué se extrae del arranque, dónde vive la
   preferencia, cómo se carga una única presentación y cómo se aíslan estilos.
   Mantener la selección de framework de Nueva abierta.
3. **Referencia funcional:** registrar el resultado esperado de abrir una ficha,
   tirar dados, modificar PG, gastar recursos, usar inventario y operar combate
   GM; mapear esos recorridos a pruebas existentes y revisión real en TaleSpire.
   Esta referencia permitirá comparar el antes y el después. No se ha medido aún.
4. **Aceptación y recuperación:** especificar cómo probar independencia entre
   clientes, conservación de datos y regreso a Actual ante fallos de Nueva.

El resultado implementado, sus módulos y las comprobaciones están en el
[documento de continuidad](UI_REDESIGN_PROGRESS.md). Nueva dispone de un piloto
navegable de consulta; las funciones pendientes se indican en pantalla y tienen
regreso a Actual. La validación real en TaleSpire todavía falta.

## Entregas propuestas

La revisión de diseño utiliza una única maqueta evolutiva:
`ui-redesign/compact-icon-sheet.html`. Sus operaciones son locales y sintéticas;
su cobertura visual no habilita acciones en Nueva ni sustituye las condiciones
de aceptación de las entregas. Actual sigue siendo la interfaz de juego.
La Ficha visual ya fue trasladada a Nueva para consulta de datos reales, con
recursos propios de aplicación. Se conserva el HTML como prototipo; no se
incrusta su estado ni se reutilizan sus operaciones sintéticas.
La capa interactiva posterior usa comandos reales y conserva pruebas de una sola
ejecución, errores, revisión/checksum y bloqueo a 0 PG. Ver resultados actuales
en el documento de continuidad; no confundirla con la cobertura total de Actual.
La maqueta incluye el selector de condiciones en grilla continua, buenas primero
y malas después, con lectura por columna y resumen permanente
de activas; su clasificación de presentación y sus cambios locales no modifican
reglas o datos de Actual. Ver el estado vigente en `UI_REDESIGN_PROGRESS.md`.
La Ficha reorganizada y las vistas previas por personaje de descansos/Recuperación
arcana también son prototipos locales. Antes de habilitarlas en Nueva se necesita
el plan derivado de comandos reales, sus validaciones y las comprobaciones de
equivalencia/cancelación/sincronización descritas en `UI_REDESIGN_PLAN.md`.

| Entrega | Resultado | Condición para habilitarla |
| --- | --- | --- |
| Base de convivencia | Preferencia local, selección de vista, aislamiento y recuperación; Actual sigue por defecto | Cambiar presentación sin operaciones ni escrituras de campaña adicionales; regresión de Actual verificada |
| Primer piloto | Nueva muestra una sección con lectura de datos y navegación | Recuperación, permisos y actualizaciones en ambos modos verificadas; indicar alcance disponible |
| Interacciones piloto | Nueva ejecuta acciones seleccionadas mediante operaciones compartidas | Equivalencia de resultados y una sola ejecución por interacción |
| Cobertura progresiva | Incorporar acciones, conjuros, ficha, equipo y herramientas GM por recorridos completos | Aceptación y retorno seguro de cada recorrido, manteniendo Actual disponible |
| Cierre de transición | Evaluar cambio de opción predeterminada y futura retirada de Actual | Cobertura funcional, uso real y recuperación revisados con el usuario |

El piloto no debe aparentar cobertura completa. Donde falte una función, ofrecer
una entrada clara para volver a Actual conservando el contexto soportado.

## Verificación necesaria

- Dos clientes con elecciones diferentes y roles distintos; cambiar uno no
  altera preferencia, navegación ni presentación del otro.
- Actuar desde Nueva, comprobar resultado en Actual de otro cliente y volver
  localmente a Actual sin perder ni repetir esa acción.
- Cambiar vista con autosave pendiente, fallo de guardado, borrador GM,
  asistente abierto y dados pendientes; comprobar cada bloqueo/continuación.
- Contar suscripciones y efectos tras varios cambios para descartar duplicación.
- Comprobar que elegir UI no añade revisiones o escrituras de campaña; separar
  de cambios concurrentes legítimos recibidos durante la prueba.
- Comprobar CSS, diálogos compartidos, hoja administrada por GM y carga diferida.
- Probar valor de preferencia inválido, almacenamiento bloqueado y fallo de
  carga de Nueva; recuperación a Actual sin bucle y sin repetir comandos.
- Verificar arranque real y recarga en TaleSpire, además de pruebas de navegador.

La implementación incluye pruebas automatizadas de preferencia, selección de
módulos, arranque, recuperación y lectura sin escrituras. Las pruebas reales
con dos clientes, recarga e integración visual en TaleSpire siguen pendientes.
En la validación original pasaron 1453 pruebas en 167 archivos, con concurrencia
acotada. La entrega posterior de Ficha pasó sus 40 pruebas específicas y build;
la regresión amplia tuvo un timeout del constructor de explorador que pasó al
repetirse aislado. Resultados, límites y comandos actuales en
`UI_REDESIGN_PROGRESS.md`; la validación visual real continúa pendiente.

## Referencias externas verificadas

[MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
documenta almacenamiento por origen y persistencia entre sesiones; el
comportamiento de URLs `file:` no está definido uniformemente. Por eso la
persistencia real de la preferencia se verificará en la WebView de TaleSpire.

[API de TaleSpire: localStorage](https://symbiote-docs.talespire.com/api_doc_v0_1.md.html#calls/localstorage)
describe blobs locales del symbiote y sus ámbitos global/campaña. No son el
mismo almacenamiento que `window.localStorage`. Para este selector se propone
reutilizar las preferencias web existentes, sujeto a validación en el host.
No se propone editar blobs ni datos de campaña para guardar esta elección.
