# Rediseño de la interfaz del symbiote

Fecha de inicio: 2026-11-02.
Estado: implementación iniciada con autorización del usuario, 2026-11-03.
La base de convivencia y el piloto de consulta están implementados. Para
continuar, leer primero [estado y siguiente tarea](UI_REDESIGN_PROGRESS.md).

Brief vigente: [objetivos, principios y ejemplos de aplicación](UI_REDESIGN_BRIEF.md).
Propuesta de transición: [convivencia y selector local de interfaz](UI_REDESIGN_ROLLOUT.md)
(actualizada con la primera implementación el 2026-11-03).

## Objetivo y forma de trabajo

Revisión 2026-11-09 implementada en Nueva y en el HTML canónico: la cabecera
común contiene selector/Editar/Más opciones, sin repetir clase bajo el nombre.
Todo el bloque desde nivel hasta Desventaja queda al principio de Ficha:
fila de cifras principales y franja compartida de identidad/controles. Identidad
muestra valores presentes sin título ni etiquetas visibles, con nombres en
ayudas accesibles. Inspiración muestra nombre y estado en línea; los controles
usan 26 px para mouse y 44 px en táctil, con modos apilados y colores semánticos.
Se conserva color por personaje con el editor compartido y PG verde→rojo.
La edición general y los descansos siguen en Actual. Las pruebas y build pasan;
falta inspección visual en TaleSpire a 320/440/640 px. Ver límites en progreso.

Diseñar con el usuario la nueva experiencia del symbiote, elegir la tecnología
con criterios explícitos y documentar la implementación antes de aplicarla.
Este documento es el punto de entrada del trabajo y se actualizará con cada
decisión. No representa todavía una especificación aprobada.

Separaremos en cada revisión:

- **Hechos:** comportamiento comprobado en código o durante una revisión visual.
- **Propuestas:** alternativas que todavía se pueden modificar.
- **Decisiones:** elecciones expresamente acordadas con el usuario.
- **Pendientes:** preguntas o verificaciones necesarias para cerrar una etapa.

La planificación inicial fue seguida por autorización del usuario para comenzar
la implementación. El trabajo avanza por entregas documentadas, manteniendo
Actual por defecto y una entrada voluntaria al piloto de Nueva.

## Límites del proyecto

- Trabajar únicamente en `Talespire_CharSheet`.
- No editar ni construir el respaldo vecino `Toolset`.
- No modificar datos de campaña en `.localstorage/`.
- Usar datos ficticios en futuras maquetas y pruebas del rediseño.
- Conservar como punto de partida las reglas y operaciones existentes. Si un
  flujo necesita cambiar su comportamiento, documentarlo por separado.
- Para futuras construcciones con TaleSpire abierto, usar
  `npm run build:v2 -- --emptyOutDir=false`.

## Punto de partida comprobado

Revisión inicial de fuentes; todavía no se hizo una evaluación visual en
TaleSpire ni una medición de rendimiento.

| Área | Situación observada | Consecuencia para el diseño |
| --- | --- | --- |
| Aplicación | TypeScript, HTML y CSS; Vite para desarrollo y build | Existe una base funcional que podemos evaluar y reutilizar |
| Arquitectura | Capas `ui`, `application`, `domain` e `infrastructure` | Se puede plantear una renovación de presentación preservando operaciones de juego |
| Jugador | Modos Jugar/Editar; navegación por secciones | Habrá que decidir qué tareas pertenecen a la sesión y cuáles a la preparación |
| Navegación del jugador | Resumen, Acciones, Conjuros, Inventario, Comerciantes, Rasgos, Progresión, Notas, Extras y Campaña; esta última depende de la disponibilidad del lector | El mapa nuevo debe cubrir estas funciones aunque cambie su agrupación |
| GM | Combate, Personajes, Contenido, Campaña, Notas y Herramientas; Campaña es condicional | Requiere recorridos propios y patrones compartidos con el jugador |
| Sistema visual | Tokens CSS, temas claro/oscuro, acentos y primitivas compartidas | No partimos de cero al definir consistencia visual |
| Laboratorio | `ui-lab.html`, disponible con `npm run dev:ui` | Hay una superficie existente para futuras pruebas aisladas de componentes |
| Renderizado | Las vistas principales utilizan HTML generado y enlaces de eventos | Hay que evaluar actualización de pantalla, foco, scroll y formularios antes de elegir una estrategia |
| Integración | Arranque de navegador y de TaleSpire; adaptadores de dados, miniaturas y colaboración | Validar en navegador será insuficiente para dar por terminada la renovación |
| Verificación | Vitest, happy-dom y pruebas de interfaz, primitivas y temas | Se podrán preservar pruebas útiles y añadir cobertura de los comportamientos nuevos |

Fuentes locales:

- [Dependencias y comandos](../../package.json).
- [Arquitectura](ARCHITECTURE.md).
- [Sistema de diseño vigente](UI_DESIGN_SYSTEM.md).
- [Documentación de la ficha](PLAYER_INTERFACE.md).
- [Vista del jugador](../../src/ui/browser-app.ts).
- [Vista del GM](../../src/ui/gm-app.ts).
- [Punto de arranque](../../src/main.ts).
- [Laboratorio de componentes](../../src/ui/design-system/ui-lab.ts).

La lista de pestañas en `PLAYER_INTERFACE.md` no coincide por completo con la
lista actual del código. Para el inventario inicial se tomó el código; habrá
que reconciliar la documentación al cerrar el alcance.

## Recorrido propuesto

El orden siguiente es una propuesta de trabajo. Cada etapa produce material
revisable antes de pasar a decisiones que dependan de ella.

| Etapa | Trabajo | Entregable y condición para avanzar |
| --- | --- | --- |
| 1. Necesidades y alcance | Identificar usuarios, molestias, tareas frecuentes, funciones que conservar y prioridades | Brief con objetivos, exclusiones y ejemplos concretos acordados |
| 2. Auditoría de uso | Recorrer la interfaz actual, inventariar pantallas, registrar tamaños reales del panel y estados problemáticos | Inventario funcional y visual; problemas observados separados de preferencias |
| 3. Arquitectura de información | Agrupar funciones, diseñar navegación, distinguir tareas de partida y preparación | Mapa de pantallas y recorridos de jugador/GM acordados |
| 4. Distribución e interacción | Bocetar jerarquía, zonas persistentes, detalles, formularios y adaptación al ancho disponible | Wireframes de recorridos prioritarios y sus estados |
| 5. Dirección visual | Explorar estilo, tipografía, color, densidad, iconos y movimiento | Dirección elegida y especificación de componentes representativos |
| 6. Decisión técnica | Comparar alternativas a partir de las necesidades y restricciones comprobadas | Registro de decisión con evidencia, costes y estrategia de migración |
| 7. Especificación e implementación prevista | Detallar componentes, contratos de estado, integración, dependencias y orden de cambio | Plan por entregas con aceptación, pruebas y reversión |
| 8. Revisión del diseño completo | Comprobar cobertura funcional, coherencia y pendientes | Diseño y plan revisados con el usuario antes de implementar |
| 9. Implementación posterior | Construir por entregas pequeñas y verificar cada flujo | Cada entrega cumple su aceptación en navegador y, cuando corresponde, en TaleSpire |

La investigación técnica puede acompañar a los bocetos si una limitación
condiciona el diseño. La elección final debe responder a necesidades concretas.

## Preguntas de descubrimiento

Respuestas de la primera conversación:

1. El usuario confirmó **todo el symbiote, avanzando por etapas**.
2. El usuario percibe una interfaz organizada para mostrar toda la información,
   con poca jerarquía: textos y propiedades se pierden entre muchas opciones.
   Pide que el asistente explique y proponga el diseño teniendo en cuenta las
   funcionalidades y el uso. No se le pedirá que resuelva decisiones propias
   del diseño sin alternativas razonadas.

No se identificaron tres fallos independientes ni se midió todavía el problema.
La dificultad de jerarquía es el problema central comunicado, y se desarrolló
en el [brief](UI_REDESIGN_BRIEF.md).
3. El usuario confirmó el uso como panel lateral abierto durante gran parte de
   la partida. Sus dimensiones habituales todavía no se conocen.

Conversaciones siguientes, después de conocer las prioridades:

- ¿Qué funciona bien y conviene conservar?
- ¿Qué tamaño, resolución y escala tiene el panel lateral habitual?
- ¿Qué información debe permanecer visible durante el turno?
- ¿Qué tareas requieren demasiados clics, scroll o cambios de sección?
- ¿Se prefiere una estética de herramienta, de ficha de fantasía o una mezcla?
  ¿Hay referencias concretas y qué interesa de ellas?
- ¿Qué posibilidades de personalización son necesarias?
- ¿Qué necesidades de lectura, teclado y tamaño de controles hay que cubrir?

## Evaluación técnica pendiente

El documento vigente `UI_DESIGN_SYSTEM.md` registra la elección de TypeScript
y HTML nativo sin framework. Es un antecedente del proyecto; este rediseño
todavía no acordó conservar ni sustituir esa elección.

Alternativas a estudiar:

| Alternativa | Qué necesitamos comprobar |
| --- | --- |
| Evolucionar la UI nativa | Si la organización en componentes y las actualizaciones de DOM satisfacen las interacciones previstas |
| Incorporar una solución de componentes en partes delimitadas | Si puede convivir con las pantallas existentes con límites claros de DOM, estado, estilos y eventos |
| Migrar la capa de presentación a un framework | Si el beneficio justifica convertir vistas, adaptar pruebas y mantener temporalmente dos implementaciones |

Criterios de decisión: compatibilidad real con la WebView de TaleSpire,
mantenimiento, complejidad de estado, conservación de foco y borradores,
accesibilidad, aislamiento de estilos, rendimiento medido, tamaño de entrega,
facilidad de pruebas y coste de migración.

Antes de recomendar dependencias nuevas se consultará documentación oficial
vigente. No se fijaron framework, biblioteca visual, gestor de estado,
versiones nuevas ni cambios en servicios o datos.

## Contenido exigido al plan de implementación

Antes de empezar a modificar la aplicación, el plan deberá indicar:

- Alcance final, mapa de pantallas y prioridades de cada entrega.
- Flujo de cada acción principal y estados de carga, vacío, error, guardado,
  deshabilitado, conflicto y permisos que le correspondan.
- Comportamiento con panel estrecho, nombres largos y colecciones grandes.
- Sistema de componentes, tokens, iconos y reglas de interacción.
- Separación entre estado de vista, borradores y estado persistido de juego.
- Cómo se conservan búsquedas, selección, scroll, foco y cambios sin guardar
  frente a navegación y actualizaciones recibidas.
- Operaciones existentes que consume cada pantalla y adaptadores necesarios.
- Estrategia de convivencia de UI actual/nueva y forma de volver a la anterior.
- Archivos o módulos afectados, dependencias y condiciones de aceptación.
- Pruebas de comportamiento, revisión visual y comprobación dentro de TaleSpire.
- Actualización de documentación, empaquetado y entrega final.

El orden concreto de implementación y la pantalla piloto quedan pendientes del
alcance y de los recorridos elegidos. No se asignan plazos sin ese trabajo.

## Vista previa de recuperación: contrato pendiente de lógica real

Pedido del usuario: listar qué recuperará cada personaje al usar Recuperación
arcana o descansar, y completar las validaciones después de revisar el diseño.
El HTML ya representa el recorrido con datos sintéticos: selección de participantes,
antes → después, elecciones de espacios y botón de aplicación. No es una entrega
del motor de recuperación ni habilita escrituras en Nueva.

La implementación real deberá:

- Derivar el plan sin escrituras, aplicando los mismos comandos compartidos a
  copias del estado. Base existente: `applyCharacterResourceCommand` en
  `src/domain/character/character-resources.ts` y `arcane-recovery` en
  `src/domain/character/wizard-play.ts`. No mantener una segunda tabla de reglas
  de recuperación en la UI ni reutilizar `demoRecoveryPlan` del HTML.
- Devolver por personaje identidad, revisión, cambios automáticos antes/después,
  elecciones pendientes y motivos de indisponibilidad. Incluir PG y temporales,
  dados de golpe, espacios y sus orígenes, usos de rasgos, recursos de clase,
  efectos y objetos que realmente cambien. Mostrar también pérdidas/reinicios,
  no solo cantidades recuperadas.
- Separar recuperación automática de decisiones: gastar dados de golpe/curación,
  elegir espacios de Recuperación arcana y resolver recargas variables. Abrir,
  navegar o cancelar la vista previa no consume, tira ni guarda recursos.
- Respetar las restricciones que ya aplican las operaciones de juego: clase y
  nivel de clase, uso disponible, contexto de descanso y límites de espacios,
  recursos de pacto, tiempos de recuperación y excepciones de rasgos/equipo.
  La maqueta actual cubre solo ejemplos de Mago/Brujo/Guerrero y simplifica datos.
- Comprobar permisos y revisiones al aplicar; recalcular una vista previa que
  haya quedado desactualizada. Para descanso de grupo, definir comportamiento
  ante un fallo de un participante y comunicar el resultado por personaje,
  evitando repeticiones. El ejemplo local agrupa un único cambio deshacible;
  eso no demuestra transacciones ni sincronización reales.

Próximo trabajo de lógica, después de la revisión visual: inventariar casos de
las clases y equipos existentes, extraer/proponer el adaptador de vista previa,
y añadir pruebas de equivalencia entre lo previsto y lo aplicado, cancelación
sin efectos, conflictos y una sola ejecución. Hasta entonces Actual conserva
el comportamiento de juego y Nueva sigue en consulta.

## Procedencia numérica: contrato para la integración

La revisión de tooltips numéricos del 2026-11-04 requiere nombre, base y fuentes
de cada aporte, conservando signo y unidad. Una proyección compartida debe
producir el total, sus componentes y su procedencia; mostrar ese total y usarlo
en la acción. No recalcularlo con reglas paralelas dentro del tooltip.

Antes de implementarlo en Nueva:

1. Inventariar las propiedades y las fuentes que conserva el dominio: puntajes,
   competencia/pericia, rasgos, equipo, efectos/condiciones, valores manuales,
   recursos y máximos por nivel. Identificar procedencia faltante.
2. Definir un contrato con identificador/nombre permitido de fuente, contribución,
   signo/unidad y operaciones (sumas, multiplicadores, límites, sustituciones).
   Diferenciar base, ajustes aplicados y alternativas descartadas.
3. Proyectar permisos antes de mostrar nombres; no revelar objetos sin identificar
   ni datos del GM mediante el tooltip. Si falta procedencia, informar que el
   valor está registrado sin desglose; nunca inferir una causa por diferencia.
4. Probar equivalencia entre cálculo, presentación y comandos; efectos que
   aparecen/desaparecen, cambio de nivel/equipo, valores manuales y permisos.

El HTML contiene proyecciones locales de ejemplo y fuentes explícitas de
competencia/pericia/bonos. El usuario autorizó después la Ficha real de consulta:
`next-sheet.ts` ya usa `projectCharacterStatistics` y la proyección de lectura
`projectCharacterStatisticOrigins`. Esta última identifica fuentes conocidas,
respeta equipo efectivo/identificado y marca ajustes sin detalle. No cambia los
cálculos autoritativos existentes ni completa procedencia de CA, velocidad o
máximos de PG por nivel. Continúan pendientes el contrato exhaustivo de fuentes,
límites/sustituciones y la integración de acciones. El piloto sigue en consulta.

## Registro de decisiones

| ID | Estado | Registro |
| --- | --- | --- |
| D-001 | Confirmado por el usuario | Pensar y documentar diseño, tecnología y pasos intermedios antes de aplicarlos |
| D-002 | Confirmado por el usuario | Rediseñar todo el symbiote por etapas; primera experiencia a diseñar pendiente |
| D-003 | Problema confirmado; criterios propuestos | Mejorar jerarquía y lectura de textos y propiedades entre numerosas opciones; ver brief |
| D-004 | Pendiente | Navegación y distribución de información |
| D-005 | Pendiente | Dirección visual |
| D-006 | Pendiente | Tecnología de presentación y estrategia de migración |
| D-007 | Pendiente | Entregas de implementación y criterios de aceptación |
| D-008 | Confirmado por el usuario | El asistente debe explicar conceptos de UI y proponer su aplicación; el usuario aporta contexto de uso y revisa propuestas concretas |
| D-009 | Confirmado por el usuario | El symbiote se utiliza como panel lateral abierto durante gran parte de la partida |
| D-010 | Enfoque acordado con el usuario, 2026-11-03 | Convivencia de Actual y Nueva con selección local voluntaria, Actual por defecto y mismos datos de juego. Base implementada; validación real de convivencia pendiente; ver plan de convivencia |
| D-011 | Autorizado por el usuario, 2026-11-03 | Comenzar la implementación y mantener instrucciones claras de continuidad para próximas interacciones. Ver `UI_REDESIGN_PROGRESS.md` |
| D-012 | Implementación de primera entrega | Selección para la siguiente recarga, sin interrumpir la sesión activa; piloto de consulta con recuperación a Actual. El cambio inmediato desde un editor queda para una etapa posterior |
| D-013 | Evidencia del usuario y corrección implementada, 2026-11-03 | Selector funcional y captura GM sin estilos. Se corrigió el preload CSS del build minificado mediante loaders independientes y se añadió una prueba del artefacto de producción. Confirmación visual posterior pendiente |
| D-014 | Pedido vigente del usuario, 2026-11-03 | Capturas nuevas confirman el formato. Revisar lineamientos y ejemplos antes de aplicar nuevos cambios visuales; el verde se puede reemplazar. Tres alternativas propuestas, sin elección definitiva |
| D-015 | Feedback del usuario, 2026-11-03 | Fuentes/colores bien recibidos. Priorizar comunicación con iconos, abreviaturas y tooltips; PG con corazón y CA con escudo. Vocabulario y componentes desarrollados como propuesta en `UI_REDESIGN_ICONOGRAPHY.md`, pendientes de revisión |
| D-016 | Pedido del usuario, 2026-11-03 | Mantener una sola maqueta HTML completa y modificarla en cada revisión: `ui-redesign/compact-icon-sheet.html`. Reúne experiencias, pantallas, formularios y estados con datos de ejemplo; las maquetas previas quedan como antecedentes |
| D-017 | Modo de revisión confirmado y corregido, 2026-11-03 | El usuario abre el HTML canónico directamente. Se convirtió en documento autónomo con SVG oficiales y ayudas locales, sin visor ni conexión. Recargar ese archivo en Chrome/Edge para revisar cada cambio; conservar este flujo en las próximas iteraciones |
| D-018 | Pedido del usuario aplicado a la maqueta, 2026-11-03 | Agrupar habilidades por FUE/DES/CON/INT/SAB/CAR, ordenar alfabéticamente por nombre completo dentro de cada grupo y compartir el color de texto de su característica. CON indica que no tiene habilidades asociadas. Matices y lectura pendientes de revisión local |
| D-019 | Ajuste posterior del usuario aplicado a la maqueta, 2026-11-03 | Conservar orden y colores de D-018 en una sola grilla sin títulos de familia ni fila vacía de CON. Atributos/habilidades muestran icono y modificador por defecto; nombres/puntuación en tooltip. Clic tira directamente sin panel secundario; en la maqueta es un d20 local de ejemplo, sin integración de campaña |
| D-020 | Pedido del usuario aplicado a la maqueta, 2026-11-03 | Tooltips mínimos: habilidad = nombre; característica = nombre y puntaje base. No repetir modificador, familia ni instrucciones de clic |
| D-021 | Pedido del usuario aplicado a la maqueta, 2026-11-04 | Salvación justo debajo de su característica, como pareja vertical que conserva color y correspondencia al ajustar el ancho. Habilidades ordenadas de arriba hacia abajo por columna y después hacia la derecha, conservando la secuencia por característica y nombre |
| D-022 | Comparación solicitada, elección pendiente, 2026-11-04 | El usuario cuestionó el escudo compartido de CA/salvación. Comparador de tres candidatos para cada uno en el HTML canónico, con actualización local reversible. Propuesta del asistente: CA escudo y salvación círculo/check; no implica aprobación del usuario |
| D-023 | Elección confirmada por el usuario, 2026-11-04 | CA con armadura (`shirt`) y salvaciones con escudo/check (`shield-check`). Valores iniciales del HTML, incluida CA en combate GM. Comparador cerrado y restablecimiento a la elección aprobada. Resuelve D-022 |
| D-024 | Pedido del usuario aplicado a la maqueta, 2026-11-04 | Condiciones colapsables: cerradas muestran solo iconos activos; abiertas permiten activar/desactivar tocando cada icono, sin cierre automático. Tooltip solo con nombre. Patrón compartido de ficha, acompañantes y combate, con aislamiento por entidad y bloqueo de escritura en solo lectura |
| D-025 | Ajuste del usuario aplicado a la maqueta, 2026-11-04 | Condiciones buenas verdes a la izquierda y malas rojas a la derecha, ambas alfabéticas. Resumen de activas siempre bajo el título, idéntico al abrir/cerrar. Seleccionar mueve de disponibles al resumen resaltado; tocar una activa la devuelve al selector. Clasificación concreta de efectos contextuales propuesta para revisión |
| D-026 | Revisión posterior del usuario aplicada a la maqueta, 2026-11-04 | Eliminar las dos mitades/separación central de D-025. Condiciones en una grilla continua por columna, primero buenas verdes y después malas rojas, alfabéticas dentro de cada tipo. Mantener resumen permanente bajo el título, resaltado y traslado entre activas/disponibles |
| D-027 | Ajuste de tamaño solicitado, aplicado a la maqueta, 2026-11-04 | Catálogo confirmado: 26 condiciones (8 buenas y 18 malas). Botones más angostos y reparto de 13 columnas × 2 filas en panel habitual de 520 px; adaptación a menor ancho y puntero táctil, conservando orden, colores, iconos y resumen estable |
| D-028 | Propuesta de Ficha aprobada y aplicada a la maqueta, 2026-11-04 | Unificar identidad/selector y controles de edición; PG/CA/iniciativa/velocidad compactos, inspiración y descanso próximos, pasivas visibles, recursos en fila y competencias desplegables. Se descarta la franja automática de resultados de tiradas; se mantienen activación directa e historial opcional |
| D-029 | Diseño solicitado y lógica real pendiente, 2026-11-04 | Recuperación arcana y descansos deben mostrar recuperación por personaje antes de aplicar. Recorrido ilustrado con datos locales y cancelación sin consumo; cálculo completo y validaciones serán posteriores mediante comandos compartidos, no reglas duplicadas en UI |
| D-030 | Pedido del usuario aplicado a la maqueta, 2026-11-04 | Las seis características suman un fondo tenue del mismo color de su texto, al 12% como las condiciones seleccionadas. Identificación permanente, sin alterar acciones o selección; contraste calculado mínimo 5,15:1 |
| D-031 | Pedido del usuario aplicado a la maqueta, 2026-11-04 | Gestión de PG con cantidad y cuatro iconos directos: curar verde, dañar rojo, temporales azul y cancelar neutro; tooltips mínimos. Se retiran combo y Aplicar; cancelar no modifica datos y Enter en cantidad no aplica una operación implícita. Patrón compartido con criaturas GM, todavía sintético |
| D-032 | Pedido del usuario aplicado a la maqueta, 2026-11-04 | Tooltips numéricos con base y procedencia de aportes, incluidas habilidades, salvaciones, pasivas y velocidad. Sustituye la brevedad de D-020 para cifras; condiciones/acciones conservan nombres mínimos. Proyección local única para cifra, explicación y tirada; indicar desglose faltante sin inventarlo. Integración con fuentes del dominio pendiente |
| D-033 | Migración de consulta autorizada por el usuario, 2026-11-04 | Llevar Ficha rediseñada a Nueva con datos reales, iconos oficiales y tooltip propio. Jugador inicia en Ficha; GM accede por Personajes. Usar proyecciones del dominio y marcar fuentes faltantes. Sin comandos de juego, con Actual por defecto, selección local y regreso disponibles. Revisión visual en TaleSpire y primera tirada compartida son los próximos pasos |
| D-034 | Funciones solicitadas y conectadas, 2026-11-08 | Quitar Modificador; nivel/PX grande con progreso, umbral y asistente existente; inspiración Activar/Usar/Desactivar; ventaja/desventaja temporal o bloqueada; salvaciones a 0 PG y curación. Tercer éxito recupera 1 PG atómicamente mediante comando compartido también usado en Actual. Con 0 PG se bloquean otras acciones en Nueva. Pruebas de habilidades/atributos/salvaciones habilitadas con DiceRoller y lógica compartida; resto de recorridos sigue en Actual |
| D-035 | Revisión visual solicitada y aplicada, 2026-11-08 | Reducir nivel al aro de Actual (54 px), trasladar detalle PX a tooltip/desplegable y compactar cabecera completa. Inspiración 100 × 36 con texto de estado Inactiva/Disponible/En uso; resaltar activación y reforzar uso con fondo pleno/estrella rellena. Agrupar cifras principales y controles de sesión en filas adaptables, sin cambiar comandos ni reglas |

Cada nueva decisión incluirá motivo, alternativas consideradas, consecuencias
y evidencia de validación cuando corresponda.

## Próximo paso

Revisar la [distribución lateral inicial](UI_REDESIGN_LAYOUT.md), sus agrupaciones
y el boceto de conversación. Validar dimensiones reales antes de fijar tamaños.
Los recorridos de combate son una hipótesis para empezar el diseño; no fijan
todavía el orden de implementación ni excluyen los demás recorridos.

La base de convivencia ya está implementada y el usuario confirmó el selector.
La Ficha compacta revisada con el usuario ya está en Nueva para consulta con
personajes reales. Revisar ahora su presentación y tooltips dentro de TaleSpire,
comparar con Actual y registrar feedback antes de ampliar las acciones conectadas.
Seguir los pasos y límites del [documento de continuidad](UI_REDESIGN_PROGRESS.md).
La elección de framework y el diseño visual definitivo siguen abiertos.

El [vocabulario compacto, sus ayudas y recorridos](UI_REDESIGN_ICONOGRAPHY.md)
conserva como referencia de diseño la maqueta única
`ui-redesign/compact-icon-sheet.html`. Las siguientes revisiones amplían ese
mismo archivo, sin generar HTML nuevos, y se trasladan al código de Nueva cuando
corresponda. Los componentes de consulta ya usan datos/proyecciones reales;
las pruebas d20 de Ficha ya están conectadas mediante la lógica compartida.
Revisar ahora sus estados de inspiración/modos y muerte en TaleSpire; iniciativa,
ataques/conjuros y recuperaciones completas siguen como entregas posteriores.
