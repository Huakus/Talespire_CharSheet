# Matriz de elecciones: Manual del Jugador 2014

> Estado actual al 14/10/2026: seis clases con Manual 2014 y Xanathar.
> Se incorporaron [Pícaro](ROGUE_BUILDER_IMPLEMENTATION.md) y
> [Bárbaro](BARBARIAN_BUILDER_IMPLEMENTATION.md), además de Guerrero, Mago,
> Brujo y [Clérigo](CLERIC_XANATHAR_IMPLEMENTATION.md). Los recuentos y pendientes
> del cuerpo de este documento describen su entrega histórica.

Fecha: 12 de octubre de 2026. Estado: inventario de planificación.
Complementa [la propuesta de arquitectura](CHARACTER_BUILDER_ARCHITECTURE.md).
No es un catálogo ejecutable ni una implementación del generador.

Actualización de implementación, 13 de octubre de 2026: el tutorial ya cubre
Guerrero con sus tres arquetipos 1–20, las quince opciones raciales, los dieciocho
perfiles de trasfondo y las cuarenta y dos dotes del PHB. Los estados R/G/P de este
inventario describen la investigación original; la cobertura ejecutable vigente
se documenta en [implementación](CHARACTER_BUILDER_IMPLEMENTATION.md) y
[auditoría](CHARACTER_BUILDER_RULES_AUDIT.md). El 14 de octubre se incorporó
[Mago completo 1–20 con las ocho escuelas del PHB](WIZARD_BUILDER_IMPLEMENTATION.md).
También se incorporó [Brujo 1–20, tres patrones y tres dones](WARLOCK_BUILDER_IMPLEMENTATION.md).
Las otras nueve clases siguen pendientes.

## 1. Alcance y evidencia

Inventario de las **12 clases y 40 subclases** del Manual del Jugador 2014,
con disparadores por nivel y requisitos para el modelo de datos. Incluye
la progresión ordinaria 1–20 y reglas opcionales configurables por el GM.
Los nombres españoles son etiquetas de trabajo; las referencias canónicas
también conservan los nombres ingleses para evitar ambigüedad de traducción.

Las páginas públicas de clases de D&D Beyond, marcadas Legacy, permiten
consultar la base y una parte de las subclases. Las páginas del manual
consultadas sin una sesión con acceso al libro redirigen a la tienda.
Se utilizaron también artículos oficiales anteriores a la revisión de 2024.
Los comentarios de usuarios, los playtests y las recomendaciones de reglas
caseras de esos artículos no se usaron como reglas del manual.

Estado de evidencia en el inventario de subclases:

- **R:** se consultó texto de reglas público de 2014 para sus hitos/elecciones.
- **G:** guía oficial de la opción; estructura corroborada, parámetros completos pendientes.
- **P:** opción inventariada; sus elecciones/concesiones exactas necesitan cotejo directo.

Ninguno de esos estados significa que una definición esté cargada, implementada
o probada. Incluso una fila R necesita comprobar todos sus efectos y referencias
antes de publicar el paquete. Una fila G o P no habilita a inventar parámetros.

El [índice oficial del manual](https://www.dndbeyond.com/sources/dnd/phb-2014)
fija la fuente; la base pública no sustituye el inventario del manual completo.

## 2. Tres momentos diferentes

| Tipo | Ejemplo | Qué conserva el sistema |
| --- | --- | --- |
| Elección de construcción | Subclase, competencia, conjuro conocido, dote | Decisión con origen, nivel y versión de regla |
| Concesión automática | Rasgo, nuevo máximo de recurso, conjuro de dominio | Concesión calculada con identidad estable |
| Decisión de juego | Preparar conjuros, forma animal, objetivo, resistencia al descansar | Estado de juego; no un nuevo nivel del historial |

Una sustitución es una operación sobre una elección previa, con presupuesto y
momento permitido. No equivale a volver a elegir libremente toda una categoría.
Una opción aprendida puede abrir elecciones propias: pacto → invocación → rituales.

El tutorial inicial puede pedir una configuración de juego útil, como preparar
conjuros, pero debe guardarla fuera de las decisiones permanentes de construcción.

## 3. Reglas comunes del ascenso

Cada ascenso tiene dos coordenadas: **nivel total del personaje** y **nivel de
la clase que se adquiere**. Los disparadores de las tablas siguientes usan el
nivel de clase, salvo que se indique lo contrario.

En cada nivel: registrar clase adquirida, adquisición de PG, nuevo dado de golpe,
concesiones, cuotas de elecciones, sustituciones permitidas y cambios de máximos.
El motor compara cantidades del nivel previo y nuevo, no suma otra vez el total.

El primer nivel del personaje tiene un tratamiento de PG y competencias distinto
del primer nivel de una clase adicional. La competencia usa el nivel total.
Los requisitos de multiclase se comprueban sobre las clases involucradas.
Conjuros conocidos/preparados se resuelven por clase; tener espacios superiores
no permite aprender automáticamente conjuros de ese nivel. Rasgos coincidentes
como Ataque Extra necesitan reglas de combinación explícitas, no suma genérica.
Fuente: [personalización de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options).

La mejora de atributos ofrece distribución +2 o +1/+1; su alternativa de dote
depende de la campaña. Las mejoras ordinarias no superan 20. La Constitución
puede cambiar los PG máximos de niveles anteriores. Fuente:
[creación y avance de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters).

## 4. Calendario estructural de las clases

`ASI` = mejora de atributos o dote si está habilitada. `SC` = elección de subclase.
Los hitos de subclase son momentos de concesión; no todos abren una pregunta.
La cantidad de habilidades indicada corresponde a elegir esa clase al crear
el personaje, antes de raza y trasfondo. Las listas elegibles se cargan por clase.

| Clase / clave | Dado | Habilidades iniciales | SC | Hitos de subclase | ASI | Fuente |
| --- | --- | --- | --- | --- | --- | --- |
| Bárbaro / `barbarian` | d12 | 2 | 3 | 3, 6, 10, 14 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/9-barbarian) |
| Bardo / `bard` | d8 | 3 | 3 | 3, 6, 14 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/1-bard) |
| Clérigo / `cleric` | d8 | 2 | 1 | 1, 2, 6, 8, 17 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/2-cleric) |
| Druida / `druid` | d8 | 2 | 2 | 2, 6, 10, 14 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/3-druid) |
| Guerrero / `fighter` | d10 | 2 | 3 | 3, 7, 10, 15, 18 | 4, 6, 8, 12, 14, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/10-fighter) |
| Monje / `monk` | d8 | 2 | 3 | 3, 6, 11, 17 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/11-monk) |
| Paladín / `paladin` | d10 | 2 | 3 | 3, 7, 15, 20 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/4-paladin) |
| Explorador / `ranger` | d10 | 3 | 3 | 3, 7, 11, 15 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/5-ranger) |
| Pícaro / `rogue` | d8 | 4 | 3 | 3, 9, 13, 17 | 4, 8, 10, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/12-rogue) |
| Hechicero / `sorcerer` | d6 | 2 | 1 | 1, 6, 14, 18 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/6-sorcerer) |
| Brujo / `warlock` | d8 | 2 | 1 | 1, 6, 10, 14 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/7-warlock) |
| Mago / `wizard` | d6 | 2 | 2 | 2, 6, 10, 14 | 4, 8, 12, 16, 19 | [Reglas](https://www.dndbeyond.com/classes/8-wizard) |

Además del calendario: cada clase necesita sus competencias fijas, alternativas
de equipo, salvaciones iniciales, lista de habilidades y concesiones de multiclase.
Esos datos no deben inferirse a partir de la cantidad de habilidades de esta tabla.

## 5. Elecciones de clase adicionales

Se suman al calendario anterior, a la magia y a las elecciones de subclase.
Las referencias de reglas para estas filas son las de cada clase en la tabla 4.

| Clase | Disparadores de elecciones | Comportamiento necesario del modelo |
| --- | --- | --- |
| Bárbaro | Sin otro selector permanente de clase aparte de creación, SC y ASI | Furia y sus escalas son concesiones/recursos, no elecciones |
| Bardo | 1: tres instrumentos; 3 y 10: dos pericias; 10, 14 y 18: dos Secretos Mágicos | Pericia exige competencia previa; secretos usan listas ampliadas y cuentan dentro del total ordinario de conocidos |
| Clérigo | Dominio en 1; elecciones adicionales según dominio | Preparación diaria separada; conjuros de dominio concedidos automáticamente |
| Druida | Círculo en 2; elecciones adicionales según círculo | Formas conocidas/vistas y preparación se gestionan en juego |
| Guerrero | 1: estilo de combate | Catálogo de estilos elegibles; no repetir el mismo estilo al obtener otra elección |
| Monje | 1: una herramienta de artesano o instrumento | Selección alternativa entre categorías; ki con capacidad y gasto separados |
| Paladín | 2: estilo de combate | Lista propia de estilos; magia y juramento se añaden cuando corresponden |
| Explorador | 1, 6 y 14: enemigo y lengua asociada cuando proceda; 1, 6 y 10: terreno; 2: estilo | Selección de tipo de criatura o alternativa de dos razas humanoides; varias elecciones acumuladas |
| Pícaro | 1 y 6: dos pericias | Candidatos de habilidad y herramientas de ladrón; evitar aplicar pericia dos veces al mismo objetivo |
| Hechicero | 3: dos metamagias; 10 y 17: una adicional | Opciones distintas y costes del recurso común de hechicería |
| Brujo | 2: dos invocaciones; 5, 7, 9, 12, 15 y 18: una adicional; 3: don del pacto; 11, 13, 15 y 17: arcano | Requisitos por clase y rasgo; hasta una sustitución de invocación por ascenso; arcanos con usos propios |
| Mago | 18: Maestría de Conjuros; 20: dos Conjuros Característicos | Selección desde el libro; maestría elige uno de nivel 1 y uno de nivel 2; característicos de nivel 3 |

Los niveles sin una nueva elección en esta tabla todavía pueden tener ASI,
magia, PG, concesiones automáticas o una sustitución opcional permitida.

## 6. Magia: preguntas y concesiones

Las cuotas son totales de **esa fuente**, antes de contribuciones raciales,
dotes o rasgos adicionales. Un incremento abre solo las plazas nuevas.
Los espacios se calculan aparte mediante la progresión correspondiente.

| Fuente | Trucos ordinarios | Aprendizaje de conjuros | Preparación / sustitución |
| --- | --- | --- | --- |
| Bardo | 2 en 1; +1 en 4 y 10 | 4 en 1; +1 en 2–9, 11, 13, 15, 17; secretos en 10, 14, 18 | Conocidos; hasta un conjuro sustituido al adquirir nivel de bardo |
| Clérigo | 3 en 1; +1 en 4 y 10 | Acceso a lista; no seleccionar una cuota de conocidos | Preparados: nivel de clérigo + mod. SAB, mínimo 1; dominio fuera de esa cuota |
| Druida | 2 en 1; +1 en 4 y 10 | Acceso a lista; no seleccionar una cuota de conocidos | Preparados: nivel de druida + mod. SAB, mínimo 1; conjuros de círculo aparte |
| Paladín | Ninguno de clase base | Acceso a lista desde 2 | Preparados: mitad del nivel de paladín redondeada hacia abajo + mod. CAR, mínimo 1; juramento aparte |
| Explorador | Ninguno de clase base | 2 en 2; +1 en 3, 5, 7, 9, 11, 13, 15, 17, 19 | Conocidos; hasta un conjuro sustituido al adquirir nivel de explorador |
| Hechicero | 4 en 1; +1 en 4 y 10 | 2 en 1; +1 en 2–11, 13, 15, 17 | Conocidos; hasta un conjuro sustituido al adquirir nivel de hechicero |
| Brujo | 2 en 1; +1 en 4 y 10 | 2 en 1; +1 en 2–9, 11, 13, 15, 17, 19 | Conocidos; hasta un conjuro sustituido al adquirir nivel de brujo; lista de patrón amplía candidatos |
| Mago | 3 en 1; +1 en 4 y 10 | Libro: 6 en 1; +2 en cada nivel posterior, además de copias durante la partida | Preparados: nivel de mago + mod. INT, mínimo 1; seleccionar desde el libro |

Fuentes: las páginas de clase enlazadas en la tabla 4. La magia de subclases
lanzadoras parciales necesita su propia tabla, cuotas y filtros; no se obtiene
dividiendo simplemente las preguntas de un mago.

Por fuente deben definirse: listas elegibles, nivel máximo aprendible, atributo
de lanzamiento, rituales, foco, modalidad de acceso, fondos de espacios, cuotas
y restricciones. Un conjuro adicional puede ser conocido, siempre preparado,
solo ritual, a voluntad o de uso limitado: esos estados no son intercambiables.

## 7. Inventario de las 40 subclases

Cada fila hereda los hitos de su clase de la tabla 4. La clave de trabajo es
`clase/subclase`; no es todavía un ID del formato persistido.
La columna de elecciones identifica lo que habrá que resolver/cotejar, no
transcribe el texto completo del rasgo. «Auditar» expresa un pendiente concreto.

### Bárbaro: 2

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `barbarian/berserker` | Berserker | Rasgos automáticos; frenesí y sus consecuencias se deciden en juego | R: [clase](https://www.dndbeyond.com/classes/9-barbarian) |
| `barbarian/totem-warrior` | Guerrero Totémico | Animal en 3, 6 y 14, elecciones independientes; rituales como concesiones | G: [guía](https://www.dndbeyond.com/posts/580-barbarian-101-path-of-the-totem-warrior) |

### Bardo: 2

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `bard/lore` | Conocimiento / College of Lore | 3: tres habilidades; 6: dos secretos adicionales fuera del total ordinario | R: [clase](https://www.dndbeyond.com/classes/1-bard) |
| `bard/valor` | Valor | Competencias y rasgos automáticos; alternativas de inspiración en juego | G: [guía](https://www.dndbeyond.com/posts/609-bard-101-college-of-valor) |

### Clérigo: 7

Los dominios usan una lista concedida en niveles 1, 3, 5, 7 y 9, además de sus
hitos de rasgos. Cada lista y cada competencia adicional requieren validación.

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `cleric/knowledge` | Conocimiento | Auditar lenguas y dos habilidades académicas con pericia en 1; competencias temporales en juego | G: [guía](https://www.dndbeyond.com/posts/616-cleric-101-knowledge-domain) |
| `cleric/life` | Vida | Competencias, curación y magia concedidas; no añadir selector permanente por cada rasgo | R: [clase](https://www.dndbeyond.com/classes/2-cleric) |
| `cleric/light` | Luz | Auditar truco concedido y rasgos; reacciones y canalización en juego | P: cotejar texto del dominio |
| `cleric/nature` | Naturaleza | Auditar elección de truco y habilidad en 1; alternativas defensivas en juego | P: cotejar texto del dominio |
| `cleric/tempest` | Tempestad | Auditar competencias y rasgos; canalización y reacciones en juego | P: cotejar texto del dominio |
| `cleric/trickery` | Engaño | Auditar concesiones y magia; duplicado/objetivos en juego | P: cotejar texto del dominio |
| `cleric/war` | Guerra | Auditar competencias y usos; acciones y canalización en juego | P: cotejar texto del dominio |

Inventario de dominios: [guía oficial de clérigo](https://www.dndbeyond.com/posts/182-cleric-101-a-beginners-guide-to-playing-the-divine),
filtrando sus opciones externas al manual. El texto completo de las filas P
sigue pendiente; no se asume igualdad entre dominios por compartir calendario.

### Druida: 2

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `druid/land` | Tierra | 2: truco adicional; tierra que determina magia de círculo desde 3, ampliada en 5, 7 y 9 | R: [clase](https://www.dndbeyond.com/classes/3-druid) |
| `druid/moon` | Luna | Concesiones de transformación; formas y gasto de recursos en juego, no una forma permanente por ascenso | G: [guía](https://www.dndbeyond.com/posts/629-druid-101-circle-of-the-moon) |

### Guerrero: 3

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `fighter/champion` | Campeón | 10: segundo estilo; los demás rasgos son concesiones | R: [clase](https://www.dndbeyond.com/classes/10-fighter) |
| `fighter/battle-master` | Maestro de Batalla | 3: maniobras y herramienta; más maniobras en 7, 10, 15; sustitución ligada a nuevas maniobras | G: [guía](https://www.dndbeyond.com/posts/641-fighter-101-battle-master) |
| `fighter/eldritch-knight` | Caballero Arcano | Magia desde 3; escuelas elegibles y plazas sin esa restricción; vínculo de arma en juego | G: [guía](https://www.dndbeyond.com/posts/874-fighter-101-eldritch-knight) |

### Monje: 3

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `monk/open-hand` | Mano Abierta | Rasgos concedidos; efectos de golpes y objetivos se deciden en juego | R: [clase](https://www.dndbeyond.com/classes/11-monk) |
| `monk/shadow` | Sombras | Magia mediante ki y truco concedido; decisiones de uso en juego | G: [guía](https://www.dndbeyond.com/posts/884-monk-101-way-of-shadows) |
| `monk/four-elements` | Cuatro Elementos | Disciplinas en 3, 6, 11, 17; auditar cuota, disciplina inicial, sustituciones, requisitos y costes | G: [guía](https://www.dndbeyond.com/posts/658-monk-101-way-of-the-four-elements) |

### Paladín: 3

Las listas de juramento se conceden en 3, 5, 9, 13 y 17, además de sus hitos
de rasgos. Son listas vinculadas al juramento, no una pregunta para elegirlas.

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `paladin/devotion` | Devoción | Rasgos y lista concedidos; alternativas de canalización en juego | R: [clase](https://www.dndbeyond.com/classes/4-paladin) |
| `paladin/ancients` | Antiguos | Auditar lista y concesiones; canalización y transformación en juego | G: [guía](https://www.dndbeyond.com/posts/664-paladin-101-oath-of-the-ancients) |
| `paladin/vengeance` | Venganza | Auditar lista y concesiones; objetivos y activaciones en juego | G: [guía](https://www.dndbeyond.com/posts/886-paladin-101-oath-of-vengeance) |

### Explorador: 2

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `ranger/hunter` | Cazador | 3, 7, 11 y 15: una alternativa del grupo de rasgos correspondiente | R: [clase](https://www.dndbeyond.com/classes/5-ranger) |
| `ranger/beast-master` | Señor de las Bestias | 3: compañero; auditar elegibilidad y escalas; reemplazos del compañero pertenecen al juego | G: [guía](https://www.dndbeyond.com/posts/669-ranger-101-beast-master) |

### Pícaro: 3

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `rogue/thief` | Ladrón | Rasgos concedidos; interacciones de herramientas/objetos en juego | R: [clase](https://www.dndbeyond.com/classes/12-rogue) |
| `rogue/assassin` | Asesino | Auditar competencias y rasgos; identidades, disfraces y objetivos en juego | G: [guía](https://www.dndbeyond.com/posts/679-rogue-101-assassin) |
| `rogue/arcane-trickster` | Embaucador Arcano | Magia desde 3; truco obligatorio, escuelas y plazas especiales; sustitución con restricciones heredadas | G: [guía](https://www.dndbeyond.com/posts/891-rogue-101-arcane-trickster) |

### Hechicero: 2

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `sorcerer/draconic` | Linaje Dracónico | 1: ancestro; tipo asociado condiciona beneficios posteriores | R: [clase](https://www.dndbeyond.com/classes/6-sorcerer) |
| `sorcerer/wild-magic` | Magia Salvaje | Concesiones y tabla de efectos; tiradas/activaciones en juego | G: [guía](https://www.dndbeyond.com/posts/701-sorcerer-101-wild-magic) |

### Brujo: 3

Los patrones amplían la lista de candidatos; no conceden automáticamente todos
esos conjuros como conocidos. Sus listas deben cargarse con origen independiente.

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `warlock/archfey` | Archihada | Lista ampliada y rasgos; no confundir patrón con don del pacto de 3 | G: [guía](https://www.dndbeyond.com/posts/713-warlock-101-the-archfey) |
| `warlock/fiend` | Infernal | 10: resistencia seleccionable al descansar; estado de juego, no selección irreversible | R: [clase](https://www.dndbeyond.com/classes/7-warlock) |
| `warlock/great-old-one` | Gran Antiguo | Lista ampliada y rasgos; objetivos y vínculos en juego | G: [guía](https://www.dndbeyond.com/posts/901-warlock-101-the-great-old-one) |

### Mago: 8

Todas conservan las elecciones del libro de la clase. No se restringe la lista
general de conjuros del mago a la escuela elegida como tradición.

| Clave | Subclase | Elecciones / distinción de fase | Evidencia |
| --- | --- | --- | --- |
| `wizard/abjuration` | Abjuración | Auditar protección arcana como recurso separado de PG temporales | P: cotejar texto de tradición |
| `wizard/conjuration` | Conjuración | Auditar concesiones; objetos, criaturas y teleportación en juego | P: cotejar texto de tradición |
| `wizard/divination` | Adivinación | Auditar presagios como resultados de dados conservados; opciones de percepción en juego | P: cotejar texto de tradición |
| `wizard/enchantment` | Encantamiento | Auditar concesiones; objetivos y control en juego | P: cotejar texto de tradición |
| `wizard/evocation` | Evocación | Concesiones; selección de criaturas protegidas y activaciones en juego | R: [clase](https://www.dndbeyond.com/classes/8-wizard) |
| `wizard/illusion` | Ilusión | Auditar truco concedido y elección alternativa si ya se conoce; manipulación de ilusiones en juego | P: cotejar texto de tradición |
| `wizard/necromancy` | Nigromancia | Auditar magia concedida y escalas de criaturas; objetivos de control en juego | P: cotejar texto de tradición |
| `wizard/transmutation` | Transmutación | Auditar piedra y beneficios cambiables; propiedad de la piedra separada de quién recibe el efecto | P: cotejar texto de tradición |

Inventario de las ocho tradiciones: [guía oficial de mago](https://www.dndbeyond.com/posts/209-wizard-101-a-beginners-guide-to-the-arcane-arts).
Las filas P identifican requisitos de modelado propuestos; no certifican sus
parámetros mecánicos ni sustituyen el texto de esas tradiciones.

## 8. Elecciones anidadas y casos de prueba del diseño

| Caso | Requisito del contrato |
| --- | --- |
| Don del pacto del brujo | Selector independiente del patrón; la opción elegida abre preguntas/concesiones diferentes |
| Tomo | Tres trucos de listas ampliadas con cuota propia; no consumir plazas ordinarias |
| Cadena | Concesión de magia y catálogo de formas vinculado; selección de forma en juego |
| Espada | Competencia y arma vinculadas al rasgo; forma/arma actual separada de la elección del pacto |
| Invocación con rituales | Elección de invocación abre una lista de rituales y un libro; conservar cada origen |
| Secretos de Conocimiento del bardo | Cuota adicional distinta de los secretos ordinarios de clase |
| Cazador / Totémico | Grupos de elección independientes aunque las etiquetas se repitan |
| Maestro de Batalla | Sustitución disponible solo en los eventos que permiten aprender maniobras |
| Lanzador parcial | Restricciones por escuela y origen de plaza; reemplazar no borra la restricción |
| Mago / Maestría | Selecciones de construcción con cambio posterior sujeto a actividad y duración |
| Dote que otorga magia | Lista, atributo, cuota y usos vinculados a la dote, no al atributo global de la ficha |
| Pericia en herramientas | El modelo actual de pericia en habilidades no cubre todas las categorías |
| Animal/forma fuera del catálogo | Representar necesidad de definición; no sustituirla silenciosamente por una opción arbitraria |

Los casos del pacto proceden del [SRD 5.1](https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf),
en la sección de brujo;
los del bardo, mago y cazador, de sus páginas de clase. El presupuesto de
maniobras está corroborado por la [guía de Maestro de Batalla](https://www.dndbeyond.com/posts/641-fighter-101-battle-master).
El diseño del resto expresa consecuencias para el modelo, no reglas nuevas.

## 9. Concesiones automáticas: cobertura obligatoria

El inventario de preguntas no reemplaza el catálogo de beneficios automáticos.
Cada definición tendrá una progresión completa 1–20, incluyendo los niveles
que no abren preguntas. Debe contener todos los rasgos, escalas y recursos de
esa clase/subclase; no basta generar un texto con el nombre del rasgo.

Separar efectos constantes, condiciones de uso, acciones y recursos. Por ejemplo,
el modelo debe poder expresar fórmulas alternativas de CA, bonificaciones
condicionadas al equipo, escalas de dados, modos de tirada, resistencias,
inmunidades, sentidos, velocidades y recuperación de recursos.

Esos efectos requieren políticas de combinación: sumar, reemplazar, conceder
una capacidad, elegir una fórmula compatible o conservar un máximo. Compartir
una etiqueta no implica que dos efectos se acumulen. Los casos no automatizados
quedan visibles como operaciones manuales, con cobertura declarada.

No todas las criaturas auxiliares aparecen en el apéndice del manual. Si un
rasgo requiere una criatura cuya definición pertenece a otra fuente, registrar
esa dependencia auxiliar por separado del catálogo de opciones de personaje.
Decidir cómo obtener esa definición antes de habilitar la automatización de la
opción; no ampliar de forma implícita las clases, dotes o conjuros disponibles.

## 10. Contrato de una elección

Campos mínimos propuestos; son diseño, no un esquema ya aprobado:

| Campo | Uso |
| --- | --- |
| `definitionRef` | ID y versión de la regla que abre la elección |
| `instanceId` | Identidad estable de esa plaza/grupo en ese personaje |
| `source` | Clase, subclase, raza, trasfondo, dote o rasgo que la concede |
| `phase` | Creación, ascenso, descanso, actividad o uso durante la partida |
| `trigger` | Evento y nivel de clase/total requerido |
| `kind` | Selección, distribución, tirada, paquete o sustitución |
| `quota` | Cantidad, presupuesto o plazas, con alcance independiente |
| `candidates` | Referencias/filtros de listas, categorías, escuelas y requisitos |
| `dependencies` | Selecciones/concesiones de las que depende |
| `duplicatePolicy` | Restricción por opción, objetivo o fuente; reglas de reemplazo |
| `replacementPolicy` | Momento, máximo de sustituciones y restricciones que se conservan |
| `selection` | Referencias/valores elegidos y evidencia de tirada si procede |
| `grants` | Rasgos, acciones, competencias, magia o recursos producidos |
| `supersedes` | Selección anterior sustituida; no borrar su historial |
| `resolution` | Pendiente, válida, inválida, automática o excepción documentada |

El motor necesita detectar dependencias cíclicas, referencias faltantes y reglas
incompatibles. Al cambiar una decisión previa calcula el conjunto afectado y
muestra qué selecciones requieren nueva resolución. Los ajustes generados se
actualizan por origen; no se aplican sucesivamente sobre el último valor final.

### Atributos, competencias y recursos

Guardar atributos iniciales y contribuciones por fuente. Mantener competencias
con origen y categoría: habilidad, salvación, arma, armadura, herramienta o lengua.
El multiplicador de pericia no debe deducirse de competencias duplicadas.

Recursos con capacidad numérica, dados, resultados conservados o disponibilidad
ilimitada requieren variantes del contrato. Capacidad derivada y consumo son
datos distintos. Cada recurso tiene política de recuperación y actualización.

### Magia y listas

Cada concesión de magia debe identificar su origen, lista, atributo, modo de
acceso y restricciones. Una plaza puede heredar una excepción de escuela sin
que toda la clase obtenga esa excepción. Una lista ampliada no equivale a una
lista automáticamente aprendida o preparada.

Conservar cuotas ordinarias y adicionales, opciones de lanzamiento y fondos de
recursos independientemente. Resolver el mismo conjuro concedido por dos fuentes
sin borrar ninguna de ellas ni contar dos veces una plaza de la misma fuente.

## 11. Dependencias fuera de clase

Estos pasos se comparten con todas las clases y necesitan un inventario propio
antes de declarar completo el paquete del manual:

| Paso | Requisito de diseño |
| --- | --- |
| Raza y subraza | Atributos fijos/elegibles, lenguas, habilidades, herramientas, magia, tamaño y sentidos |
| Humano variante | Habilitación de campaña y elección anidada de dote |
| Trasfondo | Competencias, herramientas/lenguas, equipo y rasgo; personalización y variantes |
| Duplicado de competencia | Elección de sustitución de la categoría permitida, sin convertirla en pericia |
| Dotes | Requisitos, repetibilidad, aumentos, elecciones internas y capacidades |
| Equipo | Alternativas y paquetes; elección de equipo o compra inicial; aplicación una sola vez |
| Personalidad | Rasgos, ideal, vínculo, defecto, apariencia e historia; sugerencias no obligatorias |

La personalización y sustitución de competencias deben seguir la fuente de
[trasfondos de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/personality-and-background).
La raza y sus concesiones se cotejan con el capítulo correspondiente; esta matriz
no certifica todavía todas las opciones raciales ni enumera cada dote/conjuro.

## 12. Pendientes de verificación antes de cargar el paquete

1. Cotejar las filas G/P con el Manual del Jugador 2014 y fijar una política de erratas.
2. Completar parámetros de cada rasgo, listas concedidas y catálogos de opciones.
3. Verificar las tablas de los lanzadores parciales, plazas por escuela y sustituciones.
4. Verificar cuotas y sustituciones de disciplinas de Cuatro Elementos.
5. Completar inventarios de razas, trasfondos, dotes, conjuros y alternativas de equipo.
6. Resolver dependencias de criaturas/estadísticas auxiliares con fuente explícita.
7. Cerrar las políticas de campaña pendientes en la propuesta de arquitectura.

Las guías oficiales son apoyo de planificación, no sustitutos del texto de
reglas. Por ejemplo, la guía de Embaucador Arcano consultada presenta una
enumeración de plazas sin restricción de escuela que debe cotejarse: no se
trasladará a un contrato ejecutable sin verificación con el manual.
También se descartaron sugerencias de las guías que permiten sustituciones
adicionales o recomiendan conjuros ajenos al catálogo confirmado.

## 13. Criterios de aceptación del modelo

- Recorrer niveles 1–20 de cada clase sin preguntas fuera de sus disparadores.
- Instanciar las 40 subclases y comprobar concesiones y elecciones de sus hitos.
- Conservar decisiones permanentes cuando cambia preparación, forma u objetivo.
- Diferenciar las plazas ordinarias y adicionales sin duplicar beneficios.
- Respetar las sustituciones y reevaluar dependencias en la misma operación.
- Construir en nivel alto con el mismo historial que una progresión equivalente.
- Recalcular dos veces con el mismo resultado y sin entregar otra vez equipo/oro.
- Soportar magia de dos atributos, varios fondos de espacios y dados de golpe distintos.
- Guardar PG y recursos gastados durante un ascenso sin introducir un descanso.
- No marcar como verificada una definición con parámetros de reglas pendientes.

## 14. Resultado de esta etapa

El inventario confirma que hacen falta elecciones con origen y fase, cuotas
independientes, sustituciones limitadas, concesiones automáticas, varios orígenes
de magia, pericia en distintas categorías y recursos más generales que un entero.

Los requisitos se concretan en la [propuesta de contratos de datos](CHARACTER_BUILDER_DATA_CONTRACTS.md),
con ejemplos de guerrero, mago y multiclase. La implementación del asistente
sigue posterior al diseño y a la validación del contenido que se publique.
