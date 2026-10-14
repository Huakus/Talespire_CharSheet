# Mago del Manual del Jugador 2014: implementación y auditoría

> Estado ampliado al 14/10/2026: Clérigo y opciones de Xanathar para las cuatro
> clases disponibles. La cobertura actual y las correcciones posteriores se documentan en
> [Clérigo y Xanathar](CLERIC_XANATHAR_IMPLEMENTATION.md). Los recuentos PHB de esta
> entrega anterior describen su alcance original.

Fecha: 14 de octubre de 2026. Cobertura: Mago de una sola clase, niveles 1–20,
las ocho escuelas originales, quince opciones raciales, dieciocho perfiles de
trasfondo y las cuarenta y dos dotes opcionales del PHB. Se aplican las erratas de
2014; no se incluyen multiclase, suplementos ni reglas de 2024.

## Uso

En Administrar personajes, abrir **Crear con tutorial**, elegir **Mago** y el
nivel inicial. El recorrido incluye origen, atributos, formación, tres trucos,
seis conjuros de nivel 1, equipo, decisiones de cada nivel y revisión final.
La creación por encima de nivel 1 recorre todos los niveles intermedios antes
de incorporar una única ficha completa. **Guardar y cerrar** conserva el
borrador local; **Subir de nivel con tutorial** adquiere un nivel adicional.

En la ficha, abrir **Libro y recursos de Mago**, dentro de conjuros. Allí se
administran preparación, libros, copias, Recuperación arcana y recursos propios
de cada escuela. El selector de lanzamiento distingue espacios ordinarios,
ritual, Maestría, característicos y Cambiaformas cuando corresponde.

## Clase, origen y equipo

| Área | Reglas incorporadas |
| --- | --- |
| PG y dados | 6 + CON en nivel 1; después 4 o resultado de d6, más CON y mínimo uno por nivel. Los cambios de CON recalculan todos los niveles. Duro y enano de colinas se incorporan al máximo. |
| Competencias | Salvaciones INT/SAB; dos habilidades entre Arcano, Historia, Perspicacia, Investigación, Medicina y Religión; daga, dardo, honda, bastón y ballesta ligera. No concede armaduras ni herramientas. Se añaden competencias raciales y de dotes. |
| Atributos | Matriz, compra por puntos o tiradas; aumentos raciales de 2014 y opciones de humano variante/semielfo. ASI o dote en 4, 8, 12, 16 y 19; se validan requisitos de armadura, atributo y magia. |
| Origen | Las mismas quince opciones raciales y dieciocho perfiles de trasfondo del generador de Guerrero, con personalización, resolución de competencias duplicadas y personalidad. |
| Paquete | Daga o bastón; bolsa de componentes o uno de los cinco focos arcanos; paquete de erudito o explorador; libro de conjuros; equipo de trasfondo y sus alternativas. El libro de saber del paquete de erudito es distinto del libro de conjuros. |
| Oro | Alternativa de 4d4 × 10 po, sustituyendo ambos paquetes y el dinero del trasfondo. Compras con presupuesto y cantidades. Si no se compra libro, la revisión informa que no está disponible para preparar ni realizar rituales de clase. |

El foco no reemplaza componentes consumidos ni materiales con precio indicado.
Armadura o escudo sin competencia impiden lanzar. Los aumentos y las dotes no
conceden equipo gratuito ni restauran usos, espacios o PG actuales al ascender.

## Conjuros, preparación y libros

La lista incluye exactamente 215 conjuros del PHB, sin añadidos de suplementos:

| Nivel de conjuro | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Entradas | 16 | 30 | 34 | 29 | 23 | 23 | 20 | 15 | 13 | 12 |

- Tres trucos iniciales; uno adicional en Mago 4 y otro en 10. Los trucos no se
  sustituyen al ascender en las reglas del PHB 2014.
- Seis conjuros iniciales de nivel 1; dos incorporaciones gratuitas por nivel
  posterior, de cualquier escuela y hasta el nivel permitido por los espacios.
  Se rechazan duplicados, cupos incorrectos y conjuros ajenos a la lista.
- Progresión completa de espacios de lanzador hasta nivel 9. CD y ataque usan
  INT; los conjuros raciales y de dotes conservan su atributo y recursos propios.
- Lista diaria de hasta nivel de Mago + modificador INT, mínimo uno; solo conjuros
  del libro disponible. Inicialmente se propone una lista válida. Cambiarla exige
  descanso largo y estudio de al menos un minuto por nivel de cada conjuro.
- Un ritual del libro no requiere preparación ni espacio; añade diez minutos
  al lanzamiento. Los rituales y lanzamientos largos necesitan concentración
  mientras se realizan. El tablero, el tiempo y los componentes los controla la mesa.
- Copia de texto ajeno: 50 po y dos horas por nivel. Notación propia o reconstrucción
  de preparados: 10 po y una hora por nivel. Erudito reduce ambos a la mitad para
  su escuela. Se descuentan monedas y se registra la operación; la interfaz informa
  el tiempo. La prueba y destrucción de pergaminos se resuelven con el GM.
- Pérdida del libro: se conservan preparados y trucos; no se pueden cambiar preparados
  ni realizar rituales del libro perdido. Reconstrucción solo desde preparados;
  los demás necesitan una fuente accesible. Comprar libro vacío cuesta 50 po.
- Respaldos con contenidos y disponibilidad independientes. Es posible crear,
  perder, recuperar y activar copias. Los ascensos no restituyen conjuros ausentes
  de un libro reconstruido. Iniciado en magia de Mago permite añadir su conjuro
  de nivel 1 al libro y prepararlo, conservando separado el uso diario de la dote.

Recuperación arcana permite recuperar después de un descanso corto espacios
gastados cuyo total no supere la mitad del nivel, redondeada arriba; ningún
espacio puede ser de nivel 6 o superior. El contador se usa una vez por día y
se restaura con el descanso largo de la ficha, no con cada descanso corto.

Mago 18 elige Maestría de un conjuro del libro de nivel 1 y otro de nivel 2:
preparados, se lanzan a nivel base sin espacio. Ocho horas permiten cambiar las
elecciones. Mago 20 elige dos conjuros distintos de nivel 3: siempre preparados,
sin ocupar cupo, cada uno con un uso sin espacio por descanso corto/largo.
Ambos beneficios permiten seguir usando espacios ordinarios para elevar el nivel.

## Ocho escuelas y todos sus hitos

Todas se eligen en Mago 2 y conceden Erudito de su escuela, además de estos rasgos:

| Escuela | Nivel 2 | Nivel 6 | Nivel 10 | Nivel 14 |
| --- | --- | --- | --- | --- |
| Abjuración | Guardián arcano | Guardián proyectado | Abjuración mejorada | Resistencia a conjuros |
| Conjuración | Conjuración menor | Transposición benigna | Conjuración concentrada | Invocaciones duraderas |
| Adivinación | Portento | Adivinación experta | Tercer ojo | Portento superior |
| Encantamiento | Mirada hipnótica | Encanto instintivo | Encantamiento dividido | Alterar recuerdos |
| Evocación | Esculpir conjuros | Truco potente | Evocación potenciada | Sobrecanalizar |
| Ilusión | Ilusión menor mejorada | Ilusiones maleables | Yo ilusorio | Realidad ilusoria |
| Nigromancia | Cosecha siniestra | Esbirros muertos vivientes | Habituado a la muerte | Controlar muertos vivientes |
| Transmutación | Alquimia menor | Piedra del transmutador | Cambiaformas | Maestro transmutador |

Cada rasgo incluye su descripción y restricciones en la ficha. Además:

- **Abjuración:** creación, PG separados y recarga del guardián al lanzar
  abjuraciones de nivel 1+, incluidos rituales; daño propio/proyectado y caducidad
  al descansar largo. El daño introducido es anterior a las resistencias del
  objetivo; el excedente se aplica por separado a ese objetivo.
- **Conjuración:** contador de Transposición benigna y recuperación por conjuración
  de nivel 1+ o descanso largo. La concentración de conjuración desde nivel 10
  no exige prueba por daño, pero sí puede terminar por otras causas.
- **Adivinación:** dos Portentos, tres desde nivel 14; registro y gasto individual,
  descarte al descansar largo. Adivinación experta recupera un espacio gastado
  inferior al lanzamiento, hasta nivel 5, solo cuando se gastó un espacio en
  adivinación de nivel 2+. Tercer ojo elige beneficio, consume su uso y termina
  al descansar o quedar incapacitado.
- **Evocación:** suma de INT a una tirada de daño de evocación de Mago desde 10;
  Sobrecanalizar maximiza la expresión admitida y cuenta repeticiones desde el
  descanso largo. El daño necrótico propio posterior se informa y se resuelve en
  mesa, sin resistencia ni inmunidad. Esculpir y Truco potente se aplican al objetivo.
- **Ilusión:** Minor Illusion adicional o sustituto si ya se conoce, incluyendo
  origen racial/dote; permite sonido e imagen. Yo ilusorio lleva contador por
  descanso corto/largo. Realidad ilusoria conserva su límite de un objeto por conjuro.
- **Nigromancia:** Animate Dead se incorpora gratis en 6 si falta; los bonos a
  muertos vivientes, la curación condicional y el control se describen para
  aplicarlos a sus criaturas. No se generan fichas de esbirros automáticamente.
- **Transmutación:** piedra con creación de ocho horas, beneficio, portador,
  transferencia y cambio tras lanzar transmutación de nivel 1+. Competencia CON y
  velocidad se calculan para el portador propio; resistencias/percepción se
  describen. Polymorph gratis en 10 si falta; Cambiaformas requiere prepararlo,
  solo afecta al propio mago como bestia VD ≤1, y tiene uso por descanso corto/largo.
  Maestro transmutador consume la piedra para una de sus cuatro opciones; impide
  recrearla hasta descansar largo. Restaurar vida conserva los demás requisitos
  de Raise Dead, incluido el diamante consumido de 500 po y el límite de diez días.

## Persistencia y compatibilidad

`guided-character-builder.ts` dirige creación/ascenso hacia Guerrero o Mago. El
historial compartido conserva `classKey`, origen y elecciones por nivel. Los tipos
`FighterCreation` y `FighterLevelChoice` retienen su nombre por compatibilidad con
los consumidores existentes; sus validaciones separan ambas clases.

`spellcasting.wizard` contiene libro activo, disponibilidad, respaldos, copias,
Maestría, Portentos, guardián, piedra, Tercer ojo, Sobrecanalizar e identificadores
estables de recursos. Se serializa en el fragmento de recursos existente y en las
exportaciones. No hay migración SQL ni modificación de campañas guardadas.

Las acciones verifican revisión y tienen identificador para evitar doble gasto
al reintentar. Las preparaciones concurrentes incompatibles generan conflicto;
un cambio independiente de PG puede fusionarse. El ascenso conserva monedas,
libros, preparados y recursos gastados. Los participantes deben usar esta versión
para leer historiales de Mago; no se agregó negociación de capacidades con clientes
antiguos. Los datos anteriores siguen aceptándose con valores predeterminados.

## Auditoría y límites de automatización

La revisión incluye pruebas de las 270 combinaciones de raza/trasfondo; las ocho
escuelas por todos los niveles, con comprobación independiente de sus 32 hitos;
las 42 dotes; el inventario de 215 conjuros; elecciones inválidas; libros perdidos,
copias y respaldos; preparación/rituales; recuperación y descansos; recursos de
escuela; Maestría/característicos; creación UI de las ocho escuelas, ascenso,
persistencia, exportación, reintentos y conflictos de preparación.

Las pruebas están en `phb-wizard-builder.test.ts`, `phb-wizard-ui.test.ts` y
`phb-wizard-persistence.test.ts`. Se ejecutan junto con la regresión de Guerrero
y el resto del proyecto; se verifica TypeScript y la compilación Vite.

Resultado final: `npm run typecheck` correcto; `npm test`, **459 pruebas en
51 archivos**, todas correctas (87 pruebas específicas de Mago). Compilación
con `npm run build:v2 -- --emptyOutDir=false`, conservando archivos de salida
anteriores que TaleSpire pudiera tener abiertos.

Corrección de interacción: los campos de texto y números guardan sus cambios
sin reconstruir el formulario al perder el foco. Esto evita cerrar el siguiente
desplegable al abrirlo. Atributos, presupuesto y navegación se actualizan en sus
propios elementos; las selecciones siguen reconstruyendo sus campos dependientes.
Tres pruebas adicionales cubren foco y persistencia de borrador, navegación y
totales numéricos, y presupuesto sin reemplazar el desplegable activo.

Corrección de superposición en el WebView: todos los selectores del tutorial
usan un botón y una lista HTML de tamaño mayor que uno, dentro del propio diálogo.
Así se evita la ventana emergente nativa del host que podía aparecer detrás del
tutorial y quedar abierta al cerrarlo. Se mantiene el `select` original para
valores, opciones, formularios y validación. La lista permite clic, flechas,
búsqueda por texto, Enter, Escape y Tab; se cierra al cambiar de campo, reconstruir
el paso o cerrar el tutorial. Seis pruebas del control y una de cierre/reapertura
del tutorial cubren el comportamiento. La verificación dentro de TaleSpire sigue
pendiente; estas comprobaciones son de DOM.

Esto cubre creación, ascenso y administración de ficha. Los efectos sobre otros
objetivos, resistencia/inmunidad, componentes, tiempos de actividad, concentración
durante el tiempo de lanzamiento, criaturas invocadas/familiares, límites por
turno y condiciones particulares se resuelven con los controles y el texto de
reglas en la mesa. Una expresión de dados no ejecuta todos los efectos del conjuro.
La prueba visual dentro del TaleSpire abierto queda pendiente; la interfaz se
verificó mediante pruebas DOM, sin modificar `.localstorage/` del usuario.

## Fuentes contrastadas

- [Mago Legacy 2014](https://www.dndbeyond.com/classes/8-wizard).
- [SRD 5.1, CC BY 4.0](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf).
- [Erratas del PHB](https://media.wizards.com/2021/dnd/downloads/PH-Errata.pdf).
- [Sage Advice Compendium de 2014](https://www.dndbeyond.com/sources/dnd/sac/sage-advice-compendium):
  Cambiaformas preparado; interacción del guardián con daño/rituales; Iniciado en
  magia de Mago; Realidad ilusoria y concentración de lanzamientos largos.
- [Raise Dead de 2014](https://www.dndbeyond.com/spells/2224-raise-dead).
- [Datos SRD de 2014](https://github.com/5e-bits/5e-database/tree/main/src/2014/en)
  y [atribución distribuida](PHB_2014_CONTENT_NOTICE.md).

El texto de las escuelas fuera del SRD se cotejó también con las transcripciones
PHB de [Abjuración](https://dnd5e.wikidot.com/wizard:abjuration),
[Conjuración](https://dnd5e.wikidot.com/wizard:conjuration),
[Adivinación](https://dnd5e.wikidot.com/wizard:divination),
[Encantamiento](https://dnd5e.wikidot.com/wizard:enchantment),
[Evocación](https://dnd5e.wikidot.com/wizard:evocation),
[Ilusión](https://dnd5e.wikidot.com/wizard:illusion),
[Nigromancia](https://dnd5e.wikidot.com/wizard:necromancy) y
[Transmutación](https://dnd5e.wikidot.com/wizard:transmutation).
