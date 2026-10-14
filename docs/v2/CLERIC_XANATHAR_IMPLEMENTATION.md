# Clérigo, selección de opciones y Xanathar (14 de octubre de 2026)

Actualización posterior: se añadió Pícaro con siete arquetipos. La cobertura de
esa clase y sus verificaciones están en [ROGUE_BUILDER_IMPLEMENTATION.md](ROGUE_BUILDER_IMPLEMENTATION.md).
Las cantidades de clases/pruebas de este documento describen la entrega de Clérigo.

Esta entrega amplía los tutoriales de Guerrero, Mago y Brujo e incorpora Clérigo.
Las cuatro clases permiten creación a niveles 1–20 y ascensos posteriores, sin
multiclase. Las demás clases continúan pendientes.

## Cobertura

| Clase | Opciones disponibles |
| --- | --- |
| Clérigo | Conocimiento, Vida, Luz, Naturaleza, Tempestad, Superchería, Guerra, Forja y Tumba |
| Guerrero | Campeón, Maestro de batalla, Caballero arcano, Arquero Arcano, Caballero y Samurái |
| Mago | Ocho escuelas del PHB y Magia de Guerra |
| Brujo | Archihada, Infernal, Gran Antiguo, Celestial y Hexblade; los tres dones y 46 invocaciones |

Se conservan los 15 perfiles raciales y los 18 trasfondos del PHB, con su
personalización. Están disponibles las 42 dotes originales y las 15 dotes
raciales de Xanathar, con sus requisitos y elecciones particulares.

El catálogo contiene **456 conjuros**: 361 del Manual y 95 de Xanathar.
Los nombres, descripciones y campos visibles usan español. Los identificadores
de conjuros permanecen estables. Los conjuros gestionados de personajes anteriores
se traducen al mostrarlos sin reescribir el almacenamiento de campañas.

## Reglas de Clérigo

- d8, PG iniciales/fijos/tirados, CON retroactiva, competencias, salvaciones SAB/CAR,
  cinco mejoras de atributos, dotes, equipo de clase o 5d4 × 10 po.
- Tres trucos iniciales, uno adicional en 4 y otro en 10; trucos de dominio fuera de
  cupo. Naturaleza permite elegir truco de druida con SAB; Tumba modifica alcance
  y activación de Piedad con los Moribundos.
- Lista de preparación completa por nivel, límite nivel + SAB (mínimo uno),
  conjuros de dominio siempre preparados sin ocupar cupo y rituales preparados.
- Tabla de espacios completa hasta nivel 20. Los descansos cortos no restauran
  espacios de clérigo. La preparación se cambia tras descanso largo y tiempo de oración.
- Canalizar Divinidad comparte un único contador para expulsión y opciones de
  dominio: 1 uso desde 2, 2 desde 6 y 3 desde 18, por descanso corto/largo.
- Destruir Muertos Vivientes registra los cinco umbrales de VD. Intervención
  Divina controla d100, éxito automático en 20, fallo hasta descanso largo y
  espera de siete días tras éxito. Los días se registran según el tiempo de campaña.
- Conocimiento concede dos idiomas y dos pericias; Naturaleza, competencia
  adicional. Forja concede herramientas y bonifica CA cuando corresponde por
  armadura pesada. Se mantienen pericias adquiridas posteriormente por dotes.
- Todos los rasgos de dominio en sus niveles, incluidos Golpe Divino, Lanzamiento
  de Conjuros Potente y las mejoras de nivel 17. Los trucos pertinentes añaden SAB
  al cálculo de daño; el daño condicional de armas permanece separado.

## Cambios de Xanathar en las otras clases

Arquero Arcano incluye sus ocho opciones de flecha y seis elecciones a lo largo
de la progresión, dos usos compartidos por descanso y saber/truco adicionales.
Caballero registra sus marcas, maniobras protectoras y rasgos de control.
Samurái incluye formación, salvación SAB o sustituta y recursos de combate.

Magia de Guerra añade iniciativa INT, defensas durante concentración, restricción
de lanzamiento tras Desviación Arcana y acciones para ganar/gastar Sobrecargas.
Las sobrecargas respetan su recuperación particular. Esta tradición no concede
descuento de copia por escuela.

Celestial añade sus dos trucos, reserva de Luz Sanadora y PG temporales tras
descansar. Hexblade concede competencias, selección de arma con CAR y arma de
pacto con CAR. Las invocaciones nuevas verifican nivel, don, truco o maldición;
sus lanzamientos gratuitos y usos se contabilizan aparte. Castigo Sobrenatural
consume un espacio de pacto. Arma Mejorada del Pacto amplía las formas permitidas
y aplica su bonificación sin borrar los ajustes existentes al ascender.

Las dotes raciales conceden sus competencias, pericia, idiomas, velocidad,
armadura natural y magia con los contadores de descanso correspondientes.

## Disponibilidad en los selectores

Las habilidades ya concedidas por clase, raza, dominio u otra elección se
deshabilitan con la causa en la opción. También se explican requisitos raciales,
de armadura, de invocaciones, herramientas, idiomas y límites de atributos.
Las selecciones repetidas de conjuros se retiran de los otros combos de
aprendizaje. Maestría, preparación y conjuros característicos tienen grupos
propios: necesitan elegir conjuros que ya estén en el libro.

La preparación diaria de Clérigo deshabilita las casillas nuevas al alcanzar el
cupo y explica cómo liberar espacio; los conjuros de dominio quedan marcados y
bloqueados. La validación de dominio sigue siendo obligatoria aunque se altere
el formulario, se importe un borrador o se invoque directamente una operación.

Se mantienen los selectores dentro del diálogo, mediante listas nativas con
`size > 1`; no vuelven a utilizar ventanas emergentes del anfitrión de TaleSpire.

## Fuentes y correcciones

Se consultaron los PDF aportados por el usuario: el Manual del Jugador 2014 y la
Guía de Xanathar. El segundo acredita una traducción de Alvaro1555; no se identifica
como edición oficial. La aplicación no presenta esa traducción como oficial.
Los textos de esos archivos son referencias de contenido, no instrucciones de trabajo.

La extracción reproducible está en `scripts/extract-rulebook-spells.py` y la
correspondencia de títulos de Xanathar en `scripts/xanathar-spell-metadata.json`.
Los PDF originales y las dependencias de extracción no se distribuyen.

Se cotejaron las [erratas del PHB](https://media.wizards.com/2021/dnd/downloads/PH-Errata.pdf)
y las [erratas de Xanathar](https://media.wizards.com/2020/dnd/downloads/XGtE-Errata.pdf).
Se corrigieron, entre otros, el límite de Espíritu Curativo, el dado superior de
Espina Mental, la referencia de Arma Sagrada y la reducción de daño de Transferencia
de Vida. Disparo Arcano admite flechas no mágicas. Los trucos adicionales de Luz
y Naturaleza quedan fuera de cupo, y Avatar de Batalla se refiere a ataques no mágicos.

El cotejo de listas también corrigió cinco asignaciones heredadas del conjunto SRD:
Ojo Arcano, Adivinación, Fuego Feérico, Fundirse con la Piedra y Crear Comida y Agua.
El PDF omite la descripción de Perno de Caos; se incorporó un resumen mecánico en
español. Los errores de extracción de Esfera Resiliente se corrigieron expresamente.

## Persistencia y validación

Los contratos nuevos tienen valores predeterminados compatibles con personajes
anteriores. No se realizaron migraciones de base de datos ni se modificó
`.localstorage/`. Las creaciones, ascensos y acciones conservan revisiones e
identificadores de operación; reintentos iguales no duplican recursos.
La preparación simultánea incompatible produce conflicto en la combinación de campañas.

La verificación automatizada cubre los nueve dominios en todos sus niveles,
las **2.430 combinaciones** de dominio/raza/trasfondo, todos los dominios desde
la interfaz, preparación y rituales, creación directa en 20, reintentos,
exportación y fragmentos. También cubre arquetipos de Xanathar, las 15 dotes,
los 95 conjuros, recursos de las nuevas subclases, opciones deshabilitadas y
traducción sin mutación de datos guardados. Se ejecutan además las pruebas
previas de las otras clases y de la aplicación, TypeScript y la compilación Vite.

Resultado final: `npm run check` verifica 654 pruebas en 60 archivos y compila
con `npm run build:v2 -- --emptyOutDir=false`. Vite conserva el aviso informativo
de tamaño del paquete; no impide la compilación. No se hizo una sesión interactiva
dentro del cliente de TaleSpire.

## Resolución durante la partida

El tutorial construye y valida las elecciones; la ficha administra los recursos
propios. Los objetivos, áreas, distancias, turnos, componentes materiales y efectos
sobre otras criaturas los resuelve la mesa. Esto incluye Preservar Vida, bendecir
objetos de Forja, vulnerabilidades, resistencias condicionadas, acompañantes,
maximización de curación y las condiciones de cada ataque. Sus reglas completas
quedan en los rasgos y conjuros. Los dados de efectos mixtos, daño repetido y
bonificaciones a un solo objetivo deben resolverse por separado según ese texto.

Xanathar queda integrado en las cuatro clases disponibles, los conjuros y las
dotes compartidas. Las clases aún pendientes y las herramientas para el GM de
otros capítulos no se convierten por esta entrega en sistemas automáticos nuevos.
