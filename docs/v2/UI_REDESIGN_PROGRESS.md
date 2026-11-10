# Continuidad del rediseño de interfaz

Actualizado: 2026-11-09.
Leer este documento primero al continuar el rediseño. El usuario autorizó comenzar
la implementación y pidió que las próximas interacciones conozcan el siguiente
paso y cómo ejecutarlo. La implementación general está autorizada; respetar la
última indicación del usuario sobre revisar ejemplos y lineamientos antes de
aplicar nuevos cambios de presentación.

## Estado actual

### Distribución 1.0.44 para mod.io

Versión incrementada a 1.0.44 con changelog y paquete
`release/Talespire_CharSheet-1.0.44-modio.zip`. El empaquetador ahora usa el
manifest del build vigente para incluir los módulos/CSS diferidos de Actual,
Nueva y el asistente, sin arrastrar assets históricos. `script.js` importa el
entry en su ruta original, preservando sus imports relativos. Se distribuye
también la licencia SVG y se conserva el canal público de comunicación.

Validación de entrega: typecheck, **1501 pruebas pasadas y 3 omitidas en 175
archivos**, build de producción, ocho imports locales resueltos y 16 entradas
del ZIP verificadas byte a byte. Registro y SHA256 en
`release-1.0.44-validation.json`. Se prepara la entrega en `main`, solicitada
por el usuario; el remoto anterior solo tenía `master`. No se cambia la
preferencia predeterminada de Actual ni se considera completada la inspección
visual/dos clientes reales. La siguiente tarea sigue siendo la revisión de
Ficha dentro de TaleSpire descrita abajo.

### Última revisión: bloque compacto dentro de Ficha

Se replanteó la distribución con el feedback de densidad y se incorporó la
última corrección del usuario: **todo el bloque desde nivel hasta Desventaja
pertenece a Ficha, no a la cabecera común**. Nueva y el único prototipo HTML
mantienen la misma separación. La cabecera conserva selector, Editar y Más
opciones en todas las secciones; se retira la clase debajo del nombre y el
título general de la vista deja de ocupar espacio visual en Nueva.

- Ficha empieza con una sola superficie: nivel/PG/CA/iniciativa/velocidad en
  una fila, seguida por identidad y controles en una franja compartida.
  Las cifras secundarias ya no tienen recuadros individuales; PG conserva
  prioridad tipográfica, temporales y barra/borde/fondo verde→rojo.
- Identidad muestra los valores presentes, en orden raza/subraza, clase/subclase,
  trasfondo y alineación, con separadores discretos. No hay título ni etiquetas
  visibles por campo. Los nombres de los campos siguen en tooltips locales y
  etiquetas de lectura accesible; los vacíos no crean celdas «Sin registrar».
  Si no hay ningún dato se muestra una sola línea. Jugador pasa a Más opciones.
- Inspiración conserva nombre y estado en una sola línea. Descanso y
  Competencia conservan texto visible, sin iconos redundantes. Los tres se
  acomodan juntos con altura de **26 px para mouse**, compartiendo área con
  la identidad. Ventaja/Desventaja permanecen apiladas a la derecha, con
  candados compactos y sus estados verde/rojo. En táctil se conservan 44 px.
- Por debajo de 400 px, identidad ocupa el ancho disponible encima de los
  controles; no se parte la fila de nivel/PG en las dos filas anteriores.
  Los valores largos de identidad pueden envolver, velocidad conserva su
  tooltip completo. No se impone una altura fija que oculte texto.
- Equipo, Turno, Más y las secciones GM fuera de Personajes no repiten este
  bloque. La Ficha del personaje consultado por el GM sí lo incluye. Las
  actualizaciones recibidas en otra sección aparecen al regresar a Ficha.

Validación: typecheck, **54 pruebas en 7 archivos** (17 del HTML offline),
regresión del CSS minificado y `npm run build:v2 -- --emptyOutDir=false` pasaron.
Las comprobaciones existentes cubren ahora la ubicación exclusiva en Ficha,
cabecera única, navegación/recepción de PG, ayudas y conservación de comandos.
Un DOM simulado resolvió los controles de 26 px, etiquetas fuera del flujo y
las columnas declaradas; no mide layout real ni interpreta completamente
`light-dark()`/`color-mix()`. No se afirma medición de altura total o ausencia
de desbordamientos en la WebView. Persiste la limitación previa de captura de
navegador; no se repitió el intento bloqueado. Inspección real pendiente.
Sin iconos nuevos, cambios de reglas, datos de `.localstorage/` ni Toolset.

Siguiente paso: recargar Nueva → Ficha y revisar el bloque a 320/440/640 px,
con temporales, nombres/subclases largos, datos ausentes y modos activos.
Comprobar que al salir de Ficha solo persisten selector/Editar/Más opciones;
revisar foco, tooltips, contraste y táctil antes de ajustar más dimensiones.

### Entrega anterior: identidad común, etiquetas y colores de estado

Se aplicó el feedback en Nueva y en el único HTML canónico:

- Inspiración muestra su nombre y, debajo, Inactiva/Disponible/En uso; conserva
  los tres estados y comandos. Descanso y Competencia tienen etiquetas visibles.
  Inspiración pasa a 44 px de alto y ancho flexible para alojar ambas líneas.
- Ventaja está encima de Desventaja. Texto, borde y fondo activo usan verde y
  rojo respectivamente, también en los candados. La tira se redistribuye a
  560/380 px para mantener legibles las etiquetas.
- PG incorpora barra accesible de porcentaje y el mismo color en borde/fondo
  de la tarjeta: verde al 100%, amarillo al 50%, rojo al 0%, con transición por
  proporción. Los temporales siguen separados y no ocultan daño. Máximo cero,
  valores negativos y sobre el máximo quedan acotados al representar la barra;
  no se modifican los valores de la campaña para dibujarla.
- Selector, Editar y Más opciones pertenecen a la cabecera común, incluida la
  navegación GM. Editar general y Descanso conservan su disponibilidad en Actual.
  Más opciones permite elegir y guardar el color del personaje usando el campo
  existente y `CampaignApplication.editCharacter`, revisión y checksum. El color
  identifica el marco/fondo del selector y el nombre, con el tema de contraste
  existente; las opciones también llevan el color de cada personaje. No hay
  migración ni preferencia global de color. Los lectores sin adaptador de juego
  no pueden guardar; se conservan las restricciones a 0 PG y durante operaciones.
- Ficha añade Identidad del personaje, con pares Raza/Subraza, Clase/Subclase,
  Trasfondo/Alineación y Jugador. Las etiquetas están arriba de los valores,
  la lectura sigue filas y los nombres largos pueden ocupar varias líneas.
  Los datos ausentes dicen Sin registrar. La maqueta también permite editar
  estos campos sintéticos; no se copió ese editor a la aplicación.

Validación: typecheck y **54 pruebas en 7 archivos** pasaron, incluidas las
17 de la maqueta offline, guardado/recarga de color, doble envío, conflicto sin
sobrescribir cambios remotos, cabecera en todas las secciones de jugador/GM,
identidad y recepción de PG sin escrituras. Pasó la regresión del CSS aislado
en build minificado. `npm run build:v2 -- --emptyOutDir=false` compiló y actualizó
`dist-v2`; mantiene el aviso conocido de chunks grandes. Los 97 SVG oficiales
no cambian. No se modificó `.localstorage/` ni Toolset.

Límite visual: el host de navegador no está disponible. Computer Use detuvo
el acceso nativo a Chrome porque no pudo determinar con certeza su URL actual.
No se eludió el bloqueo ni se afirma inspección visual, medición de layout o
validación en la WebView. No se repitió toda la suite de reglas ni dos clientes
reales. Siguiente paso: recargar Nueva y revisar esta cabecera y la sección de
identidad a 320/440/640 px, guardado de color en dos personajes, PG altos/bajos,
nombres largos y menús con teclado. Ajustar con evidencia del juego.

### Entrega anterior: cabecera compacta y estados visuales de inspiración

Se aplicó el feedback de tamaño/jerarquía en Nueva y en el HTML canónico, sin
cambiar cálculos ni comandos. Cabecera en dos conjuntos: nivel/PG/CA/iniciativa/
velocidad y una tira de inspiración/descanso/competencia/modos de tirada.

- Nivel vuelve al aro de **54 × 54 px** de Actual. Desaparece la tarjeta grande
  y el detalle de PX permanente: actuales, faltantes y tramo están en tooltip
  y en el panel que se abre tocando el aro. Se mantienen agregar PX, umbral,
  resaltado, nivel máximo y asistente de subida. Cuando corresponde aparece un
  acceso pequeño de subida con icono y nombre/tooltip completo. El panel no
  desplaza la ficha; Escape lo cierra devolviendo foco y clic fuera lo cierra.
- Inspiración de **100 × 36 px** con icono y estado visible: Inactiva, Disponible,
  En uso. Disponible usa fondo al 25% del acento y borde; En uso usa fondo pleno,
  texto de contraste y estrella rellena. No muestra la acción en su texto visible;
  el tooltip explica qué hará el próximo clic. El ciclo de tres estados y el
  consumo de inspiración siguen usando la misma lógica. `aria-pressed` expresa
  disponibilidad (también true al estar preparada); `data-inspiration-state`
  distingue inactive/available/armed. No usar aria-pressed como único indicador
  de si está armada.
- PG conserva prioridad tipográfica. CA, iniciativa y velocidad comparten
  icono/etiqueta corta/cifra en superficies de 54 px de alto. El texto largo de
  velocidad se recorta visualmente, con valor completo en su ayuda. Descanso
  usa solo luna con nombre accesible/tooltip (sigue disponible en Actual).
  Competencia usa icono y cifra. Modos y candados mantienen altura uniforme.
- En panel estrecho se reparten filas conservando orden; a 400 px o menos los
  modos pasan a su propia fila. A 380 px o menos nivel ocupa una columna y PG
  encabeza las tres cifras secundarias. Los controles táctiles mantienen 44 px;
  el acceso de subida queda debajo del aro para no taparlo.

Comprobaciones: typecheck y **82 pruebas en 8 archivos** pasaron, incluidas
regresión de Actual, funciones de Ficha, panel de experiencia/teclado sin
escrituras, estados de inspiración y CSS aislado del build minificado. Un DOM
simulado con los estilos del HTML resolvió aro 54 × 54 y botón 100 × 36, panel
cerrado por defecto; esto no sustituye medición ni inspección en la WebView.
`npm run build:v2 -- --emptyOutDir=false` pasó y dejó la cabecera actualizada
en `dist-v2`, con verificación del entry y los controles de producción.
No hay iconos nuevos (97), cambios de
reglas, modificaciones de `.localstorage/` ni trabajo sobre Toolset.

Siguiente paso: recargar Nueva y revisar la cabecera en el ancho habitual del
juego: tres estados de inspiración, tooltip/desplegable de nivel, temporales y
velocidad larga. Ajustar con capturas reales antes de ampliar funcionalidades.

### Entrega anterior: nivel/PX, inspiración, modos d20 y salvaciones de muerte funcionales

El usuario pidió las funciones de Actual en la nueva Ficha. Se habilitó esta
capa de interacción explícita, sin cambiar la preferencia predeterminada ni la
UI elegida por otros clientes. Nueva se rotula ahora «en pruebas», no «consulta».
La etiqueta visible Modificador se retiró de la maqueta (ya no existía en Nueva).

- Nivel: indicador mayor con aro/barra, PX actuales/faltantes y límites del nivel.
  Se resalta al alcanzar el umbral y muestra Subir de nivel. Agregar PX usa
  `CampaignApplication.editCharacter`; no adelanta niveles automáticamente.
  Se reutiliza `openCharacterBuilder` y `advanceGuidedCharacter`, con revisiones
  y checksum del momento de apertura. Fichas sin builder y nivel 20 conservan
  los límites existentes. El asistente mantiene elecciones/draft y cancelar no
  modifica campaña; su CSS propio permite usarlo sin cargar la hoja Actual.
- Inspiración mayor: Activar (persistente), Usar (armado local), Desactivar.
  Una prueba de habilidad, característica o salvación usa inspiración preparada
  y la consume mediante el comando compartido, sin mostrar resultados al pie.
- Ventaja/desventaja: botones con candados oficiales. Un modo desbloqueado se
  consume tras aceptar una solicitud de dados; bloqueado persiste por personaje
  en esa sesión hasta desbloquear. Se combinan con ajustes de dominio e inspiración
  usando las mismas funciones de Actual. El fallo de envío conserva los estados.
- 0 PG: panel de éxitos/fallos/reinicio y Curar. Bloqueo visual y de controlador
  para todas las demás operaciones de personaje, incluso con eventos forzados.
  Las lecturas y navegación siguen disponibles. Al sanar desaparece el panel.

**Cambio de comportamiento pedido por el usuario:** el comando compartido nuevo
`record-death-save` suma un éxito/fallo. El tercer éxito recupera 1 PG y limpia
los contadores en una única revisión/escritura. Se usa también en los botones
de Actual; no es solo decoración ni la regla previa de estabilizar a 0 PG.
No se ejecuta al leer datos guardados ni retroactivamente. Los contadores
resueltos no aceptan más incrementos; Curar continúa disponible. La sección
reproduce los controles manuales de Actual; no se añadió un d20 automático de muerte.

Implementación: `character-play-controls.ts` extrae y conserva las exportaciones
anteriores de BrowserApp (PX, modos y dados de condiciones); ambas vistas usan
esas funciones. `NextAppOptions.play` es un adaptador opcional de tres comandos
compartidos y DiceRoller; sin él, NextApp sigue siendo lector. Las fábricas de
jugador/GM sí lo conectan. Campos de ficha y metadatos salen del dominio real,
sin usar la lógica sintética del HTML. Ataques/conjuros, edición general,
descansos y condiciones mutables continúan en Actual.

Se bloquean clics duplicados mientras una operación está pendiente. Un conflicto
refresca la lectura y muestra error, sin repetir dados ni comandos. Si los dados
ya fueron aceptados pero falla consumir inspiración, el armado local se quita
para no aplicarla automáticamente otra vez. Cancelar una bandeja ya aceptada
no restaura estados: se conserva el momento de consumo de Actual.
Cambiar campaña limpia modos/armado, y una actualización que quita inspiración
también desarma el personaje. Al cambiar de interfaz/recargar se pierden los
estados transitorios de sesión, como en Actual; la inspiración guardada y PX persisten.

La maqueta única se actualizó en el mismo archivo con estos estados sintéticos.
Sprite y bundle pasan a 97 SVG oficiales (candados añadidos), sin dependencias
externas. No se modificó `.localstorage/` ni Toolset.

Validación terminada: typecheck y 103 pruebas en 12 archivos pasaron, incluyendo
compatibilidad de Actual, progresión/PX, apertura/cancelación del asistente,
inspiración/modos temporales/bloqueados, fallo de dados, doble clic, conflictos,
restricciones a 0 PG, curación y tercer éxito atómico. La maqueta incluye 15
pruebas; se conserva la regresión del CSS minificado y los conflictos de subida
guiada. `npm run build:v2 -- --emptyOutDir=false` pasó y actualizó `dist-v2`.
No se repitió la suite completa de todas las clases en esta entrega. Sigue
pendiente la inspección visual en TaleSpire y la prueba con dos clientes reales.

Siguiente paso: recargar Nueva, revisar el indicador de PX, los estados de
inspiración/candado y el recorrido 0 PG → éxitos o curación → 1+ PG. Corregir
con feedback del juego; después priorizar iniciativa, ataques/conjuros o gestión
completa de PG/descansos mediante comandos compartidos, sin copiar reglas de la maqueta.

### Entrega anterior: Ficha rediseñada en Nueva, con datos reales y solo consulta

El usuario autorizó llevar el diseño al juego. Nueva incorpora la Ficha con
identidad/selector unificado, PG/temporales, CA con armadura, iniciativa,
velocidad, inspiración, condiciones, atributos/salvaciones emparejados,
habilidades por característica/alfabeto y lectura por columna, pasivas, recursos
registrados, espacios de conjuro, dados de golpe, competencias/idiomas y rasgos.
Se mantienen los colores por atributo y sus fondos tenues. Iconos oficiales
locales (95 SVG, licencia incluida) y tooltips propios, sin red ni visor externo.
El jugador inicia en Ficha; el GM accede desde Personajes y conserva Combate.

Esta entrega es de consulta: las celdas permiten foco/tooltip, no tiran dados;
edición, descanso y uso de recursos se indican como disponibles en Actual.
Las condiciones activas permanecen bajo el título al abrir/cerrar; las restantes
se muestran como catálogo de consulta sin activar/desactivar. Cambiar personaje,
sección o expandir condiciones no escribe en campaña. Actual continúa por defecto;
la elección local, el regreso y la sincronización de lectura no cambian.

`next-sheet.ts` usa `projectCharacterStatistics` para las cifras reales. La nueva
función de lectura `projectCharacterStatisticOrigins` vive en el mismo módulo
de dominio; no reemplaza ni altera los cálculos existentes. Identifica puntaje,
competencia/pericia/media competencia, bonos registrados, rasgos/equipo efectivos
y fuentes de clase compatibles. Una diferencia sin detalle queda marcada como
ajuste no desglosado; no se le inventa causa. No expone nombres de objetos sin
identificar, sin sintonía requerida, agotados o inefectivos. CA y velocidad usan
el registro real, sin reconstruirlos ni sumar dos veces cambios ya incorporados.
El desglose completo de esos registros y de máximos por nivel sigue pendiente.

Las actualizaciones remotas conservan selección, sección, condiciones expandidas,
descripciones abiertas, foco de estadística y posición de lectura. Los tooltips
se actualizan con los valores; sus listeners/observer se liberan al detener la vista.
El HTML canónico sigue siendo el único prototipo de diseño; no se incrusta su
estado sintético ni sus acciones en el juego.

Validación terminada para esta entrega:

- Typecheck y 40 pruebas de la entrega en 7 archivos pasaron: consulta, fuentes,
  maqueta, selector, arranque/carga aislada y CSS del build minificado.
- Regresión amplia V2 + integración: 1481 pruebas pasaron, 3 omitidas; una prueba
  existente de 54 combinaciones de Cazador superó su timeout explícito de 15 s
  bajo concurrencia (172 archivos pasaron, 1 omitido y ese archivo falló).
  Se repitió esa prueba aislada con un worker: pasó en 12,13 s. No se alteró el
  constructor ni se subió su timeout para ocultar el resultado original.
- `npm run build:v2 -- --emptyOutDir=false` pasó y actualizó `dist-v2/v2.html` y
  sus assets. Se verificó que el entry referencia la nueva vista con la Ficha y
  tooltips. La licencia completa de SVG se distribuye también en
  `dist-v2/third-party/lucide-LICENSE.txt`, copiada desde `public/third-party/`.
  El aviso conocido de chunks grandes no impidió compilar.
- No se modificó `.localstorage/`, Toolset ni se emitieron acciones de campaña.
  La inspección visual y dos clientes reales en TaleSpire siguen pendientes;
  la prueba con dos lectores DOM sí conserva estados locales independientes.

Siguiente paso concreto: elegir Nueva y recargar desde TaleSpire; jugador → Ficha,
GM → Personajes. Revisar densidad/iconos/tooltips con datos reales, panel estrecho
y cambios recibidos de Actual. Después ajustar la presentación y diseñar la primera
tirada mediante controlador compartido, sin habilitar comandos directos desde UI.

### Revisión anterior: procedencia de los valores numéricos en tooltips

Pedido vigente: el tooltip de una propiedad numérica debe explicar de dónde
sale su valor, no limitarse al nombre. Esto sustituye la regla anterior de
tooltips mínimos para cifras; condiciones y botones de acción conservan su nombre.
El HTML canónico muestra nombre y aportes por línea: Investigación +7 = +3 de
Inteligencia (puntaje 16) y +4 de competencia (nivel 10); las pasivas añaden la
base de 10. Se aplicó a atributos, salvaciones, habilidades, iniciativa, velocidad,
competencia, PG/CA, recursos de clase y espacios de conjuro; PG de acompañantes y
PG/CA del combate reutilizan las explicaciones. Los datos no accionables con
tooltip pueden recibir foco de teclado, sin convertirse en botones.

Se retiraron los modificadores fijos de habilidades/salvaciones del ejemplo.
`skillTraining`, `saveTraining` y `numberBonuses` representan fuentes explícitas
de datos sintéticos. Las proyecciones `skillValue`, `saveValue`, `passiveValue`,
`initiativeValue` y `abilityValue` alimentan cifra, explicación y tirada; editar
un puntaje o cambiar personaje recalcula los resultados coherentemente. Hay
soporte local para competencia/pericia y aportes positivos/negativos con nombre,
incluidos ajustes solo pasivos. No se implementó un motor de efectos de campaña.

Límite: CA, velocidad base, puntajes y máximos de PG/recursos del ejemplo estaban
guardados como escalares. Sus tooltips identifican el registro y avisan que falta
el desglose, sin inventar armaduras, raza, objetos o fuentes a partir del total.
PG actuales se explican como máximo menos pérdida; temporales como registro sin
origen detallado. El origen por nivel/equipo requerirá datos reales del dominio.

Validación: trece pruebas de la maqueta, typecheck y 511 checks locales pasaron.
Se verificaron edición con recálculo de habilidad/pasiva/salvación/tirada,
cambio de personaje/nivel, competencia/pericia, fuentes con signo, velocidad,
efectos solo pasivos y foco sin tiradas ni escrituras. SVG sin cambios (95).
No se hizo inspección visual, build ni cambios en la aplicación o la campaña.

Siguiente paso concreto: recargar `ui-redesign/compact-icon-sheet.html` y revisar
la legibilidad del desglose en Investigación, salvaciones, velocidad y pasivas.
Ajustar ese mismo HTML. Antes de trasladarlo a Nueva, inventariar las fuentes
que conserva el dominio y definir una proyección compartida con procedencia,
incluidos límites/reemplazos y permisos. Ver contrato en `UI_REDESIGN_PLAN.md`;
continúan pendientes las validaciones reales de recuperación. Actual sigue
siendo la interfaz de juego.

### Revisión anterior: operaciones directas de puntos de golpe

La ventana de PG del HTML canónico reemplaza el combo de operación y el botón
Aplicar por una cantidad y cuatro botones de icono: Curar (corazón/pulso verde),
Dañar (corazón roto rojo), Puntos de golpe temporales (escudo/+ azul) y Cancelar
(cruz neutra). Cada uno tiene nombre accesible y tooltip mínimo. Los tres primeros
aplican directamente la cantidad; cancelar descarta el ingreso sin modificar
datos ni pedir un segundo cierre. No hay un quinto botón de cierre en la cabecera.
Enter dentro de Cantidad no elige una operación implícita; los botones conservan
su activación por teclado. En ancho táctil pequeño pueden pasar debajo del campo.
El mismo formulario se usa en Ficha y para criaturas del combate GM.

Validación: once pruebas de la maqueta, typecheck y 511 checks locales de
interacción pasaron. Se comprobaron curación limitada al máximo, daño absorbido
por temporales, cancelación sin entrada de deshacer y aislamiento del combatiente.
Sprite actualizado a 95 símbolos oficiales. Falta revisión visual en navegador;
no se hizo build ni se modificó la aplicación real o datos de campaña.

Siguiente paso concreto: recargar `ui-redesign/compact-icon-sheet.html`, abrir PG
desde Ficha y revisar los cuatro iconos con el usuario. Ajustar el mismo archivo
si hace falta; después continuar la revisión de Ficha y las validaciones de
recuperación mediante comandos compartidos descritas en el plan. Actual sigue
siendo la interfaz de juego; las acciones de esta maqueta son sintéticas.

### Revisión anterior: fondo del color de cada característica

Las seis características tienen ahora un fondo tenue de su mismo color de texto,
mezclado al 12% con la superficie, siguiendo el resaltado de las condiciones
activas. Es una identificación visual permanente, no un estado de selección.
Se aplica a atributos; salvaciones y habilidades conservan sus fondos anteriores.
Las nueve pruebas de la maqueta pasaron; contraste calculado mínimo 5,15:1 entre
texto y fondo nuevo en claro/oscuro. Falta revisión visual. Siguiente paso:
recargar el mismo HTML y revisar el conjunto de Ficha antes de continuar con
las validaciones de recuperación pendientes. No se modificó la aplicación real.

### Patrón vigente: Ficha reorganizada y vistas previas de recuperación

El usuario aprobó reorganizar Ficha, pidió retirar el resultado visible de las
tiradas y quiere prever qué recuperará cada personaje con descansos/Recuperación
arcana. Se aplicó en el mismo HTML autónomo, sin modificar la aplicación real.

La cabecera unifica nombre/selector, clase y nivel; lápiz para edición y menú
con modo Juego/Edición, subida de nivel y progresión. Se retiró el selector
duplicado de Ficha y la fila grande de botones de edición/nivel/iniciativa.
PG conserva protagonismo y temporales visibles; CA, iniciativa y velocidad son
datos compactos a su lado. Tocar PG abre su gestión y la iniciativa tira desde
su propio valor. Inspiración es un icono resaltable; descanso y bono de competencia
quedan juntos. En panel estrecho la cabecera se adapta sin retrato decorativo.

Después de condiciones/atributos/salvaciones/habilidades aparecen tres pasivas
como datos, sin estilo de botón; recursos de clase en fila compacta con nombre,
usos y acción; y competencias/idiomas organizados en un desplegable. Se mantienen
los iconos elegidos, colores, tooltips mínimos y condiciones de 26 opciones.
Los resultados de tiradas dejan de producir un aviso automático al pie; la
activación directa y el registro manual de historial siguen disponibles.

Descansar abre una vista previa con selector corto/largo y personajes participantes
(por defecto el actual). Cada nombre muestra una lista de cambios antes → después
y elecciones pendientes. Recuperación arcana permite elegir cantidades de espacios
y muestra los espacios recuperados y el uso consumido. Abrir, editar la selección
o cancelar no cambia datos; aplicar usa el mismo plan local de ejemplo que produjo
la lista. La recuperación de dados de golpe/PG, espacios, rasgos y recursos está
simplificada: **no es el cálculo de reglas completo ni una integración de campaña**.
La curación de descanso corto con dados de golpe queda como elección pendiente;
el ejemplo no promete curación automática. Los datos de velocidad, competencias,
pasivas y algunos recursos siguen siendo ilustrativos.

Se inspeccionaron `applyCharacterResourceCommand` en `character-resources.ts`
y la acción `arcane-recovery` de `wizard-play.ts`: ya existen operaciones de
reglas. La futura vista previa real deberá proyectar sus mismos resultados sobre
copias, incluir cambios de equipo/rasgos/clase y comprobar revisiones al aplicar,
sin duplicar reglas en la UI. Ver el contrato pendiente en `UI_REDESIGN_PLAN.md`.
El usuario pidió continuar diseño primero y añadir validaciones después: no dar
por terminada la lógica de recuperación ni trasladar el plan simplificado a Nueva.

Validación: nueve pruebas existentes actualizadas pasaron; typecheck y 502 checks
locales de interacción pasaron. Comprobación específica de la vista previa sin
escrituras, cancelación, recuperación elegida, personajes seleccionados, aplicar
y deshacer con datos sintéticos. Sprite actualizado: 93 símbolos oficiales.
No se realizó revisión visual en navegador ni build. Siguiente paso: recargar
el HTML y revisar cabecera, densidad, recursos y listas de recuperación con el
usuario. Después inventariar casos reales y diseñar las validaciones compartidas
antes de conectar estas acciones a Nueva. Actual sigue siendo la interfaz de juego.

### Revisión anterior: botones más angostos y reparto uniforme de 26 condiciones

El catálogo de la maqueta tiene **26 opciones: 8 buenas y 18 malas**. Por pedido
del usuario se redujeron el relleno horizontal y la separación de botones de
condiciones, manteniendo iconos de 18 px. Con el panel habitual de 520 px, el
catálogo completo se distribuye en **13 columnas y 2 filas**, sin huecos finales,
con botones de aproximadamente 34 px de ancho y 36 px de alto.

Se conserva la lectura por columna, buenas primero, orden alfabético y colores.
El cálculo usa el ancho real de la sección para elegir columnas/filas y mantiene
el mismo ancho de botón en activas/disponibles. Las pantallas estrechas añaden
filas en vez de desbordar. Mínimo para mouse: 32 px de ancho; para puntero táctil:
44×44 px, con recálculo cuando cambia el tipo de puntero. Una selección reduce
la cantidad disponible, sin cambiar el ancho de las columnas ni el resumen
al abrir/cerrar.

Comprobaciones: nueve pruebas de la maqueta y 495 checks de interacción pasaron.
Comprobación adicional de cálculo en anchos 320/440/520 y mouse/táctil: conserva
26 iconos y respeta sus anchos mínimos. No se hizo inspección visual ni build.
Siguiente paso: recargar el mismo HTML y revisar el tamaño/densidad con el usuario;
ajustar aquí antes de llevar el patrón a la aplicación. Mantener las decisiones
de iconos, colores, tooltips mínimos y selección ya documentadas.

### Patrón vigente: condiciones juntas, buenas primero y lectura por columna

Se aplicó el nuevo pedido en el mismo HTML y componente de ficha, acompañantes
y combate. Se eliminó la separación central y los títulos de buenas/malas:
las condiciones forman una grilla continua como las habilidades. Primero van
las buenas verdes y después las malas rojas; dentro de cada tipo se conserva
el orden alfabético por nombre completo en español. Se llena de arriba hacia
abajo por columna y después hacia la derecha, con el mismo orden en el DOM y
el teclado. Reemplaza las dos mitades y su alineación izquierda/derecha de D-025.

El resumen de activas es un bloque separado **siempre visible debajo del título**,
también en grilla continua, con buenas primero y malas después. Abrir o cerrar solo oculta/muestra las
disponibles; no cambia iconos, orden, alineación ni resaltado del resumen.
Seleccionar una disponible la quita del selector y la añade resaltada al resumen.
Tocar una activa la desactiva y la devuelve a las disponibles. Este gesto sustituye
la consulta sin modificación del resumen anterior. Tooltip: solo nombre;
hover/foco nunca activan condiciones. En solo lectura se mantiene la consulta
por foco/tooltip, sin permitir quitar la activa.

Clasificación de presentación inicial (no nuevas reglas de juego): buenas =
Acelerar, Bendición, Concentración, Furia, Guía, Heroísmo, Invisible y Santuario;
las otras 18 del catálogo se muestran como malas, incluido Recargando. La
ubicación de estados contextuales como Concentración/Recargando es una decisión
provisional del ejemplo, revisable con el usuario. Nombres desconocidos activos
se conservan en malas con icono de ayuda hasta contar con una clasificación.

Cada icono conserva el color de su tipo; el resaltado seleccionado conserva borde y
relleno tenue, ahora del verde/rojo correspondiente. Contraste calculado contra
superficies claras/oscuras, incluidas las seleccionadas: mínimo 5,29:1. No se
afirma revisión visual. Se conservan deshacer/rehacer, expansión y estados propios
por entidad, así como los iconos elegidos de CA/salvaciones.

El cálculo compartido de grillas recalcula filas y columnas de habilidades y
condiciones al seleccionar, cambiar el ancho o redimensionar. Condiciones usa
trece columnas con dos filas en el ancho habitual, reduciendo columnas cuando
el espacio o el puntero táctil lo requieren, sin hueco entre categorías.
Las listas de activas/disponibles calculan sus filas independientemente; abrir
o cerrar no modifica el resumen y una lista vacía no reserva una fila en blanco.

Validación: nueve pruebas de la maqueta, 495 checks de interacción y typecheck
pasaron. Las pruebas comprueban una sola grilla sin separadores, buenas antes
de malas, flujo por columna y recálculo de filas al variar el ancho,
selección que cambia de lista, resaltado, resumen idéntico al abrir/cerrar,
eliminación desde el resumen, foco seguro y consulta bloqueada en solo lectura.
No se modificó la aplicación ni se hizo build. Siguiente paso: recargar el mismo
HTML y revisar lectura por columna, densidad y clasificación de efectos con el usuario.
Aplicar sus ajustes aquí antes de migrar el patrón mediante comandos compartidos.

### Revisión anterior: condiciones colapsables con selección por icono

Pedido del usuario aplicado al mismo HTML: una sección «Condiciones», cerrada
al inicio, muestra únicamente los iconos de las activas junto al control de
expansión. Si no hay activas, no añade iconos de relleno ni una lista de texto.
Al expandir muestra el catálogo de iconos; cada toque activa/desactiva una
condición sin cerrar la sección. El estado activo se distingue por relleno/borde
y `aria-pressed`. Los tooltips y nombres accesibles contienen solo el nombre.

Los iconos activos de la sección cerrada sirven para consultar el nombre,
sin quitar la condición accidentalmente: para cambiarla se expande el selector.
Abrir/cerrar no escribe datos. Se conserva la expansión de cada personaje,
acompañante o combatiente al actualizar la vista; las condiciones de distintas
entidades no se mezclan. El patrón reemplaza el diálogo de condiciones de la
ficha y el antiguo botón que alternaba una sola condición en extras/combate.

El catálogo ilustrativo usa las condiciones/efectos de Actual (listas de
`src/ui/browser-app.ts` y `src/ui/gm-app.ts`), más Agotamiento que ya existía
en la maqueta: 26 opciones con iconos locales. Las condiciones activas de nombre
desconocido se conservan, muestran un icono de ayuda y se pueden desactivar
al expandir; no se renombran ni se pierden. Esta es una propuesta de símbolos,
pendiente de revisión visual; no implementa reglas, niveles de agotamiento ni
consecuencias mecánicas. Cambios como Concentración al lanzar un conjuro también
se reflejan en el resumen. Solo lectura y miniatura sin asociación bloquean
las modificaciones pero permiten abrir la sección y consultar activas.

El sprite autónomo contiene ahora 92 símbolos oficiales. Validación: nueve
pruebas de la maqueta, los 495 checks de interacción previos, typecheck y
comprobación de espacios. Se verifica seleccionar varias sin cierre, solo iconos
activos al colapsar, tooltip mínimo, quitar/revertir, aislamiento de entidades,
Concentración desde conjuros y bloqueo de cambios en solo lectura/sin asociación.
No se inspeccionó visualmente en navegador ni se hizo build de la aplicación.

Siguiente paso: recargar el mismo HTML y revisar reconocimiento de estos iconos,
densidad del selector y lectura cerrada con varias condiciones. Mantener CA con
armadura, salvaciones con escudo/check, habilidades por columna y tiradas directas.
Corregir símbolos ambiguos en esta maqueta antes de llevar el componente a Nueva
mediante las operaciones compartidas de condiciones y sus pruebas.

### Elección vigente: iconos de CA y salvación

Elección confirmada y aplicada al mismo HTML: **CA = armadura (`shirt`)** y
**salvación = escudo con check (`shield-check`)**. Son los valores al abrir o
recargar, tanto en la ficha como en la CA del combate GM. El comparador queda
cerrado por defecto, disponible como referencia. Su restablecimiento vuelve
a esta elección aprobada, no al escudo compartido anterior.

Valores, colores, ayudas mínimas, tirada directa y distribución se conservan.
Se actualizaron las pruebas existentes para exigir los SVG elegidos: las siete
pruebas, 495 checks de interacción y `git diff --check` pasaron. No se
modificó la aplicación de TaleSpire; sigue siendo la maqueta autónoma.
Siguiente paso: revisar el conjunto de ficha y combate con estos iconos ya
elegidos y continuar los ajustes de diseño en este mismo archivo; no reabrir
la elección de iconos sin nuevo feedback del usuario.

### Referencia histórica: comparación de iconos

El usuario señaló que ambos usan el mismo escudo y pidió opciones. En el mismo
HTML se añadió un comparador abierto, encima de la ficha, con tres candidatos
para CA (escudo, prenda/armadura, muro/barrera) y tres para salvaciones (escudo
con check/resistencia, círculo con check/superación y dados/tirada). Cada opción
muestra el dibujo oficial y una limitación de su metáfora. Elegir una actualiza
inmediatamente los botones correspondientes de la maqueta, conservando valores,
tooltips, colores y tirada directa. «Volver a los iconos actuales» restituye
el escudo compartido que sirve como referencia inicial.

Propuesta del asistente, **todavía no elegida por el usuario**: CA con escudo y
salvación con círculo/check para separar sus siluetas. El check puede parecer
un resultado exitoso; los dados también representan otras tiradas; la prenda
se puede leer como ropa. Estos límites están visibles en la comparación.
Los cambios del comparador son pruebas de presentación y se reinician al
recargar; no registrar una selección de prueba como decisión final.

Se regeneró el sprite local: 70 símbolos oficiales, incluyendo los candidatos,
sin biblioteca ni red en tiempo de uso. Las siete pruebas existentes y 495
checks de interacción pasaron; una comprobación local recorrió los seis
candidatos, las referencias SVG, la selección accesible y el restablecimiento,
sin disparar tiradas. No se realizó una inspección visual en navegador.
La elección posterior del usuario y el resultado vigente están documentados
arriba; esta comparación no queda como decisión pendiente.

### Revisión anterior: salvaciones debajo de cada atributo y habilidades por columna

Pedido del usuario aplicado al mismo HTML autónomo: cada característica y su
salvación forman una pareja vertical, con el atributo arriba y el botón de
escudo debajo, compartiendo color. La pareja se mantiene unida al reacomodarse
en panel estrecho. Se retiraron las salvaciones del desplegable inferior,
que ahora contiene solo pasivas y competencias.

El tooltip de salvación solo indica su nombre («Salvación de Inteligencia»).
El clic tira directamente con su propio modificador. Los datos de ejemplo
incluyen bonificaciones de salvación separadas del modificador del atributo
(por ejemplo, Delerion: INT +3 y salvación de INT +7). No constituyen un motor
de progresión; al migrar a Nueva se usará la proyección compartida de estadísticas.

La grilla continua de habilidades se llena **de arriba hacia abajo por columna,
y después a la derecha**, conservando la secuencia por característica y nombre
completo. CSS usa flujo por columna, y se recalculan filas/columnas al renderizar,
variar ancho/etiquetas y recibir un cambio de tamaño del panel. El orden del DOM
y del teclado conserva la misma secuencia, sin reordenar botones visualmente
mediante índices CSS independientes.

Comprobaciones: siete pruebas de la maqueta, 495 checks locales de interacción
y `npm run typecheck` pasaron. Las nuevas regresiones comprueban parejas,
modificador propio y una tirada por clic de salvación, flujo por columna y
recálculo de filas con distintos anchos/etiquetas, conservando la secuencia.
No se hizo inspección visual ni build de la aplicación en esta revisión.

Siguiente paso: recargar el mismo HTML y revisar con el usuario la correspondencia
vertical atributo/salvación y la lectura por columnas a 320/440 px. Mantener
iconos, colores, tooltips mínimos y tirada directa; ajustar esta maqueta antes
de trasladar el patrón a Nueva con sus comandos y datos reales compartidos.

### Patrón vigente: grilla continua, icono/modificador y tirada inmediata

Nuevo pedido aplicado en el mismo `ui-redesign/compact-icon-sheet.html`:
las dieciocho habilidades están juntas en una sola grilla, sin títulos ni
contenedores por característica. Se conserva el orden FUE, DES, CON, INT, SAB,
CAR y el orden alfabético por nombre completo en español dentro de cada familia.
CON no añade un hueco ni un aviso a la grilla porque no tiene habilidades.

Por defecto, características y habilidades muestran únicamente **icono y
modificador**. Por el último ajuste pedido, el tooltip de habilidades contiene
solo el nombre completo («Historia»); el de características, nombre y puntaje
base («Fuerza · 10»). No repetir modificador, familia ni instrucciones de clic
en la ayuda. Conservan nombres accesibles que
describen la acción «Tirar». Se mantienen los colores de familia en iconos y
cifras. Los botones pasan a una fila compacta y se acomodan al ancho disponible;
los objetivos de interacción táctil mantienen al menos 44 px de alto.
En Ajustes se pueden comparar abreviaturas y nombres completos; la opción inicial
es «Solo iconos y modificadores».

El clic ejecuta directamente una **tirada local de ejemplo** d20 + modificador,
muestra resultado e incorpora una entrada al historial. Usa dados locales
aleatorios, con dos d20 si está activo el modo ventaja/desventaja. Se retiró
el detalle inferior de atributo/habilidad y el segundo botón para confirmar
la tirada. Hover/foco solo muestran la ayuda. No se conecta al DiceRoller de
TaleSpire ni ejecuta comandos de campaña: sigue siendo la maqueta, no Nueva.

Comprobaciones: cinco pruebas en `test/v2/ui-prototype.test.ts` y 495 checks
de interacción pasaron, además de `npm run typecheck`. La nueva regresión
comprueba que hover/foco no tiran, un clic genera un único d20, se suma el
modificador correcto y no se abre un panel secundario. La prueba de ayuda
verifica también el texto exacto mínimo de habilidad y característica. Se conserva el orden
de las dieciocho habilidades y los colores previamente calculados (mínimo
5,56:1 con las superficies y acento por defecto). Falta revisión visual local;
no se modificó la aplicación ni se necesitó build.

Siguiente paso: recargar el mismo HTML y revisar reconocimiento de los iconos,
tamaño a 320/440 px, ayudas y feedback de la tirada directa. Ajustar esta maqueta
con el usuario antes de llevar el patrón a Nueva. Cuando se implemente la
tirada real, reutilizar el controlador/DiceRoller compartido, probar exactamente
una ejecución por activación y mantener el piloto de consulta hasta esa entrega.

### Revisión local: abrir el mismo HTML directamente en el navegador

El usuario confirmó que está viendo `ui-redesign/compact-icon-sheet.html`.
Ese es el archivo correcto. Ahora es un **documento HTML autónomo**, con idioma,
codificación, viewport, estilos, iconos y ayudas propios. Se abre en Chrome/Edge
sin servidor, build, visor de conversación ni conexión a Internet. Mantener este
modo de revisión; no volver a entregar únicamente un fragmento que dependa del
visor, ni generar otro HTML para abrirlo fuera de la conversación.

Cómo revisar los próximos cambios:

1. Abrir ese archivo en el navegador. Si el editor muestra código, usar
   «Abrir con» Chrome/Edge desde el explorador de archivos.
2. Después de una modificación del asistente, recargar esa misma pestaña
   con Ctrl+R. Los cambios simulados de juego se reinician al recargar.
3. Elegir experiencia, estado y ancho en los controles superiores; dejar
   Iconos en «Visibles». Recorrer las pantallas y pasar el mouse o dar foco
   de teclado a las celdas para consultar sus ayudas.

Se corrigió la dependencia implícita de Lucide que causaba los huecos vacíos:
el archivo incorpora 93 símbolos SVG oficiales de `lucide-static@0.468.0`,
con licencia y procedencia, referenciados localmente mediante `use`. No requiere
`window.lucide` ni inicialización posterior al render. Las ayudas también son
locales: hover/foco, descripción accesible y cierre con Escape sin ejecutar acción.

Para añadir iconos en futuras revisiones, ejecutar
`node scripts/update-ui-prototype-icons.mjs <directorio-del-paquete-extraído>`
con el paquete oficial `lucide-static@0.468.0`. El generador actualiza solo el
sprite del HTML canónico, conserva atribución ISC/MIT y no modifica dependencias
de la aplicación. Fallar explícitamente si un icono solicitado no está incluido.

Comprobaciones de esta corrección: cuatro pruebas de regresión en
`test/v2/ui-prototype.test.ts`, sin Lucide/Tweak/openai y con red bloqueada,
verifican dibujos locales, navegación jugador/GM, ayudas por foco/hover/Escape
y controles de revisión. También pasaron los 495 checks anteriores de interacción,
`npm run typecheck` y `git diff --check`. No se necesitó build de la aplicación.
La prueba anterior comprobaba marcadores, no el dibujo SVG: no bastaba para
detectar este defecto.

Revisión visual actual pendiente: Computer Use detuvo el acceso a Chrome porque
no pudo determinar la URL actual con suficiente certeza para aplicar su política.
Se dejó de controlar el navegador. No se afirma inspección visual, medición de
desbordamientos ni validación real dentro de TaleSpire. El siguiente paso es
revisar la presentación local con el usuario y continuar densidad/iconografía.

### Pedido vigente: una única maqueta completa y evolutiva

El usuario pidió dejar de crear HTML distintos para cada revisión. La fuente
única es **`ui-redesign/compact-icon-sheet.html`**: ampliar y ajustar este mismo
archivo en las próximas interacciones. Los otros HTML quedan como antecedentes;
no son prototipos activos ni deben recibir nuevas variantes en paralelo.

La maqueta ahora reúne navegación de jugador, GM y acceso, con formularios y
operaciones locales de ejemplo. Incluye ficha, acciones, conjuros, equipo,
rasgos, progresión, notas, extras, biblioteca, comercio, combate, personajes,
contenido y herramientas. Arriba se pueden elegir ocho estados de revisión:
normal, carga, vacío, sin resultados, error, desconexión, conflicto y solo lectura.
Consultar la matriz de alcance en `UI_REDESIGN_ICONOGRAPHY.md`.

Las modificaciones de PG, monedas, objetos, notas y catálogos solo afectan
datos sintéticos en memoria. Deshacer/rehacer permite recorrer sus resultados.
No se conecta a TaleSpire, autenticación, dados, correo ni servicios remotos.
Los diálogos son paneles en el flujo del documento que sustituyen temporalmente
el contenido para revisar el recorrido; no son modales definitivos.

Validación de esta ampliación: sintaxis JavaScript válida y **495 comprobaciones
DOM/interacción** con happy-dom. Se recorrieron navegación, daño/PG temporales,
muerte/descanso, edición, borrador al navegar, espacios de conjuro, cargas,
transferencia, notas, compra, saqueo, creación guiada, asignación, catálogos,
herramientas, estados y ayudas accesibles. El entorno de prueba aporta
`structuredClone`, disponible en el navegador, que happy-dom no incluye.
Script local de QA: `.tmp/qa-single-prototype.cjs` (descartable, fuera de Git).
No se ejecutó build ni se modificó la aplicación en esta ampliación.
Esto no valida disposición visual, ausencia de desbordamientos, teclado completo
ni integración real con TaleSpire: quedan por revisar. Las ayudas e iconos del
HTML autónomo ya no dependen del host, según la corrección documentada arriba.

### Feedback vigente: comunicación compacta con iconos y abreviaturas

El usuario valora las fuentes y colores, y pide mayor eficiencia mediante
iconos/ilustraciones, abreviaturas y tooltips. Propone PG con corazón y CA con
escudo. No seleccionó inequívocamente una de las variantes anteriores.

Leer [lenguaje visual y vocabulario candidato](UI_REDESIGN_ICONOGRAPHY.md).
La ficha de la maqueta única compara abreviaturas con nombres completos desde
Ajustes: seis atributos, dieciocho habilidades, PG y CA. Incluye iconos, ayudas
locales de hover/foco y detalle al activar una celda. Las tiradas son
resultados ilustrativos explícitos, sin dados ni efectos de juego reales.
Los códigos ambiguos (Per/Psp/Prs, INT/Intm/Intp) siguen propuestos para revisión.

Esta ronda solo actualiza ejemplos y documentación. Antes de trasladar nuevos
estilos y tooltips a Nueva, revisar este vocabulario con el usuario conforme
a su pedido de ver propuestas antes de cambiar la aplicación.

### Pedido vigente: revisar dirección visual antes de aplicarla

El usuario aportó capturas del piloto ya formateado, pidió lineamientos y
ejemplos y aclaró que la paleta verde se puede reemplazar. Esta iteración solo
añade documentación y ejemplos; no modifica la aplicación ni el build.

Leer [lineamientos y alternativas](UI_REDESIGN_VISUAL_DIRECTION.md). Se prepararon
Mesa táctica, Atlas y Cuaderno en `ui-redesign/visual-directions.html`, con
combate y ficha comparables. Mesa táctica es una recomendación del asistente;
ninguna dirección o paleta está elegida por el usuario todavía.

Las capturas nuevas confirman que los estilos corregidos se ven en TaleSpire.
No permiten medir el viewport CSS ni confirman el regreso a Actual o dos
clientes reales. La implementación visual siguiente debe esperar la revisión
de estos ejemplos solicitada por el usuario.

### Iteración anterior: estilos de producción y primera jerarquía GM

El usuario confirmó que el selector funciona y aportó una captura de Nueva en
TaleSpire: botones con apariencia nativa, títulos desproporcionados y todos los
encuentros apilados. Esta evidencia confirma la entrada a Nueva, pero no valida
todavía el regreso completo ni la convivencia real entre dos clientes.

Se encontró un defecto reproducible en el build minificado: el selector de
imports condicionales acababa en un único preload con los assets CSS de Actual,
también al elegir Nueva. Un build sin minificación no reproduce el defecto.
Separarlo con `if/return` tampoco basta, porque el minificador vuelve a unirlo.

Corrección: `interface-views.ts` utiliza un registro de funciones `classic` y
`next`, cada una con su propio import. El artefacto minificado final contiene
dos preloads con sus CSS correspondientes. **Conservar este registro; no
reemplazarlo por imports dentro de una expresión condicional o if/return.**

La prueba `test/v2/interface-build.test.ts` construye la aplicación real en
memoria con la minificación de producción activa y examina las dependencias
CSS emitidas. Detecta el problema que las pruebas de imports simulados no
cubrían. Está incluida en las comprobaciones V2 predeterminadas. Usa el parser
que ya exporta Vite; no añade dependencias de paquetes.

Cambios de consulta GM:

- Selección local de un único encuentro guardado cuando hay varios.
- La selección se conserva al recibir actualizaciones y cambia a uno disponible
  si el seleccionado desaparece. Elegir encuentro no modifica la campaña.
- Filas con identidad separada de PG/CA, PG temporales y rótulo de turno guardado.
- Filas adaptadas a panel estrecho y aviso de consulta más breve.
- Tipografía de títulos y del selector explícita para evitar herencia accidental.

Validación de esta iteración: **21 pruebas en cinco archivos** pasaron, incluidas
la regresión sobre el build minificado y la selección de encuentro sin escritura.
También pasaron `npm run typecheck`,
`npm run build:v2 -- --emptyOutDir=false` y `git diff --check`.
No se repitió toda la suite de reglas; su última ejecución completa figura abajo
como referencia histórica. En ese momento faltaba confirmar el resultado en
TaleSpire. Las capturas del pedido actual muestran que el formato ya se aplica;
su revisión estética y la elección de dirección siguen pendientes.

Comando de las pruebas de esta iteración:

```powershell
npx vitest run test/v2/interface-build.test.ts test/v2/interface-shell.test.ts test/v2/interface-startup.test.ts test/v2/interface-views.test.ts test/v2/next-interface.test.ts --maxWorkers=2 --testTimeout=20000
```

### Base de convivencia

Primera entrega implementada: selección local, carga separada de interfaces,
recuperación y piloto de consulta con datos de campaña. Actual sigue por defecto.
No se cambió el esquema de datos ni se migraron campañas.

La elección se aplica en el siguiente arranque/recarga. Cambiar el selector no
cierra editores, no guarda borradores, no desmonta la vista y no recarga la
sesión. El usuario guarda y termina sus operaciones antes de usar el control
Recargar de TaleSpire. Ocultar y mostrar un panel que sigue ejecutándose no
aplica la elección. Esto sustituye, en la primera entrega, al cambio inmediato
con resolución automática de operaciones que se había propuesto inicialmente.

En Nueva, «Volver a la interfaz actual» fuerza el arranque clásico. Es inmediato
porque el piloto no ofrece edición ni operaciones de juego. El mismo acceso
de recuperación queda disponible si falla la carga inicial de una vista.

## Qué está implementado y dónde

| Responsabilidad | Código |
| --- | --- |
| Elegir versión una vez al arrancar y preparar los servicios existentes | `src/main.ts` |
| Preferencia local `interface-version` con valores `classic`/`next`, valor inválido → Actual, override de recuperación `?ui=classic` | `src/ui/interface-preference.ts` |
| Control Interfaz independiente del contenido de la aplicación, persistencia comprobada y recuperación incluso sin almacenamiento | `src/ui/interface-shell.ts` y `.css` |
| Contrato de vistas y carga diferida de una única presentación | `src/ui/interface-views.ts` |
| Construcción de las vistas existentes con su CSS | `src/ui/classic-views.ts` |
| Piloto sin dependencias de escritura, navegación, lectura y actualización de snapshots | `src/ui/next/next-app.ts` |
| Adaptación de servicios existentes al piloto y consultas de estadísticas del GM | `src/ui/next/next-views.ts` |
| Estilos específicos del piloto con tokens compartidos | `src/ui/next/next.css` |
| Ficha compacta real de consulta, iconos oficiales y tooltip local | `src/ui/next/next-sheet.ts`, `next-icons.ts`, `next-tooltips.ts` |
| Proyección de fuentes numéricas sin cambiar el cálculo autoritativo | `projectCharacterStatisticOrigins` en `src/domain/character/character-projection.ts` |

No se modificaron `BrowserApp`, `GmApp`, las reglas de juego, las operaciones
de persistencia ni los contratos de sincronización. El GM en Nueva no ejecuta
el sembrado de contenido ni el arranque de `GmApp` que sincroniza combate.

El piloto permite consultar acciones/conjuros registrados, características,
habilidades, rasgos, inventario y notas del personaje. En GM consulta encuentros
guardados y personajes. Catálogos y herramientas muestran que siguen en Actual.
Conserva la proyección de objetos sin identificar y oculta sus acciones/conjuros
vinculados. No es todavía el diseño final ni una ficha con cobertura completa.

La consulta de combate del piloto GM no controla ni sigue directamente la cola
nativa de TaleSpire; muestra el estado guardado y lo indica en pantalla.

## Cómo probar la entrega

1. Recargar el symbiote construido. Arriba aparece «Interfaz: Actual».
2. Abrir ese control y elegir «Nueva · en pruebas».
3. Guardar el trabajo actual, resolver las operaciones en curso y usar Recargar
   en TaleSpire. La elección solo cambia el cliente/perfil local.
4. Jugador: se abre Ficha. GM: entrar en Personajes. Consultar iconos y tooltips,
   abrir/cerrar condiciones, cambiar personaje y revisar recursos con datos reales.
   En la entrega actual también se pueden probar PX, inspiración, modos d20,
   pruebas de Ficha y salvaciones/curación con 0 PG. Otras acciones siguen en Actual.
5. Usar «Volver a la interfaz actual». Se conservan los datos de campaña.
6. Si Nueva no arranca, usar el control de recuperación independiente. Como
   alternativa técnica, `?ui=classic` fuerza Actual sin depender del almacenamiento.

## Validación de la primera entrega (referencia histórica)

Pruebas nuevas:

- `test/v2/interface-shell.test.ts`: preferencia, valor inválido, aislamiento de
  cliente, borrador intacto al elegir, error de almacenamiento y recuperación.
- `test/v2/interface-views.test.ts`: solo se importa la presentación elegida.
- `test/v2/interface-startup.test.ts`: default clásico, override de recuperación,
  arranque único, GM de consulta sin sembrado y fallo de módulo recuperable.
- `test/v2/next-interface.test.ts`: no escritura al navegar, objetos sin
  identificar, recepción de cambios, carreras de carga, limpieza de suscripciones,
  almacenamiento local de desarrollo y proveedor de estadísticas para el GM.

Resultados completados:

- `npm run typecheck`: pasó.
- Pruebas nuevas de convivencia y piloto: **19/19** pasaron.
- `npm run test:v2 -- --maxWorkers=2 --testTimeout=20000`: **167 archivos,
  1453 pruebas**, todas pasaron (420,52 segundos).
- `npm run build:v2 -- --emptyOutDir=false`: pasó. `dist-v2/v2.html` apunta al
  build nuevo; los assets anteriores se conservan por la opción solicitada.
  Se generan chunks JS y CSS separados para Actual y Nueva. El build informa
  un aviso de tamaño de chunks; no se modificó el límite para ocultarlo.
- `git diff --check`: sin errores de espacios.

La ejecución completa con concurrencia predeterminada se interrumpió tras
fallos por límites de tiempo en pruebas de tutoriales. La repetición completa
con dos workers y timeout de 20 segundos pasó; no se cambió la configuración
permanente de Vitest ni se modificaron esas pruebas del generador.

Revisión visual pendiente: no se pudo capturar el navegador de prueba. El host
de Browser Use no está disponible; Chrome nativo permanece minimizado y el
control del equipo no pudo obtener su estado tras reintentar. El lanzamiento
headless por consola fue rechazado por revisión automática (`blocked by policy`).
No afirmar que el panel fue revisado visualmente ni que se probó con dos clientes
reales de TaleSpire. La revisión de esos escenarios todavía es necesaria.

La página `.tmp/ui-redesign-preview.html` es una fixture local descartable con
datos ficticios para la revisión visual; está fuera del build y de Git.

## Siguiente tarea concreta

**Revisar el bloque compacto dentro de Ficha y la cabecera común en TaleSpire.**
La consulta y la primera capa de funciones compartidas están implementadas;
no volver a copiar el estado ni las reglas sintéticas del HTML.

Orden de trabajo:

1. Leer este estado. Seleccionar Nueva y recargar en TaleSpire. Jugador: Ficha;
   GM: Personajes. Revisar a 320/440/640 px, con nombres largos, temporales,
   condiciones, recursos usados y personajes sin builder. Revisar Inspiración
   con etiqueta/estado, Descanso/Competencia, modos apilados verde/rojo, barra y
   fondo de PG al 100/50/0% y temporales independientes. Verificar iconos, foco,
   tooltip, Escape y desplazamiento. Registrar evidencia visual; la revisión
   automática de DOM no demuestra que la WebView se vea correctamente.
2. Revisar selector/Editar/Más opciones en cada sección de jugador y GM.
   Nivel, PG, identidad y controles hasta Desventaja deben aparecer solo dentro
   de Ficha (Personajes en GM), nunca en la cabecera común ni en Equipo/Turno/Más.
   Revisar los controles de mouse de 26 px, la adaptación táctil de 44 px y los
   valores de identidad sin títulos visibles, con ayuda al enfocar/pasar el mouse;
   guardar color en dos personajes de prueba mediante la interfaz autorizada,
   recargar y comprobar que cada uno conserva el suyo. Verificar identidad,
   nombres largos, cierre del menú con Escape/clic fuera y contraste claro/oscuro.
   Comparar las cifras con Actual usando la misma ficha y sin editar campaña
   desde herramientas de desarrollo. Donde falta procedencia, completar el
   contrato de dominio y sus pruebas; no deducir causas por diferencia. No
   sumar de nuevo bonos de velocidad/CA ya guardados. Conservar CSS aislado y
   repetir la regresión del build minificado ante cambios de carga/estilos.
3. Con otro cliente en Actual, comprobar que su interfaz no cambia y que Nueva
   refleja cambios de PG/condiciones enviados desde Actual. Hacerlo con datos
   de prueba en un entorno autorizado, sin editar `.localstorage/` directamente.
4. Ajustar diseño en `next-sheet.ts`/`next.css` con el feedback del juego y
   mantenerlo consistente con el único HTML canónico. Las revisiones de diseño
   y flujos siguen en ese mismo HTML, sin crear nuevas maquetas por iteración.
   Combate GM conserva su alcance anterior de cola guardada, sin control nativo.
5. Si no está disponible TaleSpire o la captura de navegador, registrar qué
   falta y continuar con escenarios de navegador/datos ficticios. No marcar
   la validación real como completada ni habilitar acciones por esa razón.
6. La primera interacción d20 ya está conectada: comprobar en el juego una
   solicitud por pulsación, inspiración/modo temporal o bloqueado y fallos.
   Después acordar si sigue iniciativa, ataques/conjuros o PG completos.
   Descansos/Recuperación arcana siguen después,
   con comandos compartidos y vistas previas reales según el plan, sin copiar
   la lógica simplificada del prototipo.

El selector con cambio inmediato mientras se edita es una etapa posterior:
requiere inventariar borradores, operaciones y dados pendientes y resolverlos
sin pérdida ni repetición. No basta con añadir `location.reload()` al selector.

## Decisiones que siguen abiertas

- Distribución definitiva, dimensiones reales y dirección visual.
- Tecnología final de componentes: esta base usa TypeScript/DOM existentes;
  no se incorporó ni se eligió un framework nuevo.
- Cobertura de acciones y orden final de migración de jugador/GM.
- Continuidad de historiales de sesión y deshacer al recargar.

Al terminar la próxima iteración, actualizar este estado con los cambios,
comprobaciones, límites y una nueva tarea concreta con pasos de implementación.
