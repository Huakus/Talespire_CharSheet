# Bardo · Manual del Jugador 2014 y Xanathar

> Estado actual: ocho clases. La entrega posterior de [Druida](DRUID_BUILDER_IMPLEMENTATION.md)
> agrega sus cuatro círculos. Los recuentos siguientes describen esta entrega de Bardo.

Implementación del tutorial de creación, creación inicial a cualquier nivel y ascensos monoclase del 1 al 20. Se integra al historial, guardado, exportaciones y fragmentos existentes; no cambia datos de campaña ni necesita migraciones de base de datos.

## Opciones y progresión

- Cinco colegios: Conocimiento y Valor (Manual 2014); Glamour, Espadas y Susurros (Xanathar). Elección en nivel 3; rasgos en 3, 6 y 14.
- Tres habilidades entre las 18, tres instrumentos entre los diez del Manual y pericias en dos habilidades competentes en niveles 3 y 10. Conocimiento elige otras tres habilidades en nivel 3. No se duplican competencias/pericias; las opciones bloqueadas explican el motivo.
- 15 perfiles raciales, 18 trasfondos personalizables y las 57 dotes compartidas. Los requisitos de dotes reconocen magia desde nivel 1, armaduras medias de Valor/Espadas y competencias/pericias del colegio.
- d8, salvaciones DES/CAR, competencias iniciales y todas las alternativas de equipo: estoque/espada larga/cualquier arma sencilla; paquete diplomático/actor; cualquier instrumento; cuero y daga. Alternativa 5d4 × 10 po con compras.
- Mejoras/dotes en niveles 4, 8, 12, 16 y 19. PG retroactivos por Constitución, gastos, heridas, PG temporales, dados gastados y ajustes propios se conservan al avanzar.
- Espadas elige Duelo o Lucha con dos armas. Duelo se calcula al cumplir las condiciones de arma equipada a una mano, sin otra arma; el segundo ataque de dos armas se configura/resuelve siguiendo el rasgo.

## Magia

- Carisma, espacios de lanzador completo, 2/3/4 trucos ordinarios en niveles 1/4/10 y conocidos según la tabla 2014. No hay preparación diaria ni sustitución de trucos ordinarios de reglas posteriores.
- Un conocido anterior puede sustituirse por otro de la lista de Bardo al subir de nivel, conservando el origen de su plaza.
- Secretos Mágicos: dos en 10, 14 y 18 de cualquier lista del Manual o Xanathar, incluidos trucos; **están incluidos** en el total de conocidos. Conocimiento agrega dos en nivel 6 **fuera** del total. El validador y la interfaz distinguen ambas cuotas; los trucos de Secretos no ocupan cupos de trucos ordinarios.
- Sustituir un Secreto posteriormente exige la lista de Bardo, conservando su plaza ordinaria/adicional. Los Secretos usan Carisma y cuentan como conjuros de Bardo, incluidos sus rituales.
- Ritual: conocido de Bardo con descriptor ritual, a nivel base, sin espacio y con 10 minutos adicionales. Armadura/escudo sin competencia bloquean el lanzamiento. Iniciado en Magia de Bardo conserva el lanzamiento gratuito y permite además gastar espacios con el conjuro de nivel 1, sin ocupar una plaza de conocidos de clase.
- Nombres y descripciones españoles de los catálogos existentes. El PDF de Xanathar aportado identifica una traducción de aficionados, no una traducción editorial oficial.

## Ficha y recursos

- Polivalente aplica media competencia redondeada hacia abajo a habilidades sin competencia, pruebas de característica e iniciativa. No duplica media competencia ni afecta ataques/salvaciones.
- Inspiración usa CAR (mínimo uno), d6/d8/d10/d12 en 1/5/10/15. Recupera con descanso largo, y corto desde Fuente de Inspiración en nivel 5.
- Panel de inspiración con reserva compartida para inspiración ordinaria, Palabras Hirientes, Habilidad Incomparable, Manto de Inspiración, Ademán de Cuchilla y Cuchillas Psíquicas. Ademán del Maestro permite d6 sin gastar reserva desde Espadas 14. Inspiración Superior recupera exactamente un uso al confirmar iniciativa sin usos en nivel 20.
- Dados y umbrales correctos de Canción de Descanso, Cuchillas Psíquicas y PG temporales de Manto de Inspiración. Los demás rasgos con usos propios tienen contadores y recuperación por descanso.
- Historial idempotente de acciones; gastos y descansos/ascensos concurrentes producen conflicto explícito en vez de combinar recursos inconsistentes. Cambios independientes de nombre pueden combinarse.

## Resolución en mesa

La aplicación no conoce posiciones, turnos ni fichas objetivo de otras criaturas. El usuario confirma alcance, objetivo y límites por turno/ronda antes de gastar inspiración. Tirar el dado no gasta otro uso. Inspirar concede el dado al aliado; la tirada se realiza cuando ese aliado lo use, no al concederlo.

Se resuelven en mesa: efectos sobre objetivos, Contraoda, Canción de Descanso (una curación adicional al gastar al menos un Dado de Golpe durante descanso corto), ataques adicionales, inspiración de combate, Magia de Batalla, ademanes y sus bonos temporales/movimiento, encantamientos, miedo y disfraces. **Manto de Majestad** requiere concentración y dura un minuto; su contador no concede Orden Imperiosa permanentemente ni simula turnos/concentración. **Manto de Susurros** requiere registrar y consumir la sombra, y controlar la hora de disfraz en mesa; su contador limita capturas entre descansos. Los textos de todos estos rasgos incluyen sus restricciones y finalizaciones.

## Fuentes y validación

- PDF del Manual aportado: páginas PDF 36–39 (Bardo); tablas compartidas de equipo/conjuros.
- PDF de Xanathar aportado: páginas PDF 15–18, colegios y rasgos.
- [Erratas oficiales PHB](https://media.wizards.com/2021/dnd/downloads/PH-Errata.pdf): Secretos puede mezclar clases; Canción de Descanso exige gastar Dados de Golpe.
- [Sage Advice Compendium](https://media.wizards.com/2020/dnd/downloads/SA-Compendium.pdf): sustitución de Secretos por la lista de Bardo y condiciones de Palabras Hirientes.

Pruebas: progresión de los cinco colegios en cada nivel; las 270 combinaciones raza/trasfondo con cada colegio; cuotas y sustituciones de Secretos; pericias, competencias, equipo/oro, Polivalente, recursos/descansos, rituales, persistencia, reintentos y conflictos. Pruebas de interfaz con el tutorial real para crear los cinco colegios, exclusión de duplicados y panel de juego/lanzamiento ritual. La validación de interfaz usa happy-dom; no sustituye una inspección visual dentro de TaleSpire.

Cobertura actual: siete clases. Restan Druida, Explorador, Hechicero, Monje y Paladín; multiclase y adopción de fichas manuales siguen pendientes.
