# Primera distribución: panel lateral de partida

Fecha: 2026-11-02.
Estado: propuesta de diseño, pendiente de revisión del usuario.
Contexto confirmado: panel lateral abierto durante gran parte de la partida.
Referencias: [brief](UI_REDESIGN_BRIEF.md) y [plan](UI_REDESIGN_PLAN.md).

Iteración implementada el 2026-11-03 a partir de la captura GM del usuario:
consulta de un encuentro por vez, filas con identidad separada de PG/CA y turno
guardado rotulado. También se corrigió la carga de CSS del build minificado.
La confirmación visual y la dirección estética definitiva siguen pendientes;
ver [continuidad](UI_REDESIGN_PROGRESS.md).

## Intención

Organizar el panel como acompañamiento al tablero: estado compacto, navegación
estable y una tarea principal por vez. El ancho habitual aún no está medido.
La primera representación es un esquema con datos ficticios, no una pantalla
terminada ni una decisión de estilo.

## Distribución propuesta

1. **Identidad y contexto:** personaje controlado o campaña/selección del GM.
2. **Estado breve:** PG y CA del personaje; condiciones activas cuando existan.
   Para GM, turno actual y combatiente que está consultando.
3. **Navegación principal:** pocos destinos visibles, con rótulos estables.
4. **Contenido de la tarea:** listas legibles, recursos y controles pertinentes.
5. **Detalle:** apertura en el flujo o vista de detalle con regreso explícito,
   conservando selección, búsqueda y posición de lectura.

La persistencia de cabecera/navegación deberá probarse con la altura disponible.
El primer boceto no demuestra comportamiento sticky ni tamaño físico real.
No se fijarán bloques grandes permanentemente visibles que reduzcan demasiado
el espacio de lectura.

## Agrupación inicial de funciones del jugador

| Destino propuesto | Tareas y funciones actuales que debe cubrir |
| --- | --- |
| Turno | Acciones, conjuros, recursos de clase, efectos activos, iniciativa y accesos a PG/condiciones |
| Ficha | Características, habilidades, salvaciones, pasivas, competencias, rasgos y progresión |
| Equipo | Inventario, dinero, equipo/sintonización, capacidades de objetos y comerciantes |
| Más | Notas, extras y biblioteca de campaña; accesos de preparación y administración |

Esta agrupación es una hipótesis para reducir destinos al mismo nivel.
El nombre «Turno» puede resultar demasiado ligado al combate para usos como
exploración: se deberá probar con tareas fuera de combate. La subnavegación
no deberá convertir acciones frecuentes en recorridos largos. «Más» debe
desplegar destinos rotulados, y deberá reconsiderarse si contiene tareas de
consulta frecuente. No se ocultarán allí funciones solo para cumplir una cuota.

Editar ficha, crear personaje, subir de nivel y gestionar campaña conservarán
entradas explícitas en sus contextos. Su diseño detallado sigue pendiente.
El cambio de modo Jugar/Editar actual se evaluará como parte de estos recorridos.

## Agrupación inicial de funciones del GM

| Destino propuesto | Tareas y funciones actuales que debe cubrir |
| --- | --- |
| Combate | Cola nativa de TaleSpire, combatientes, estadísticas, tiradas y recursos |
| Personajes | Gestión y consulta de personajes, acceso a fichas y creación |
| Contenido | Monstruos, conjuros, objetos y comerciantes de campaña |
| Más | Biblioteca de campaña, notas, herramientas y ajustes |

Jugador y GM compartirán patrones de lectura, selección, estados y acciones,
pero tendrán navegación adaptada a su trabajo. No se presupone que la misma
cantidad de pestañas deba funcionar para ambos.

En combate GM, separar el turno nativo del combatiente consultado: seleccionar
una criatura para leerla no debe avanzar el turno ni reasignar la selección
sin una acción explícita. Los cambios remotos deben preservar el contexto de
consulta y mantener visible quién tiene el turno.

## Lectura y densidad

La densidad es la cantidad de información útil por espacio. La evaluaremos a
partir de tareas y texto legible. Antes de reducir tamaños de letra se probarán
agrupación, eliminación de repetición y desplazamiento de detalle secundario.

- Priorizar una columna de lectura en el panel estrecho.
- Usar filas para recorrer listas y detalle para leer reglas extensas.
- Mantener rótulos visibles en acciones ambiguas; no depender de hover.
- Ofrecer estado y explicación junto a acciones no disponibles.
- Evitar scroll horizontal de la pantalla completa; el ancho extra debe mejorar
  la lectura sin exigirlo para acceder a una función.
- Elegir desplazamiento principal predecible y evitar áreas anidadas de scroll
  salvo que una tarea concreta lo justifique.

Son objetivos de esta propuesta; aún no se establecen dimensiones, tipografía
ni puntos de corte definitivos.

## Boceto de conversación

Antecedente: `ui-redesign/sidebar-layout.html` dentro de esta carpeta.
La revisión activa continúa únicamente en `ui-redesign/compact-icon-sheet.html`,
la maqueta evolutiva que reúne los recorridos de jugador y GM.
Representa roles de jugador y GM con datos inventados y controles locales de
selección/consulta. Las operaciones de juego se muestran deshabilitadas:
no se tiran dados, no se gastan recursos ni se escribe en la campaña.

Los destinos secundarios del boceto resumen su alcance; no están especificados
todos sus formularios. La apariencia neutral sirve para evaluar distribución.
Este ejercicio no modifica entradas de la aplicación, build ni dependencias.

## Validación pendiente

- Comprobar el ancho y la altura reales del panel y su relación con el tablero.
- Encontrar una habilidad, una reacción, una regla de rasgo y un objeto.
- Lanzador con muchos conjuros y personaje con varias capacidades de objetos.
- Uso de notas y campaña durante exploración para evaluar «Más».
- GM que consulta otra criatura mientras continúa un turno nativo.
- Textos largos, foco de teclado y actualizaciones concurrentes.
- Comparar los recorridos con la UI actual y revisar nombres/agrupaciones.

La elección de tecnología permanece pendiente. Este boceto no incorpora una
biblioteca candidata ni determina cómo se implementarán los componentes.
