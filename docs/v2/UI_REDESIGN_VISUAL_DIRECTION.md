# Lineamientos y alternativas de dirección visual

Fecha: 2026-11-03.
Estado: propuestas para revisar con el usuario antes de aplicarlas.
Referencias: [brief](UI_REDESIGN_BRIEF.md), [continuidad](UI_REDESIGN_PROGRESS.md).

## Pedido actual y alcance

El usuario aportó capturas nuevas del piloto ya estilizado y pidió conocer los
lineamientos y ver ejemplos antes de seguir cambiando la aplicación. Confirmó
que el verde no es obligatorio y que podemos explorar otra paleta.

Esta iteración contiene documentación y ejemplos de conversación. No modifica
`src/`, el build ni datos de campaña. La autorización previa de implementación
no equivale a una elección de dirección estética. El siguiente cambio de
presentación debe partir de la alternativa que se revise con el usuario.

## Lectura de las capturas

Observaciones sobre el material compartido, no una medición del viewport:

- La carga de estilos corregida ya se observa: botones, bordes y filas tienen
  formato. El usuario mostró Combate, Personajes, Contenido y Más.
- Aviso de prueba, título y navegación ocupan una parte importante del comienzo.
- El encabezado de encuentro se repite alrededor del selector.
- Las filas de combate tienen altura y bordes similares; falta diferenciar
  identidad, datos para comparar y consulta detallada.
- En características y habilidades, los rótulos y valores quedan en extremos
  opuestos; hay que acortar la distancia de lectura.
- El verde ocupa casi todas las superficies; el acento amarillo o del personaje
  cambia la selección, pero no aporta por sí solo una jerarquía completa.

Las capturas no indican el ancho CSS, la escala del sistema o el zoom reales.
Los ejemplos permiten explorar anchos de 320 a 480 px como hipótesis, no como
dimensiones medidas ni límites finales de compatibilidad.

## Lineamientos propuestos

| Lineamiento | Aplicación al symbiote | Cómo evaluarlo |
| --- | --- | --- |
| Jerarquía de tres niveles | Contexto/identidad; información y acciones de la tarea; reglas y edición detalladas | Encontrar objetivo, dato pertinente y acción sin leer toda la pantalla |
| Cabecera breve | Un contexto principal, navegación estable y avisos de baja frecuencia con poco protagonismo | El listado o ficha empieza pronto en el panel habitual |
| Cercanía entre etiqueta y valor | PG y CA en columnas consistentes; modificador junto al atributo; habilidades en grupos compactos | Comparar filas sin recorrer visualmente todo el ancho |
| Densidad controlada | Priorizar filas para comparar; reservar tarjetas y espacio extra para contenido que lo justifique | Ver más participantes conservando nombres legibles y controles claros |
| Tipografía con funciones claras | Texto principal de referencia 14–16 px, rótulos secundarios legibles y títulos contenidos; números alineados | Leer texto largo y valores durante una sesión, probando la escala real |
| Superficies neutrales y acento limitado | Separar fondo, superficie y selección; explorar grafito, pizarra o tonos cálidos | La interfaz no depende de teñir todos sus bloques de un color |
| Semántica estable | Peligro, advertencia, éxito y estados de juego conservan significado; selección y turno son estados distintos | Identificar el turno incluso al consultar otro combatiente y sin depender solo del color |
| Detalle cercano | Seleccionar un elemento y leer sus reglas con retorno predecible, sin perder filtros, foco ni scroll | Consultar varios elementos seguidos manteniendo el contexto |
| Roles con el mismo lenguaje visual | GM y jugador comparten tipografía, controles y patrones, con navegación propia para sus tareas | Cambiar de rol no exige reaprender controles comunes |
| Accesibilidad como criterio de aceptación | Foco visible, acciones sin hover obligatorio, texto con contraste suficiente y estados rotulados | Revisar teclado, tema claro/oscuro, nombres largos y panel estrecho |

Los tamaños y colores son referencias para los bocetos. Los tokens definitivos
se establecerán después de elegir la dirección y probarla en TaleSpire.

## Uso del color

Se separarán tres responsabilidades:

1. **Base neutral:** fondo, superficies, texto, separadores y bordes.
2. **Acento configurable:** selección, una acción importante y pequeños énfasis.
3. **Estados y dominio:** daño, advertencias, concentración, tipos de contenido,
   etc. No deben cambiar de significado al cambiar el acento.

El color del personaje puede conservarse como señal de identidad sin teñir
toda la ficha. El turno y el elemento consultado necesitan señales distintas.
El rótulo «En turno» sigue presente aunque cambie la selección de consulta.

Como referencia de lectura, se buscará al menos 4,5:1 para texto normal. Los
estados también tendrán texto o forma reconocible. Estos criterios no implican
que los ejemplos ya constituyan una auditoría completa de accesibilidad.

## Alternativas comparables

Todas usan el mismo caso inicial: siete combatientes, Delerion en turno y
consulta de una ficha de mago. Los nombres y valores se inspiran en las capturas;
los ejemplos completos son ilustrativos y no se conectan a una campaña.

| Alternativa | Lenguaje visual | Distribución | Beneficio y compromiso |
| --- | --- | --- | --- |
| Mesa táctica | Neutrales de grafito con cobre; títulos sans serif; bordes discretos | Listado tabular con PG/CA alineados y detalle después de la lista; atributos en cuadrícula de tres columnas | Favorece comparación y uso prolongado; tiene una personalidad más cercana a herramienta de mesa |
| Atlas | Pizarra con azul; tarjetas suaves e iniciales; agrupación más marcada | Filas con dos niveles de lectura y detalle dentro del elemento seleccionado; atributos en bloques de dos columnas | Facilita reconocer grupos y foco; ocupa más altura con muchos participantes |
| Cuaderno | Neutrales cálidos con terracota; títulos editoriales y cuerpo de lectura sencillo | Filas separadas por líneas, valores próximos y detalle como continuación de la página | Aporta identidad de ficha y lectura de reglas; exige cuidar el equilibrio entre detalle editorial y rapidez de comparación |

Cada propuesta admite apariencia clara y oscura. Cuaderno resulta especialmente
útil para explorar una base de pergamino claro sin texturas que dificulten leer.
Cambiar el acento no cambia el resto de la estructura.

## Recomendación inicial

Usar **Mesa táctica como primera candidata** por el panel lateral persistente
y la necesidad de comparar varios combatientes. Evaluar su comodidad frente a
Atlas y su personalidad frente a Cuaderno. Es una recomendación contextual,
no una elección aprobada por el usuario ni una solución universalmente superior.

Se pueden combinar decisiones concretas: por ejemplo, listado de Mesa táctica,
títulos de Cuaderno y acento azul. Antes de combinar, mantener un conjunto
coherente de roles de texto, superficies, espaciado y estados.

## Ejemplos de conversación

Antecedente de alternativas: `ui-redesign/visual-directions.html`.
Por pedido posterior del usuario, las nuevas revisiones se realizan únicamente
en `ui-redesign/compact-icon-sheet.html`, sin crear más HTML para cada propuesta.

- Tres variantes con navegación local entre Combate, Personajes, Contenido y Más.
- En Combate, elegir encuentro y consultar un combatiente no cambia el turno.
- En Personajes, comparar modificadores, puntuaciones y habilidades de Delerion.
- Controles de exploración de acento, ancho, tamaño de lectura, separación y tema.
- Solo estado local de la vista: no hay tiradas ni escrituras de campaña.

Los ejemplos muestran organización y tratamiento visual. No prometen que un
control de turno nativo o una acción no disponible en el API sea implementable.
Los controles propios de TaleSpire y su barra Debug quedan fuera del contenido
que diseña el symbiote.

Verificación realizada: ejecución de los scripts y recorridos locales con
happy-dom; tres variantes, selección, ficha y cambio de encuentro funcionan.
También se revisó el contraste de los colores de texto definidos como base:
el menor valor entre texto principal/secundario y fondo/superficie fue 5,53:1
en las paletas claras y oscuras. Esto no cubre todos los controles y estados.
No equivale a una revisión visual de todos los tamaños en la WebView real.

## Siguiente paso antes de aplicar

Feedback posterior: el usuario valora las fuentes y colores y quiere más
eficiencia con iconos, abreviaturas y tooltips. La propuesta actual se desarrolla
en [lenguaje visual y ayudas](UI_REDESIGN_ICONOGRAPHY.md); revisar ese ejemplo
antes de trasladar nuevos componentes a la aplicación.

El usuario compara las alternativas y comenta qué distribución, personalidad
y paleta le resultan más cómodas. Registrar una candidata o combinación y las
objeciones concretas. Después completar esa dirección con estados de foco,
vacío, error, deshabilitado y texto largo y verificarla al tamaño real del panel.
Entonces trasladar los tokens y el primer componente al piloto Nueva.

## Fundamentos consultados

- [NN/g: proximidad](https://www.nngroup.com/articles/gestalt-proximity/): cercanía y separación para expresar relaciones.
- [W3C: contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): contraste mínimo de texto normal y excepciones.
- [W3C: uso del color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): acompañar el color con otras señales de significado.
