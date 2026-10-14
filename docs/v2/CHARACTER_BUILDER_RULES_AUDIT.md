# Auditoría de reglas del tutorial · Guerrero 2014

> Estado actual al 14/10/2026: nueve clases con Manual 2014 y Xanathar.
> Se agregó [Explorador](RANGER_BUILDER_IMPLEMENTATION.md), con cinco arquetipos y compañero animal.
> Se agregó [Druida](DRUID_BUILDER_IMPLEMENTATION.md), con cuatro círculos y ocho terrenos de Tierra.
> Se agregó [Bardo](BARD_BUILDER_IMPLEMENTATION.md), con sus cinco colegios.
> Se incorporaron [Pícaro](ROGUE_BUILDER_IMPLEMENTATION.md) y
> [Bárbaro](BARBARIAN_BUILDER_IMPLEMENTATION.md), además de Guerrero, Mago,
> Brujo y [Clérigo](CLERIC_XANATHAR_IMPLEMENTATION.md). Los recuentos y pendientes
> del cuerpo de este documento describen su entrega histórica.

Actualizada el 13 de octubre de 2026. Alcance: Guerrero de una sola clase,
niveles 1–20, con Campeón, Maestro de batalla y Caballero arcano; quince opciones
raciales; trece trasfondos y cinco variantes; cuarenta y dos dotes del PHB.

La auditoría y ampliación de Mago, incorporada el 14 de octubre, está en
[Mago: implementación y revisión](WIZARD_BUILDER_IMPLEMENTATION.md).

## Progresión de clase

| Nivel | Concesiones y elecciones |
| --- | --- |
| 1 | d10, PG iniciales, salvaciones Fuerza/Constitución, dos habilidades, todas las armaduras/escudos y armas sencillas/marciales, uno de seis estilos, Segundo aliento. |
| 2 | Acción súbita, un uso por descanso corto o largo. |
| 3 | Un arquetipo: Campeón, Maestro de batalla o Caballero arcano. |
| 4/6/8/12/14/16/19 | +2 o +1/+1 hasta 20, o dote permitida con sus elecciones y requisitos. Se admite renuncia voluntaria al beneficio. |
| 5/11/20 | Dos/tres/cuatro ataques al usar la acción Atacar. |
| 9/13/17 | Indomable: uno/dos/tres usos por descanso largo. |
| 17 | Dos usos de Acción súbita entre descansos, máximo uno por turno. |

| Arquetipo | Hitos |
| --- | --- |
| Campeón | 3: crítico 19–20; 7: Atleta notable; 10: segundo estilo distinto; 15: crítico 18–20; 18: Superviviente. |
| Maestro de batalla | 3: tres maniobras, cuatro d8 y herramienta de artesano; 7: dos maniobras, quinto dado, Conoce a tu enemigo; 10: dos maniobras y d10; 15: dos maniobras, sexto dado e Implacable; 18: d12. Sustitución de una maniobra al aprender nuevas. |
| Caballero arcano | 3: conjuros y vínculo con hasta dos armas; 7: Magia de guerra; 10: Golpe arcano y tercer truco; 15: Carga arcana; 18: Magia de guerra mejorada. |

La CD de maniobras usa 8 + competencia + Fuerza o Destreza. Se valida la lista
de dieciséis maniobras originales del PHB, sin opciones posteriores. Adepto
marcial suma dos maniobras distintas y un dado, con su contador separado; el
rasgo Superioridad de combate mejorada también aumenta ese dado en 10 y 18.

## Caballero arcano y magia de otros orígenes

| Nivel de Guerrero | Trucos | Conjuros conocidos | Espacios 1/2/3/4 |
| --- | --- | --- | --- |
| 3 | 2 | 3 | 2/0/0/0 |
| 4–6 | 2 | 4 | 3/0/0/0 |
| 7 | 2 | 5 | 4/2/0/0 |
| 8–9 | 2 | 6 | 4/2/0/0 |
| 10 | 3 | 7 | 4/3/0/0 |
| 11–12 | 3 | 8 | 4/3/0/0 |
| 13 | 3 | 9 | 4/3/2/0 |
| 14–15 | 3 | 10 | 4/3/2/0 |
| 16–18 | 3 | 11 | 4/3/3/0 |
| 19 | 3 | 12 | 4/3/3/1 |
| 20 | 3 | 13 | 4/3/3/1 |

Hay una plaza de cualquier escuela al aprender conjuros en 3, 8, 14 y 20;
las demás exigen Abjuración/Evocación. Una sustitución por nivel conserva la
excepción de su plaza original, incluida la de nivel 3 conforme a la errata.
No se sustituyen trucos de clase con las reglas de 2014. Se comprueban nivel
máximo, lista de mago, escuela, cantidad y duplicaciones antes de confirmar.

Los 16 trucos y 116 conjuros de mago de niveles 1–4 están disponibles, incluidos
los que no aparecen en el SRD. Los nombres se conservan en inglés. No se admite
Booming Blade ni opciones de suplementos. Las dotes de magia permiten elegir
su lista de clase y los conjuros correspondientes, con su atributo de lanzamiento.

La magia racial de drow y tiefling se desbloquea en 1/3/5. Hellish Rebuke racial
se lanza a nivel 2. Sus contadores por descanso largo son independientes de los
espacios del Caballero arcano. El truco del alto elfo y Minor Illusion del gnomo
de los bosques usan Inteligencia. Los conjuros conocidos de Caballero arcano no
requieren preparación ni obtienen lanzamiento ritual por tener la etiqueta ritual.

## Validaciones comunes

- Quince opciones raciales con bonos, velocidad, idiomas, tamaño, competencias
  y rasgos. Se validan dos aumentos distintos del humano variante/semielfo,
  habilidades raciales, truco de alto elfo y ascendencia dracónica.
- Diez ascendencias: daño, área y salvación de aliento; escalado 2/3/4/5d6 en
  niveles 1/6/11/16, resistencia y uso por descanso corto o largo.
- Matriz estándar sin valores repetidos, compra de hasta 27 puntos entre 8 y 15,
  tiradas de atributos entre 3 y 18. Dotes con aumento limitado a 20 pueden
  seguir elegirse por sus demás beneficios aunque el atributo ya esté en 20.
- Trece trasfondos y cinco variantes con rasgo, competencias, equipo y oro.
  La personalización conserva dos habilidades y dos herramientas/idiomas en
  conjunto. Las competencias repetidas se resuelven antes de continuar.
- Idiomas y herramientas pertenecen al PHB. El permiso para opciones exóticas
  se acuerda con el GM. Los idiomas secretos de otras clases no son idiomas
  de trasfondo libremente elegibles.
- Los seis estilos; segundo estilo exclusivo de Campeón 10. Atleta notable
  solo se calcula para Campeón y no afecta salvaciones.
- Cuarenta y dos dotes con requisitos, elecciones internas y control de repetición.
  Adepto elemental admite repetición solo con un tipo distinto. Los requisitos
  de armadura de las dotes ya están satisfechos por Guerrero.
- Compra inicial: cinco d4 × 10 po, presupuesto, precios por unidad, cantidades,
  manos, armadura y escudo. Sustituye ambos paquetes y el dinero del trasfondo.
  Los objetos narrativos sin precio no se ofrecen como compras gratuitas.
- Paquetes: armadura/armas/escudo, arco y flechas al elegir cuero, equipo
  secundario, paquete de aventurero y equipo del trasfondo con sus alternativas.
  Las unidades adicionales del mismo arma quedan guardadas, sin duplicar manos.
- PG por 6 o d10, mínimo por nivel, cambios retroactivos de Constitución,
  Dureza enana y Duro. El aumento del máximo no cura los PG actuales al subir.
- IDs estables, conservación de usos, dados de golpe y espacios gastados;
  retiro de maniobras/conjuros reemplazados; sin nueva entrega de equipo inicial.

## Resolución durante la partida

La cobertura de construcción no implica automatización completa del combate.
Se calculan atributos, competencias, PG, CA, estilos admitidos, Alerta,
Observador, Móvil, Duro y los beneficios indicados en
[la implementación](CHARACTER_BUILDER_IMPLEMENTATION.md).

Críticos, daño extra, resistencias, condiciones situacionales, maniobras,
reacciones, objetivos, componentes, manos al lanzar, ataques adicionales y
repeticiones se resuelven con los controles existentes y el texto de los rasgos.
Sanador, Duradero y curaciones condicionales no se aplican por detección de
eventos. El jugador ingresa la curación correspondiente. Una expresión de daño
no resuelve rayos múltiples, impactos sucesivos o efectos especiales de conjuros.

La desventaja por armadura y su excepción por Maestro de armadura media usan el
equipo actual. La penalización de velocidad por Fuerza insuficiente se actualiza
para fichas guiadas, con excepción enana; necesita velocidad numérica en ft/pies.
Duelo presupone un arma a una mano y distingue daño versátil; la lanza de
caballería requiere resolución según la montura. Paquetes y pesos no especificados
conservan las limitaciones descritas en el inventario.

Los descansos largos recuperan también los recursos de descanso corto. El GM
decide cuándo se descansa y cuándo se sube; no se imponen PX ni horarios.

## Evidencia, pruebas y límites

Referencias oficiales de 2014:
[Guerrero/Campeón](https://www.dndbeyond.com/classes/10-fighter),
[Maestro de batalla](https://www.dndbeyond.com/posts/641-fighter-101-battle-master),
[Caballero arcano](https://www.dndbeyond.com/posts/874-fighter-101-eldritch-knight),
[razas](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/races),
[creación](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters),
[trasfondos](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/personality-and-background),
[equipo](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment),
[conjuros](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/spells),
[erratas PHB](https://media.wizards.com/2021/dnd/downloads/PH-Errata.pdf).

Para parámetros no expuestos en las páginas públicas del manual se contrastaron
las entradas PHB de las referencias secundarias
[Battle Master](https://dnd5e.wikidot.com/fighter:battle-master),
[Eldritch Knight](https://dnd5e.wikidot.com/fighter:eldritch-knight),
[elfos](https://dnd5e.wikidot.com/lineage:elf),
[gnomos](https://dnd5e.wikidot.com/lineage:gnome) y sus entradas de dotes/trasfondos.
No se incorporaron sus opciones marcadas como suplementos. Las fuentes de los
catálogos y las licencias figuran en [el aviso de contenido](PHB_2014_CONTENT_NOTICE.md).

Las pruebas recorren las 270 combinaciones de raza/trasfondo, las tres progresiones
hasta 20, las diez ascendencias, las cuarenta y dos dotes, sustituciones legales
e ilegales, magia por fuente, recursos gastados y descansos. También cubren
creación atómica a nivel superior, reintentos tras otros ascensos, conflictos,
exportación, fragmentos, conservación y reanudación de borradores, controles de
dotes, tiradas, compras y lanzamientos desde la interfaz real.

Validación: `npm run typecheck` y `npm test`, 362 pruebas en 47 archivos correctos.
Compilación correcta con `npm run build:v2 -- --emptyOutDir=false`.
Vite conserva el aviso de tamaño del bundle; no hay errores de compilación.
La inspección visual dentro de TaleSpire continúa pendiente; las pruebas de UI
usan DOM. No se modifican campañas remotas ni `.localstorage/`.

Quedan fuera las otras once clases, multiclase, suplementos, adopción de fichas
manuales, reespecialización, el motor declarativo general y el control de
capacidades entre clientes propuestos en la arquitectura. Esta auditoría no
certifica el Manual completo para todas las clases ni la automatización de cada
efecto durante el juego.
