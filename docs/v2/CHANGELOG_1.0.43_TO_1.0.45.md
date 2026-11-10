# Changelog acumulado: 1.0.43 → 1.0.45

Versión definitiva: **1.0.45** · 9 de noviembre de 2026.

Este documento reúne los cambios posteriores a la publicación de la 1.0.43,
incluidos los incorporados en la 1.0.44. La referencia inicial es el commit
`e14a223`, que publicó la 1.0.43; no se toma como base el commit posterior
`f34eaac`, que todavía conservaba ese mismo número de versión.

## Objetos e identificación

- El GM puede identificar objetos y definir el nombre y la apariencia que ve
  el jugador antes de identificarlos.
- Los objetos sin identificar ocultan su identidad real, descripción interna,
  propiedades, bonos, rasgos, cargas y capacidades asociadas en las vistas de
  jugador. Sus acciones y conjuros vinculados tampoco se presentan como utilizables.
- Se bloquea su uso, equipamiento, sintonización y gasto de cargas hasta que
  estén identificados. Las ediciones y transferencias conservan ese estado.
- Las copias identificadas y sin identificar no se apilan como si fueran iguales.
  Los objetos anteriores que no tenían este campo conservan su disponibilidad.

## Comerciantes e invocaciones de brujo

- El saqueo de comerciantes usa transferencias atómicas con validación de
  permisos y revisiones, para evitar entregas parciales o duplicadas.
- Cuando la compraventa está deshabilitada, la interfaz muestra las operaciones
  que siguen disponibles y oculta la revisión de compra/venta que no corresponde.
- Se mejora la búsqueda de Descarga agonizante y la indicación de invocaciones
  sustituidas en el constructor y la consulta de progresión del brujo.

## Elección de interfaz

- Se añade el selector entre **Actual** y **Nueva**. Actual sigue siendo la
  opción predeterminada; Nueva es un piloto voluntario.
- La elección es local y se aplica al recargar el symbiote. No cambia la
  interfaz elegida por los demás jugadores.
- Nueva ofrece regreso directo a Actual y recuperación si falla la carga.
- Cada interfaz carga sus propios estilos y módulos. Se corrigió la mezcla
  de CSS que aparecía en builds minificados.

## Ficha compacta de Nueva

- La cabecera común conserva selector de personaje, Editar y Más opciones.
  El color elegido para cada personaje identifica su selector y nombre y se
  guarda mediante el editor compartido existente.
- Dentro de Ficha se reúne el bloque de nivel, PG, CA, iniciativa y velocidad,
  junto con identidad y controles. No se repite este bloque en otras vistas.
- La identidad presenta los valores registrados de raza/subraza, clase/subclase,
  trasfondo y alineación sin títulos ni etiquetas permanentes. Los nombres de
  campo siguen disponibles en ayudas accesibles. Jugador se consulta en Más opciones.
- Inspiración muestra nombre y estado. Descanso y Competencia conservan texto
  visible. Los controles usan 26 px para mouse y 44 px en superficies táctiles.
- Ventaja y Desventaja aparecen apiladas, con texto y resaltado verde y rojo,
  respectivamente, y candados para conservar el modo tras una tirada.
- Los PG incorporan barra y resaltado que pasan de verde a rojo según la
  proporción restante; los PG temporales se muestran por separado.
- Se incluyen 97 iconos SVG oficiales locales y tooltips sin dependencias del
  visor de conversación. Las ayudas numéricas explican fuentes y aportes;
  los orígenes incompletos se indican sin inventar causas.
- Se consultan condiciones, atributos, salvaciones, habilidades, pasivas,
  recursos, espacios de conjuro, competencias, idiomas, rasgos, equipo y notas.
  El GM también puede consultar personajes y el combate guardado.

## Funciones compartidas de juego

- Nueva permite agregar experiencia y abrir la subida guiada cuando corresponde,
  sin adelantar niveles automáticamente.
- Se conectan los tres estados de inspiración y las tiradas de habilidades,
  características y salvaciones. Los modos temporales se consumen tras aceptar
  la solicitud de dados; los bloqueados se conservan durante la sesión.
- A 0 PG se permiten salvaciones de muerte y curación, con bloqueo de las demás
  operaciones de personaje. **El tercer éxito recupera 1 PG y limpia los
  contadores en una sola operación**, tanto en Actual como en Nueva.
- Se conservan los controles de revisión y checksum, el bloqueo de doble envío
  y la gestión de errores sin repetir automáticamente dados o comandos.

## Distribución y estado del repositorio

- El ZIP incluye el código vigente completo, Actual, Nueva, el asistente,
  sus módulos y estilos diferidos y la licencia de los SVG.
- El empaquetador conserva las rutas de importación originales, valida las
  entradas del ZIP y mantiene el canal público de comunicación de TaleSpire.
- Los assets de compilaciones anteriores pueden permanecer en disco porque
  TaleSpire puede tenerlos abiertos. Git ignora los que no están versionados;
  cada entrega incorpora explícitamente los assets del manifest vigente.
- La 1.0.45 consolida la distribución y la documentación. No introduce cambios
  adicionales en la lógica de juego respecto de la 1.0.44.

## Alcance y validación

La edición general, ataques, lanzamiento de conjuros, descansos y gestión de
condiciones/recursos continúan en Actual. Nueva conserva las funciones del piloto
descritas arriba; no equivale todavía a una migración completa de toda la interfaz.

La regresión completa de la misma lógica de aplicación en la 1.0.44 pasó con
**1501 pruebas correctas y 3 omitidas en 175 archivos**. Las comprobaciones
repetidas para esta distribución y el SHA256 del ZIP se registran en
[validación 1.0.45](release-1.0.45-validation.json).

Sigue pendiente la inspección visual dentro de TaleSpire y la prueba con dos
clientes reales. Los datos de campaña en `.localstorage/` no se modifican al
preparar esta distribución; tampoco se trabaja sobre el respaldo Toolset.

[Historial completo de cambios del código](https://github.com/Huakus/Talespire_CharSheet/compare/e14a223fce4c15c07f93d3d1c5883fe1f6cd5b25...v1.0.45).
