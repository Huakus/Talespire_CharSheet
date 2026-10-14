# Bárbaro · Manual 2014 y Xanathar

> Estado actual: siete clases. La entrega posterior de
> [Bardo](BARD_BUILDER_IMPLEMENTATION.md) agrega sus cinco colegios;
> los recuentos siguientes describen esta entrega de Bárbaro.

Implementación del 14 de octubre de 2026. El tutorial admite ahora seis clases
individuales, con creación directa en niveles 1–20 y ascensos posteriores.
No incluye multiclase ni opciones de SCAG, Tasha o las reglas revisadas de 2024.

## Sendas y elecciones

| Fuente | Sendas |
| --- | --- |
| Manual del Jugador 2014 | Berserker y Guerrero Totémico |
| Xanathar | Guardián Ancestral, Heraldo de la Tormenta y Fanático |

Todas se eligen en nivel 3 y reciben los rasgos correspondientes en 3, 6, 10 y 14.
Guerrero Totémico elige Oso, Águila o Lobo de forma independiente en 3, 6 y 14:
están disponibles las 27 combinaciones. Los animales adicionales de SCAG no
pertenecen al alcance Manual + Xanathar. El tótem físico y la descripción de su
representación se acuerdan en mesa, como indican los rasgos.

Heraldo elige Desierto, Mar o Tundra en nivel 3 y puede cambiar de entorno en
cualquier ascenso posterior de Bárbaro. Aura, Alma y Tormenta Furiosa siguen el
entorno actual, conservando identificadores y sin acumular efectos de entornos
anteriores. Fanático elige daño radiante o necrótico al adquirir Furia Divina;
no puede cambiarlo libremente en ascensos posteriores.

## Progresión básica

- d12, 12 + CON iniciales y 7 + CON o d12 posterior. Cambios de CON recalculan
  retroactivamente los PG. El aumento de nivel conserva daño y dados gastados.
- Dos habilidades de las seis de clase, salvaciones FUE/CON, armas sencillas y
  marciales, armaduras ligeras/medias y escudos; no concede herramientas.
- Mejoras/dotes en 4, 8, 12, 16 y 19. Los aumentos normales están limitados a 20.
- Defensa sin Armadura usa 10 + DEX + CON con escudo, sin sumar fórmulas de CA.
  Se escoge la mejor fórmula válida cuando hay otra alternativa sin armadura.
- Ataque Extra permite dos ataques desde nivel 5. Movimiento Rápido añade 10 pies
  sin armadura pesada. Instinto Salvaje añade ventaja en iniciativa desde 7.
- Crítico Brutal: uno/dos/tres dados individuales desde 9/13/17. El panel permite
  tirarlos por arma; no duplica el arma entera ni sus bonos fijos.
- Furia Implacable desde 11, Furia Persistente desde 15, Fuerza Indómita desde 18
  y Campeón Primario en 20, con sus textos y controles pertinentes.
- Campeón Primario suma +4 FUE/CON y eleva ambos máximos a 24. Los PG incorporan
  los veinte niveles del nuevo modificador de CON. No abre mejoras normales a 24
  ni aumenta otros atributos. El personaje obtiene furias ilimitadas en nivel 20.

Se mantienen los 15 perfiles raciales, 18 trasfondos personalizables y 57 dotes
compartidas, con sus requisitos. Los rituales de Guerrero Totémico y los conjuros
de Guardián Ancestral desde 10 satisfacen el requisito de poder lanzar conjuros;
las auras mágicas y la Furia Divina por sí solas no lo hacen.

## Equipo

Todas las armas marciales cuerpo a cuerpo están disponibles como primera elección.
La segunda permite dos hachas de mano o cualquier arma simple, incluso un hacha
individual o arma a distancia. Incluye paquete de explorador y cuatro jabalinas.
Las cantidades coincidentes se agrupan; elegir una jabalina adicional da cinco.
El arma principal se equipa; las de reserva quedan guardadas. No se regalan
armadura, escudo ni munición de una alternativa simple a distancia.

La alternativa de oro es **2d4 × 10 po**, conforme a la tabla de riqueza inicial
del PDF del Manual (página PDF 119). Reemplaza paquetes y dinero de clase/trasfondo.
La validación compartida permite ahora dos dados sin aflojar el recuento de las
otras clases. Las tiradas de PG de Guerrero siguen limitadas a d10 aunque el
esquema compartido de niveles admita ahora d12.

## Furia y controles de juego

- Usos por descanso largo: 2/3/4/5/6 desde niveles 1/3/6/12/17; ilimitados en 20.
  Los ilimitados no se representan como una cantidad finita artificial. El contador
  de la ficha muestra cero usos limitados y el panel indica explícitamente ilimitado.
- Iniciar Furia consume un uso, registra el estado y retira la concentración.
  Se bloquean conjuros raciales, de dotes y de sendas, incluidos rituales. El
  bloqueo existe tanto en la interfaz como en el dominio.
- Sin armadura pesada, añade ventaja en pruebas/salvaciones de FUE y daño
  +2/+3/+4 desde 1/9/16, exclusivamente en ataques cuerpo a cuerpo con FUE. No
  modifica los ataques con DEX ni los arrojados indicados como ataques a distancia.
- Las resistencias de clase se muestran en el panel, incluidas las de Oso y Alma
  de Tormenta. Como el comando de daño no recibe un tipo, **el usuario aplica
  resistencia antes de ingresar daño en PG**; no se reduce cualquier daño a ciegas.
- Furia puede iniciarse con armadura pesada, pero se deshabilitan sus tres
  beneficios básicos. Los rasgos de senda conservan las restricciones que
  realmente indican: Oso 3, por ejemplo, no especifica esa prohibición.
- El control de final de turno distingue ataque a un hostil y daño recibido:
  solo termina por inactividad si no ocurrió ninguno. Furia Persistente elimina
  ese final temprano; conserva diez turnos/un minuto como duración máxima.
- Inconsciencia y descansos terminan Furia. Los descansos cortos no devuelven
  sus usos. El paso de tiempo fuera del combate se registra terminándola.
- Frenesí solo se elige con Berserker al comenzar Furia. Su final añade exactamente
  un nivel de agotamiento, aunque se termine mediante condiciones o descanso.
  El descanso largo aplica su recuperación después de terminar el frenesí.
- Furia Inconsciente conserva y suspende estados previos de hechizado/asustado,
  elimina su penalización de tirada mientras dura y rechaza añadir esos estados
  durante la inmunidad. Sus duraciones y efectos sobre objetivos se resuelven en mesa.
- Ataque Temerario se activa al primer ataque del turno y añade ventaja solo a
  los ataques válidos; combina ventaja/desventaja sin acumular fuentes. El usuario
  finaliza esa ventaja al terminar el turno. La ventaja de atacantes contra el
  bárbaro dura hasta su próximo turno y se aplica en mesa.
- Sentido del Peligro ofrece una tirada separada para un efecto visible, deshabilitada
  cuando está cegado, ensordecido o incapacitado. No modifica todas las salvaciones DEX.
- Furia Implacable registra el resultado total de CON, restituye 1 PG al superar
  su CD y aumenta la CD en 5 por uso. Descanso corto/largo restablece CD 10.
  El daño que reduce a 0 PG desde 11 deja pendiente resolverla. Se requiere confirmar
  que no hubo muerte instantánea. También sirve con PG registrados manualmente.
- Enfoque Fanático controla un uso por Furia y se restablece al comenzar otra;
  Presencia Fanática tiene un contador independiente por descanso largo.
- Furia más Allá de la Muerte conserva la Furia a 0 PG desde Fanático 14. Las
  salvaciones de muerte, daño masivo, muerte instantánea y muerte al terminar la
  Furia se resuelven con el GM: no se implementa un estado automático de muerte.
- Fuerza Indómita tiene un calculador del mínimo del resultado total, no del d20.

## Sendas, magia y movimiento

Guerrero Totémico incorpora Sentido animal/Hablar con los animales desde 3 y
Comunión con la naturaleza desde 10 como rituales sin libro ni espacios. No
concede una regla de preparación ni una bolsa de componentes. Los tres rituales
no requieren ataque/CD; la ficha usa SAB como metadato de presentación, sin
inventar una característica de lanzamiento que el rasgo no especifica.

Consultar a los Espíritus incorpora Augurio y Clarividencia sin espacio ni
componentes materiales, con SAB explícita. Comparten un uso por descanso corto
o largo. Conservan sus tiempos, V/S y concentración cuando corresponda. Augurio
no obtiene lanzamiento ritual ilimitado por estar marcado como ritual en su
definición: esta fuente únicamente concede el lanzamiento limitado del rasgo.

Oso 6 duplica la capacidad de carga calculada sin exigir Furia. Mar 6 incorpora
natación con base 30 pies, modificada por Movimiento Rápido y Móvil cuando proceda.
El texto gestionado `nadar … ft (Alma de Tormenta)` se retira al cambiar de entorno;
conserva velocidades manuales de otras fuentes. Movimiento Rápido actualiza las
velocidades adicionales con formato nombrado, por ejemplo `trepar 20 ft`.
Otros formatos libres requieren ajustar su texto manualmente. El vuelo breve de
Águila 14 sigue la velocidad a pie actual y sus limitaciones se resuelven en mesa.

Furia Divina y Escudo Espiritual tienen tiradas separadas. El aura tiene tirada
o valor fijo según el entorno. Objetivos, salvaciones, reacciones, Frenesí,
Protectores Ancestrales, Ancestros Vengativos y las otras interacciones de combate
se aplican siguiendo sus textos en Rasgos. No se agregan indiscriminadamente a
todos los ataques ni se consumen acciones/reacciones de otras fichas.

## Fuentes y validación

Se consultaron los PDF aportados del Manual (páginas PDF 32–35 y 119) y Xanathar
(11–13). El PDF de Xanathar acredita traducción de aficionados, no editorial oficial.
Los resúmenes propios corrigen contradicciones de tablas/traducción sin incorporar
reglas de 2024. La [errata oficial de Xanathar](https://media.wizards.com/2020/dnd/downloads/XGtE-Errata.pdf)
confirma que Escudo Espiritual usa **d6**, no los d8 de la tabla del PDF.
Las reglas generales se contrastaron también con las
[reglas básicas 2014 de Wizards](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes)
y la [errata del Manual](https://media.wizards.com/2021/dnd/downloads/PH-Errata.pdf).

Los datos nuevos usan valores predeterminados para leer fichas antiguas. No se
migran ni modifican campañas locales ni se requiere un cambio de tablas del
backend. El historial, los recursos y operaciones viajan en los fragmentos y
exportaciones existentes. Se controlan revisiones y reintentos; las operaciones
de juego concurrentes incompatibles se reportan como conflictos.

La validación incluye las cinco sendas 1–20, las 270 combinaciones de raza/trasfondo
cruzadas con cada senda, los 27 conjuntos de tótems, los tres entornos, ambas
opciones de daño divino, equipo, atributos/PG, furias, agotamiento, magia, ascensos,
exportaciones, fragmentación y flujos del tutorial con happy-dom. La comprobación
final ejecuta TypeScript, la suite completa y el build con `--emptyOutDir=false`.

Resultado final: **744 pruebas aprobadas en 67 archivos**, TypeScript correcto y
compilación de producción completada mediante `npm run check`. La prueba de
sincronización cubre también acciones de Furia concurrentes con daño o descanso,
permitiendo cambios independientes de nombre. La interfaz se verifica con
happy-dom; no se realizó una inspección visual dentro de TaleSpire.
