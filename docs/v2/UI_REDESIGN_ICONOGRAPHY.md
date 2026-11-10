# Lenguaje visual: iconos, abreviaturas y ayudas

Actualizado: 2026-11-08.
Estado: dirección solicitada por el usuario; vocabulario y componentes propuestos.
Referencias: [dirección visual](UI_REDESIGN_VISUAL_DIRECTION.md),
[continuidad](UI_REDESIGN_PROGRESS.md).

## Feedback recibido

Ajuste posterior: nivel como aro compacto de 54 px, detalle de experiencia en
ayuda/desplegable. Inspiración reducida a 100 × 36 y rotulada por estado
(Inactiva/Disponible/En uso), con borde/fondo tenue al activar y fondo pleno y
estrella rellena al preparar su uso. La acción permanece en la ayuda. Nivel y
cifras principales comparten fila; inspiración, luna de descanso, competencia
y modos/candados forman otra tira adaptable. Se preservan sus funcionalidades.

Revisión vigente 2026-11-08: se retiró la etiqueta Modificador; nivel/PX e
inspiración usan controles mayores. Hay ventaja/desventaja con candado (97 SVG
oficiales) y salvaciones/curación cuando los PG llegan a 0. Estos recorridos se
actualizaron en el HTML canónico y en Nueva con comandos reales; los antecedentes
de consulta que siguen describen etapas previas. El tercer éxito recupera 1 PG
por pedido del usuario, con bloqueo de otras acciones de personaje en ese estado.

El usuario valora las fuentes y colores presentados. Pide comunicar la
información con mayor eficiencia mediante ilustraciones, iconos representativos,
abreviaturas como His, Rel, Per, Eng y Sig, y tooltips al pasar el mouse.
Propone expresamente PG con corazón y CA con escudo.

Este feedback aprueba el rumbo general de fuentes/colores y orienta el lenguaje
visual. No identifica inequívocamente una de las tres variantes anteriores ni
autoriza por sí solo todos los nombres abreviados o símbolos de esta propuesta.
La propuesta inicial se revisó mediante documentos y ejemplos independientes.

Entrega posterior autorizada (2026-11-04): el vocabulario compacto de Ficha ya
se puede revisar en Nueva con datos reales, en consulta. Implementación en
`src/ui/next/next-sheet.ts` y `next.css`, SVG oficiales propios en `next-icons.ts`
(regenerar con `scripts/update-next-icons.mjs`) y ayudas en `next-tooltips.ts`.
El HTML sigue siendo el único prototipo de diseño. Las acciones de juego,
edición y recuperaciones sintéticas del ejemplo no se habilitaron en Nueva.

## Fórmula propuesta

**Icono + modificador** por defecto en características y habilidades, como
prueba solicitada por el usuario. PG y CA conservan sus abreviaturas y valores.

- Visible: lo necesario para comparar y decidir, como PG actuales/máximos,
  CA, modificadores y puntuaciones cuando sean relevantes.
- Tooltip numérico: nombre y desglose breve del valor, por pedido posterior
  del usuario. Investigación: +3 Inteligencia (puntaje 16), +4 Competencia
  (nivel 10). Incluir fuentes de mejoras y penalizaciones cuando se conocen.
- Características: nombre, puntaje y cálculo del modificador (redondeo hacia
  abajo). Identificar la falta de desglose del puntaje cuando solo hay un total.
- Salvaciones: un botón de escudo y modificador justo debajo de cada atributo,
  del mismo color. Tooltip con nombre, modificador de característica,
  competencia y aportes propios. Clic directo usa el mismo valor explicado.
- Clic en atributo/habilidad: tirada inmediata; ya no abre un detalle inferior
  con otro botón. Por el último pedido del usuario, el resultado no se muestra
  automáticamente en Ficha; el historial se puede consultar voluntariamente.
- Para reglas extensas de otros elementos, conservar detalles de consulta.

Los iconos ofrecen pistas y una forma consistente de recorrer la pantalla.
Las abreviaturas evitan exigir que el usuario memorice decenas de símbolos.
Debe existir una vista o preferencia con nombres completos para aprender el
vocabulario y para quien la encuentre más cómoda. El ejemplo permite comparar
solo iconos, abreviaturas o nombres completos desde Ajustes; el inicio es iconos.

## Iconos e ilustraciones tienen responsabilidades distintas

- **Iconos:** pequeños símbolos vectoriales de una sola familia, mismo trazo,
  tamaño y tratamiento de color. Adecuados para PG, CA, atributos, habilidades,
  navegación y acciones. Evitar mezclar emojis y estilos de varias bibliotecas.
- **Ilustraciones:** retratos, miniaturas de criaturas, objetos o encabezados de
  consulta cuando permitan reconocer mejor una entidad. Mantener detalles
  decorativos fuera de las listas numéricas más densas.
- El color acompaña estados y selección. Por pedido posterior del usuario,
  cada característica tiene además un color de texto compartido por sus
  habilidades; no asignar un color independiente a cada habilidad.

La elección final de ilustraciones y su procedencia queda pendiente. No se
generaron imágenes ni se añadieron paquetes de iconos a la aplicación.

## Composición vigente de Ficha

Nombre/selector de personaje, clase/nivel y acciones de edición/progresión en
una sola cabecera. PG con temporales visibles y acceso a daño/curación; CA con
armadura; iniciativa accionable y velocidad de consulta. Inspiración se presenta
como estrella resaltable, junto a descanso y bono de competencia. Se preservan
condiciones, grillas y sus colores/lectura por columna.

Pasivas de Percepción/Investigación/Perspicacia visibles como datos. Los recursos
de clase usan filas con nombre corto, usos y acción. Las competencias de armas,
armaduras, herramientas e idiomas quedan ordenadas en un desplegable. Estos
valores son ilustrativos en la maqueta; se adaptarán a las proyecciones reales.

La ventana de PG muestra Cantidad y cuatro botones de icono, sin combo de
operación ni Aplicar: `heart-pulse` verde para Curar, `heart-crack` rojo para
Dañar, `shield-plus` azul para Puntos de golpe temporales y `x` neutra para
Cancelar. Tooltip y nombre accesible indican la operación. Un clic aplica la
cantidad; cancelar cierra sin cambios. Enter en el campo no aplica una operación
por defecto. El patrón se comparte con PG de criaturas en combate GM; sigue
siendo una interacción local de ejemplo.

Descansos y Recuperación arcana tienen vista previa por personaje con antes →
después y elecciones pendientes. Separamos el gesto de revisar/elegir del de
aplicar la recuperación. No hay consumo al abrir ni cancelar. El cálculo local
es un ejemplo; la implementación real deberá usar los comandos de reglas ya
existentes, no copiar las simplificaciones de este HTML.

## Condiciones: buenas/malas y resumen permanente

Pedido vigente del usuario: condiciones juntas en una sola grilla, sin división
central ni títulos de categoría. Primero buenas verdes y después malas rojas,
ordenadas alfabéticamente por nombre completo dentro de cada tipo. Llenar de
arriba hacia abajo por columna y después hacia la derecha, como las habilidades.
Cada condición usa solo un SVG,
con tooltip y nombre accesible que contienen únicamente el nombre.

Las activas se ven siempre en un bloque debajo del título «Condiciones», con la
misma grilla continua, orden y resaltado. Abrir/cerrar no cambia ese resumen.
La zona expandida muestra únicamente las disponibles, sin duplicar activas.
Tocar una disponible la traslada al resumen; tocar una activa la devuelve a las
disponibles. El selector permanece abierto para seleccionar varias. En solo
lectura, las activas permiten consultar su nombre pero no desactivarlas.

El mismo componente se usa en ficha, acompañantes y combatientes, con selección
y expansión independientes por entidad. Abrir/cerrar solo cambia la vista.
Las opciones activas usan relleno/borde y `aria-pressed`, sin añadir checks ni
etiquetas de texto. Los cambios se pueden deshacer/rehacer en la maqueta; hover
y foco no activan condiciones ni tiradas. En solo lectura o sin asociación,
los controles de modificación están deshabilitados.

Catálogo inicial: las listas de condiciones/efectos de jugador y GM de Actual,
más Agotamiento del ejemplo, suman 26 opciones. Los símbolos son propuestas
para evaluar, no elecciones aprobadas individualmente. Se conservan nombres
desconocidos activos con un icono de ayuda, permitiendo quitarlos desde el
resumen. No se implementan niveles o reglas de efectos en esta maqueta.
Concentración añadida por un conjuro aparece automáticamente en el resumen.

| Grupo | Clasificación inicial de la maqueta |
| --- | --- |
| Buenas | Acelerar, Bendición, Concentración, Furia, Guía, Heroísmo, Invisible, Santuario |
| Malas | Agarrado, Agotamiento, Apresado, Asustado, Aturdido, Cegado, Derribado, Ensordecido, Envenenado, Hechizado, Incapacitado, Inconsciente, Maleficio, Paralizado, Perdición, Petrificado, Ralentizado, Recargando |

Son 26 opciones (8 buenas y 18 malas). La revisión de tamaño reduce relleno y
separación para distribuirlas en 13 columnas × 2 filas con el panel de 520 px,
manteniendo lectura por columna. Los botones comparten el ancho en activas y
disponibles; al seleccionar una no se ensanchan los restantes. La grilla adapta
columnas al ancho de cada sección, con un mínimo de 32 px para mouse y 44×44 px
para táctil. El alto normal es 36 px y el icono permanece en 18 px. Estos tamaños
quedan sujetos a revisión visual con el usuario.

Concentración entre buenas y Recargando entre malas son decisiones de presentación
provisionales, no reglas de juego ni elecciones confirmadas por el usuario. Se
pueden revisar sin alterar datos de campaña. Nombres desconocidos usan malas
como grupo provisional. Colores: verde claro/oscuro `#256438` / `#98d6a5` y rojo
claro/oscuro `#a23038` / `#f1a4aa`; el resaltado conserva borde y relleno tenue
de su color. Contraste calculado mínimo 5,29:1 en las superficies previstas.

## Recursos y características

El escudo compartido entre CA y salvaciones fue cuestionado por el usuario.
El usuario eligió **armadura (`shirt`) para CA** y **escudo con check
(`shield-check`) para salvaciones**. La maqueta abre con esa combinación,
incluyendo la CA del combate GM. El comparador queda cerrado por defecto y
su restablecimiento vuelve a los iconos elegidos. Las opciones consideradas
se conservan como referencia:

| Concepto | Opción | Lectura y límite |
| --- | --- | --- |
| CA | `shield` · Escudo | Defensa, simple y reconocible |
| CA | `shirt` · Armadura | Equipamiento; puede parecer ropa |
| CA | `brick-wall` · Barrera | Protección física, silueta diferente |
| Salvación | `shield-check` · Resistencia | Protección/superación; comparte silueta con el escudo |
| Salvación | `circle-check` · Superación | Silueta distinta; puede sugerir un éxito ya obtenido |
| Salvación | `dices` · Tirada | Prueba; también representa otras tiradas |

La propuesta anterior del asistente (CA escudo + salvación círculo/check)
no fue la elegida. Mantener la decisión del usuario. Los selectores de prueba
solo actualizan la presentación del ejemplo; valores, ayudas y acciones se
conservan, y al recargar vuelve la combinación aprobada.

| Concepto | Código visible | Icono candidato |
| --- | --- | --- |
| Puntos de golpe | PG | Corazón |
| Clase de armadura | CA | Armadura (`shirt`), elegida por el usuario |
| Salvación | Icono + modificador | Escudo con check (`shield-check`), elegido por el usuario |
| Fuerza | FUE | Pesa |
| Destreza | DES | Pluma |
| Constitución | CON | Corazón con pulso |
| Inteligencia | INT | Cerebro |
| Sabiduría | SAB | Ojo |
| Carisma | CAR | Voz/megáfono |

Estos símbolos son propuestas para comprobar en contexto, no significados
universales. CON y PG comparten una metáfora de salud: mantener los dibujos
distintos, el nombre accesible y sus tooltips. PG conserva su abreviatura;
CON muestra solo icono/modificador. La puntuación base está en el tooltip.

## Agrupación y colores de las habilidades

Decisión solicitada por el usuario, aplicada en la maqueta: una grilla continua,
sin encabezados que separen familias. Ordenar primero por característica y,
dentro de cada familia, alfabéticamente por **nombre completo en español**.
Conservar ese orden con iconos, abreviaturas o nombres completos.
Desde la revisión del 2026-11-04, llenar la grilla por columna: primero hacia
abajo y después a la derecha. Al variar el ancho o las etiquetas, recalcular
las filas necesarias sin cambiar la secuencia lógica de las habilidades.
Por eso Interpretación precede a Intimidación aunque sus códigos sean Intp/Intm.

| Grupo | Color de texto (claro / oscuro) | Habilidades en orden |
| --- | --- | --- |
| FUE · Fuerza | Terracota `#9b3b2e` / `#e8a394` | Atletismo |
| DES · Destreza | Verde azulado `#17665b` / `#a0d5c8` | Acrobacias, Juego de manos, Sigilo |
| CON · Constitución | Ocre `#7b5607` / `#e2c17a` | Sin habilidades asociadas |
| INT · Inteligencia | Azul `#345cab` / `#a7bdf6` | Arcano, Historia, Investigación, Naturaleza, Religión |
| SAB · Sabiduría | Violeta `#7550a4` / `#ceb2ef` | Medicina, Percepción, Perspicacia, Supervivencia, Trato con animales |
| CAR · Carisma | Rosa `#9b3f6c` / `#efa8cf` | Engaño, Interpretación, Intimidación, Persuasión |

La tarjeta de característica y las habilidades comparten el color de familia
en iconos y cifras. Por pedido del usuario, las características tienen además
un fondo de ese mismo color al 12% sobre la superficie, como las condiciones
seleccionadas. Es permanente y no implica selección; salvaciones/habilidades
conservan su fondo neutral. Contraste calculado mínimo del nuevo tratamiento:
5,15:1 en claro/oscuro. Los nombres
completos están en tooltips; la característica asociada de cada habilidad se
conserva en su etiqueta accesible. El tooltip ahora incluye su aporte numérico
al desglose, según el pedido posterior del usuario.
Los matices concretos se pueden ajustar al revisar; la regla de asociación y
orden sí procede del pedido del usuario. CON no genera una fila vacía o nota.

Validación local: dieciocho habilidades únicas en el orden solicitado, con una
sola grilla. Contraste calculado previamente, conservando los tokens: mínimo
5,56:1 contra las superficies de la maqueta, incluyendo selección con el acento
por defecto. Falta inspección visual; no se afirma contraste de cualquier acento
que se elija manualmente. La aplicación real todavía no usa estos tokens.

## Vocabulario candidato de habilidades

No imponer exactamente tres letras. Primero evitar colisiones y mantener una
abreviatura estable en ficha, acciones, filtros y ayudas.

| Habilidad | Código candidato | Icono candidato |
| --- | --- | --- |
| Acrobacias | Acr | Figura de pie |
| Trato con animales | Ani | Huella animal |
| Arcano | Arc | Destellos |
| Atletismo | Atl | Pesa |
| Engaño | Eng | Máscaras |
| Historia | His | Pergamino |
| Perspicacia | Psp | Rostro en observación |
| Intimidación | Intm | Rostro enfadado |
| Investigación | Inv | Lupa |
| Medicina | Med | Cruz |
| Naturaleza | Nat | Hoja |
| Percepción | Per | Ojo |
| Interpretación | Intp | Nota musical |
| Persuasión | Prs | Conversación |
| Religión | Rel | Libro abierto |
| Juego de manos | Jdm | Mano |
| Sigilo | Sig | Pasos |
| Supervivencia | Sup | Brújula |

Colisiones a revisar especialmente:

- Percepción, Perspicacia y Persuasión no pueden compartir «Per».
- Inteligencia, Intimidación e Interpretación no pueden compartir «Int».
- Acr y Arc tienen letras muy parecidas: comprobar lectura rápida y utilidad
  de los iconos junto a ellas.

Los códigos de Psp/Prs/Intm/Intp y algunos símbolos requieren evaluación; no se
consideran aprobados por el usuario. Preferir una palabra algo más larga si
reduce errores frente a una abreviatura demasiado críptica.

## Procedencia de cifras

Cada cifra derivada y su explicación deben salir de la misma proyección. En
la maqueta, habilidades/salvaciones usan puntaje, competencia/pericia explícita
y aportes con nombre. Pasivas: base 10 más todos los aportes de su habilidad
y ajustes específicos de la pasiva. Iniciativa: Destreza y aportes propios.
Velocidad: base registrada en pies y ajustes identificados. Los recursos muestran
máximo menos usos consumidos. Las tiradas usan el mismo modificador mostrado.

Los tooltips se leen por líneas, sin instrucciones de clic ni texto de reglas
extenso. Los valores de consulta (velocidad, pasivas, competencia, contadores)
tienen foco de teclado para consultar la ayuda sin una acción de juego. Se
mantienen el hover y Escape. Condiciones y botones de acción siguen con el
nombre solo: esta revisión se refiere al origen de números.

No deducir competencia, armadura, especie o equipo por diferencia entre base y
total. Si falta procedencia, indicar «valor registrado» y «origen sin detallar».
Es el caso de CA y algunas bases/máximos del ejemplo actual. No se conocen los
aportes por nivel de PG, ni la armadura o especie de los personajes sintéticos.
No se genera un desglose falso. Esta limitación queda visible en la ayuda.

El modelo local es una ilustración, no el motor real: seleccionar una condición
no aplica automáticamente sus reglas a las cifras. Al integrar, usar resultados
y fuentes del dominio, incluyendo límites, sustituciones y efectos que no sean
sumas. No duplicar esas reglas en la presentación.

## Contrato de tooltips para la aplicación

1. Mostrar ayuda breve al hover y al foco de teclado; mantener un nombre
   accesible completo incluso cuando visualmente aparezca una abreviatura.
2. Permitir cerrar con Escape, conservar el foco en el control y evitar que
   el tooltip tape el dato que explica o salga del panel.
3. Mantenerlo visible mientras corresponda al hover/foco, incluyendo movimiento
   del cursor sobre la propia ayuda. Usar una demora breve y configurable en
   la especificación para evitar parpadeos al recorrer una cuadrícula.
4. No colocar botones, formularios ni reglas extensas dentro de un tooltip.
   Para ese contenido, usar un panel de detalle o diálogo.
5. Ofrecer acceso por activación explícita para contextos sin hover y conservar
   una alternativa con nombres completos. No depender solo de `title` nativo.
6. Hover y foco no ejecutan tiradas, no consumen recursos y no cambian estado
   de juego. Por pedido del usuario, el clic en atributo/habilidad tira
   directamente, sin panel ni confirmación intermedia. Usar botones nativos
   para la activación por teclado y evitar listeners que dupliquen la tirada.
7. No ocultar solo en tooltip información necesaria para actuar: coste,
   disponibilidad, selección de objetivo, PG, cargas o consecuencias importantes.

En la aplicación se deberá implementar y probar el componente de ayuda con
semántica accesible (`aria-describedby` y `role="tooltip"` cuando corresponda).
El patrón APG consultado es una guía en desarrollo; no sustituye comprobar el
comportamiento real ni equivale a una auditoría completa de accesibilidad.

## Maqueta única revisable

Fuente: `ui-redesign/compact-icon-sheet.html`.
Por pedido del usuario, **todas las revisiones siguientes modifican este mismo
archivo**. No crear otro HTML para una pantalla, variante o caso adicional.

- Misma base de grafito y cobre para aislar la comparación del vocabulario;
  esto no fija definitivamente una paleta o variante de la aplicación.
- Solo iconos y modificadores por defecto; abreviaturas/nombres en Ajustes.
- Seis características, dieciocho habilidades, PG y CA con datos ilustrativos.
- Seis salvaciones visibles justo debajo de sus características. Cada pareja
  permanece unida incluso cuando la grilla se ajusta al ancho disponible.
- Las 32 celdas de atributos, salvaciones, habilidades, PG y CA tienen nombre
  accesible y tooltip con procedencia o indicación de desglose no disponible.
- Activar habilidad/atributo tira directamente un d20 local de ejemplo y suma
  su modificador; PG abre su formulario y CA abre su consulta. La tirada no
  añade un resultado visible al pie; se conserva en el historial opcional.
- Controles para comparar ancho, tamaño de lectura y presencia de iconos.
- Experiencias de jugador, GM y acceso dentro del mismo panel.
- Estados normal, carga, vacío, sin resultados, error, desconexión, conflicto
  y solo lectura; formularios con validación, confirmación y resultado local.

### Cobertura de revisión

| Área | Recorridos incluidos en la maqueta |
| --- | --- |
| Ficha | Elegir personaje y modo; consultar seis atributos y dieciocho habilidades; PG/CA, daño, curación, PG temporales, condiciones, inspiración, muerte, descanso y recurso de clase |
| Condiciones | Grilla continua por columna, buenas verdes primero y malas rojas después; resumen de activas siempre visible bajo el título; selección traslada iconos entre disponibles/activas; tooltip mínimo, resaltado, quitar, deshacer/rehacer, estado propio por entidad y solo lectura |
| Acciones | Normal/ventaja/desventaja; separar consulta, ataque, daño y uso de carga; resultados explícitamente ilustrativos |
| Conjuros | Búsqueda y filtros; descripción, preparación, espacios, lanzamiento, ritual/concentración y aprendizaje desde catálogo en modo Edición |
| Equipo | Filtros, equipar, sintonía, cargas, consumibles, efectos, identidad pública de objeto sin identificar, identificación por GM, monedas y transferencia |
| Rasgos, progresión y extras | Uso de rasgos/efectos, consulta de niveles, subir nivel, acompañante con PG y condición |
| Notas | Crear, leer, editar, buscar y eliminar con confirmación; notas de jugador y GM separadas |
| Biblioteca | Consulta y búsqueda por capítulos, personajes, lugares y eventos; ejemplo de referencias relacionadas |
| Comercio | Comprar/vender con cantidades, carrito, saldo previsto, confirmación y cambios de inventario/monedas; estado del NPC, comercio habilitado y saqueo; negociación/hurto/asalto/implante representados como consulta de resolución |
| Combate GM | Elegir encuentro, consultar un combatiente sin mover el turno, abrir ficha, daño/condición de criatura, asociación de miniatura y edición de perfil |
| Personajes GM | Asistente de creación de cinco pasos, abrir ficha, archivar/restaurar y asignar jugador/miniatura |
| Contenido GM | Consultar, crear, editar, duplicar y eliminar criaturas, conjuros, objetos y comerciantes con formularios representativos |
| Herramientas | Checklist interactiva, tabla ilustrativa, formulario de viaje, ejemplo de NPC, referencias y documento de consulta |
| Ajustes y acceso | Etiquetas, tema, acento, preferencia de interfaz simulada, campaña, acceso, recuperación, invitación e informe locales; historial y restablecer ejemplo |
| Transversales | Deshacer/rehacer datos de ejemplo; aviso de borrador al navegar/cerrar; errores de formulario; estados de revisión y acciones deshabilitadas |

La cobertura es una base navegable para revisar casos, no la implementación de
todas las reglas. Creación, subida de nivel y editores usan elecciones genéricas;
no reproducen las doce progresiones de clase ni los formularios completos de
reglas. Biblioteca/documentos y desafíos de comercio necesitan desarrollar su
interacción detallada en futuras revisiones del mismo archivo. La pantalla de
conflicto muestra diferencias ilustrativas, sin resolver concurrencia real.

Los formularios se muestran en el flujo del panel sustituyendo el contenido de
la pantalla; no son modales definitivos ni simulan el encierro de foco. Se debe
validar la solución final de navegación, borradores, teclado y retorno de foco.
Los datos cambian solo en memoria y se reinician al recargar. El visor puede
recordar preferencias de revisión, pero no guarda notas, campañas o credenciales.

### Cómo abrir y mantener el ejemplo

Abrir **este mismo HTML directamente en Chrome/Edge** y recargar con Ctrl+R
después de cada modificación. Es un documento autónomo, sin servidor, build
ni conexión. Los controles superiores permiten elegir experiencia, estado,
ancho y presencia de iconos. Si el editor muestra código, abrir desde el
explorador de archivos con el navegador.

Incluye 97 símbolos de los [SVG oficiales de Lucide](https://lucide.dev/guide/static),
versión `lucide-static@0.468.0`, y sus avisos de licencia ISC/MIT. Se usan
referencias locales `use`, sin cargar una biblioteca JavaScript ni recurrir
al visor de conversación. `scripts/update-ui-prototype-icons.mjs` regenera
ese bloque a partir del paquete oficial extraído cuando se añaden nombres.
Las ayudas son locales, con hover/foco, `aria-describedby` y Escape; no dependen
del manejo de `data-tooltip` por el visor. No trasladar estos ejemplos a
TaleSpire esperando dependencias implícitas: adaptar el patrón a sus componentes.

Verificación local de la ampliación: JavaScript válido y 495 comprobaciones
DOM/interacción con happy-dom, incluyendo navegación, estados, formularios,
cambios de datos de ejemplo y deshacer/rehacer. Se comprobaron las 26 celdas
con sus nombres accesibles y ayudas. Tras detectar el fallo del archivo fuera
del visor se añadieron cuatro pruebas en `test/v2/ui-prototype.test.ts`, que
exigen dibujos SVG locales reales detrás de cada referencia, incluso después
de navegar, funcionamiento sin red/host y ayudas por foco/hover/Escape. Una
quinta prueba comprueba tirada inmediata única con modificador, sin ejecución
al hover/foco ni panel secundario.
La revisión del 2026-11-04 añade otras dos pruebas: alineación de cada pareja
atributo/salvación y modificador propio, y flujo por columna con filas calculadas
según ancho/etiquetas. Los siete casos pasaron, junto con typecheck. Esto verifica
estructura y comportamiento DOM, no posiciones medidas en un navegador real.
Dos casos adicionales verifican las condiciones colapsables y su reutilización
en ficha/acompañantes/combate: nueve pruebas en total, más typecheck. Falta la
revisión visual de los símbolos y del selector en el navegador del usuario.
Falta revisión visual real, medición de desbordamientos, recorrido completo de
teclado y validación en la WebView de TaleSpire.

## Siguiente paso

Revisar la ficha y el combate en esta maqueta única con el usuario. Elegir qué
elementos usarán abreviaturas y cuáles conservarán nombre visible, ajustar
símbolos ambiguos y completar los flujos priorizados en el mismo archivo.
La Ficha ya está implementada en Nueva con sus SVG y tooltip local, junto con
PX, inspiración, modos d20 y salvaciones/curación a 0 PG.
Revisarla dentro de TaleSpire: jugador → Ficha, GM → Personajes. Corregir densidad,
desbordamientos o ayudas con evidencia del juego, manteniendo la maqueta como
referencia de diseño. Las pruebas de habilidad/atributo/salvación ya usan la
lógica compartida; iniciativa, ataques/conjuros y recuperaciones completas serán
entregas posteriores mediante operaciones existentes y pruebas de comportamiento.

## Referencias

- [NN/g: Icon Usability](https://www.nngroup.com/articles/icon-usability/): iconos consistentes, reconocimiento y etiquetas visibles.
- [W3C APG: Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/): hover, foco, Escape y semántica de ayuda; patrón en desarrollo.
