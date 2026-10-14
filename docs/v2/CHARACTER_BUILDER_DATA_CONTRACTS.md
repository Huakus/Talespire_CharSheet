# Datos del generador de personajes: diseño propuesto

> Estado ampliado al 14/10/2026: Clérigo y opciones de Xanathar para las cuatro
> clases disponibles. La cobertura actual y las correcciones posteriores se documentan en
> [Clérigo y Xanathar](CLERIC_XANATHAR_IMPLEMENTATION.md). Los recuentos PHB de esta
> entrega anterior describen su alcance original.

Estado al 14 de octubre de 2026: este documento conserva la propuesta general
para todas las clases. El contrato ejecutable de Guerrero, Mago y Brujo está
en `src/domain/character/character-builder-model.ts`; su integración v2 y sus
límites se describen en [Guerrero](CHARACTER_BUILDER_IMPLEMENTATION.md) y
[Mago](WIZARD_BUILDER_IMPLEMENTATION.md). Los tipos compartidos aún conservan
nombres `FighterCreation` y `FighterLevelChoice`, con `classKey` y campos de Mago.
El estado diario del Mago se conserva en `spellcasting.wizard` dentro del
fragmento de recursos existente. No se agregaron tablas ni migraciones remotas.
Brujo usa `spellcasting.warlock` y las elecciones `warlock` del mismo historial;
su contrato vigente se documenta en [Brujo](WARLOCK_BUILDER_IMPLEMENTATION.md).
La propuesta v3, multiclase y el motor declarativo general no se desplegaron.

Fecha: 12 de octubre de 2026. Etapa: planificación; no implementado.
Alcance confirmado: Manual del Jugador 2014.

Referencias: [arquitectura](CHARACTER_BUILDER_ARCHITECTURE.md) y
[matriz de elecciones](PHB_2014_CHOICE_MATRIX.md).
Los nombres de campos de este documento son propuestas concretas para la
implementación posterior, no formatos que el programa actual ya acepte.

## 1. Explicación para el jugador

La aplicación tiene que recordar tres cosas diferentes:

1. Qué reglas usa la mesa y qué opciones existen.
2. Qué eligió el jugador al crear el personaje y en cada subida.
3. Qué le está pasando ahora: vida, condiciones, equipo y recursos gastados.

Con eso puede mostrar una ficha completa, explicar sus números y presentar las
preguntas correctas en el próximo ascenso. Cambiar un preparado o gastar un
recurso no cambia el historial de cómo se construyó el personaje.

### Guerrero que pasa de nivel 4 a 5

Ejemplo sin beneficios adicionales de PG, Constitución 14 y PG máximos previos 36.
Si se usa el valor fijo, adquiere 6 + 2 = 8 PG máximos y un dado d10. El nuevo
máximo es 44. Ataque Extra es una concesión automática: no necesita elegirlo.
No hay una mejora de atributos de guerrero en este nivel.
Fuente: [guerrero de 2014](https://www.dndbeyond.com/classes/10-fighter).

Propuesta de comportamiento: si tenía 18 PG actuales, la subida conserva 18;
no hace un descanso ni restaura recursos. Una regla de mesa diferente puede
configurarse explícitamente, pero el asistente debe explicar el cambio.

### Mago que pasa de nivel 2 a 3

El asistente abre las plazas de los dos nuevos conjuros para el libro. La
preparación se guarda aparte: estar en el libro no significa estar preparado.
Una copia de conjuro conseguida durante la aventura tampoco se confunde con
esas dos plazas obtenidas al subir.
Fuente: [mago de 2014](https://www.dndbeyond.com/classes/8-wizard).

### Clérigo 1 / Mago 2

El historial conserva cuál fue la clase inicial y el orden de los tres niveles.
La ficha tiene dados de golpe d8 y d6; la magia de clérigo usa Sabiduría y la de
mago, Inteligencia. Los dos orígenes mantienen sus selecciones independientes,
aunque puedan compartir el fondo ordinario de espacios.
Fuente: [multiclase de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options).

Esto es lo que resuelven los contratos siguientes; no exige que el usuario
elija nombres de campos ni diseñe estructuras técnicas.

## 2. Decisiones técnicas propuestas

| Decisión | Propuesta |
| --- | --- |
| Plataforma | Conservar TypeScript, Zod, Vite, TaleSpire y el repositorio actual |
| Formato del personaje | Diseñar v3 con lectura explícita de v2; impedir escritura de clientes incompatibles |
| Fuente de nivel/clase | Secuencia de niveles; total y resumen por clase se calculan |
| Fuente de atributos | Valores iniciales y contribuciones identificadas; finales calculados |
| Fuente de reglas | Paquete PHB 2014 publicado con versión fija y referencias estables |
| Ficha calculada | Resultado del motor; no un segundo registro editable de los mismos beneficios |
| Estado de partida | Datos persistidos separados de construcción y progresión |
| Borrador | Persistente, reanudable y separado de la ficha en uso |
| Confirmación | Una operación atómica con identificador para evitar duplicaciones |
| Fichas existentes | Base manual o parcial conservada; reconstrucción asistida cuando hay información |
| Cambios manuales | Datos manuales o ajustes con motivo; no sobrescribir resultados calculados sin procedencia |

La v3 es una recomendación de formato, no un cambio aplicado. La elección
evita presentar varios fondos de magia/dados como si fueran el único fondo de v2.
Las versiones de formato, motor, reglas y concurrencia tienen funciones distintas.

## 3. Identidad y referencias

### Referencias de contenido

`DefinitionRef = { key: string, version: positiveInteger }`.
`key` es una clave de catálogo estable, por ejemplo `phb-2014/class/fighter`.
`version` identifica una revisión mecánica inmutable, no la revisión de edición
de una fila ni el año de publicación.

`RulesLock = { ruleset, engineVersion, packages[] }`, donde cada paquete contiene
`id`, `version` y `contentHash`. El manifiesto del paquete enumera las revisiones
de definición que incluye y sus dependencias. Toda referencia del personaje
debe resolverse en ese manifiesto o en una dependencia explícita.

El idioma y el nombre mostrado no cambian una referencia. Las actualizaciones
de paquetes se proponen con diferencias visibles; no alteran fichas al abrirlas.
Los formatos de fórmulas/efectos tienen versión y deben ser compatibles con el motor.

### Identidades de instancia

Los IDs de personajes, niveles, decisiones y adquisiciones siguen el patrón de
`src/shared/id.ts`. Las claves de contenido no están sujetas a ese patrón.
Los IDs de concesiones se derivan de personaje, fuente, instancia y clave de
concesión. Recalcular produce los mismos IDs y conserva sus estados de uso.

## 4. Contrato de contenido: qué concede cada opción

`ContentDefinition` contiene:

| Campo | Tipo / significado |
| --- | --- |
| `schemaVersion` | Versión del contrato de definición |
| `ref` | `DefinitionRef` |
| `kind` | Clase, subclase, raza, subraza, trasfondo, dote, rasgo, opción, conjuro o equipo |
| `ruleset` | `dnd5e-2014` |
| `labels` | Nombre/explicación por idioma |
| `source` | Publicación, localizador y revisión/errata cotejada |
| `prerequisites` | Condiciones tipadas, no código arbitrario |
| `grants` | Concesiones iniciales o condicionales |
| `progression` | Eventos por nivel total o de clase, según la definición |
| `coverage` | Verificación de reglas y cobertura de construcción/uso |

Variantes por tipo añaden datos propios. Clase: dado, competencias iniciales/de
multiclase, equipo, subclase y magia. Subclase: clase compatible. Dote:
repetibilidad y requisitos. No usar una bolsa de JSON sin validación para todas
las mecánicas diferentes.

### Concesiones y efectos

`GrantDefinition` tiene `key`, `when`, `dependencies` y una variante tipada:
competencia, rasgo, elección, efecto, acción, recurso, acceso a magia, equipo
inicial o plantilla auxiliar. Una concesión puede producir varios efectos.

El vocabulario de efectos debe cubrir sumas, fórmulas alternativas, concesiones,
resistencias/inmunidades, sentidos, velocidades, dados y estados condicionados.
Cada efecto declara objetivo, operación, valor/fórmula, condiciones y política
de combinación. No deducir la operación a partir del texto traducido.

Las fórmulas son árboles limitados: constantes, atributos/modificadores, niveles,
competencia, operaciones aritméticas, límites y tablas. Requisitos: todos/alguno,
comparación o presencia de una concesión. No se permite `eval` ni JavaScript
publicado desde un catálogo.

Una mecánica fuera del vocabulario requiere un evaluador identificado en el
motor o cobertura manual declarada. La validación detecta referencias faltantes,
ciclos, condiciones inválidas y fórmulas fuera de límites.

## 5. Contrato de elección: la pregunta y la respuesta

La definición de la pregunta y la respuesta del jugador son objetos distintos.
Requisitos y cantidades pertenecen a las reglas; el jugador guarda su respuesta.

`ChoiceDefinition` contiene:

- `key`, `phase` y `trigger`: dónde aparece y cuándo se permite resolverla.
- `answerKind`: seleccionar opciones, asignar atributos, distribuir presupuesto,
  resolver paquete de equipo, registrar tirada o sustituir selección.
- `quota`: cantidad o presupuesto; con nombre del fondo/cuota al que pertenece.
- `candidates`: referencias o filtros tipados sobre un conjunto autorizado.
- `dependencies`, `duplicatePolicy` y `replacementPolicy`.
- `grantTemplates`: beneficios producidos por las respuestas válidas.

`ResolvedQuestion`, calculado y no autoritativo, contiene candidatos, razones de
inelegibilidad, plazas pendientes y explicación. No persistir su lista completa
de candidatos en cada respuesta.

`Decision` tiene ID, referencia de pregunta, instancia/origen y una respuesta
tipada. Una selección produce plazas con IDs estables; cada plaza conserva las
restricciones de su concesión. Una sustitución apunta a la plaza original,
guarda el nuevo valor y mantiene la respuesta anterior en el historial.

El presupuesto de sustituciones se mide por operación y fuente. Volver atrás
en el borrador no agrega otro presupuesto. Reemplazar una plaza no la convierte
en una plaza de otra categoría ni elimina las elecciones que dependen de ella.

## 6. Contrato de construcción y progresión

Estructura lógica propuesta de `CharacterV3`:

| Bloque | Contenido autoritativo |
| --- | --- |
| Identidad/presentación | ID, nombre, jugador/asignación, apariencia y preferencias de presentación |
| `build` | Reglas fijadas, origen racial/trasfondo, atributos iniciales y decisiones iniciales |
| `advancement` | Secuencia de niveles y decisiones adquiridas en cada uno |
| `acquisitions` | Beneficios aprendidos/recibidos durante la aventura, fuera de los ascensos |
| `overrides` | Excepciones identificadas, con motivo, autor y alcance |
| `runtime` | Estado actual de partida |
| Colecciones de juego | Inventario, moneda, notas, contenido manual y criaturas auxiliares |
| `legacyBaseline` | Información heredada cuando falta reconstruir el historial |
| Versiones | Formato, revisión de construcción, revisión del personaje y fechas |

`build.initial` guarda las referencias de raza, subraza y trasfondo, y
`abilityGeneration`: método y sus evidencias. El método distingue valores
asignados, compra de puntos y tiradas; conserva dados/resultados y asignación
cuando corresponda. Los aumentos raciales o de dotes no se suman dentro del valor inicial.

`advancement.steps[]` es una secuencia consecutiva de 1 al nivel actual. Cada
`LevelStep` contiene ID, ordinal de nivel total, `classRef`, adquisición de PG
y decisiones. El nivel de clase es el número de apariciones de esa clase hasta
ese paso. Subclase y dotes se resuelven desde las decisiones, no se mantienen
en una segunda lista editable independiente.

`HitPointAcquisition` distingue primer nivel, valor fijo, tirada y excepción.
Guarda el resultado base y evidencia si hubo tirada. El cálculo de máximos usa
historial y contribuciones de Constitución/rasgos con sus reglas retroactivas;
no suma un aumento de Constitución dos veces ni ignora los límites de adquisición.

`Acquisition` tiene ID, fecha, tipo, contenido/origen y evidencia: por ejemplo,
un conjuro copiado al libro. No consume plazas de aprendizaje de un ascenso.
Las concesiones elegidas durante un descanso se guardan en el estado de partida.

`Override` indica si añade, reemplaza o suprime un beneficio, su objetivo estable,
valor, motivo y autor. No modifica silenciosamente la definición del catálogo.
La aplicación debe separar «elecciones completas», «reglas verificadas» y
«automatización disponible». Una excepción autorizada sigue siendo una excepción.

### Base de una ficha existente

`LegacyBaseline` contiene nivel de referencia, valores/colecciones conservados,
atributos de referencia y cobertura por dominio (`manual`, `partial`, `derived`).
La parte de PG registra máximo de referencia, nivel y modificador de Constitución
conocido. Una atribución desconocida se marca como tal; no se fabrica una tirada.

La adopción debe identificar qué beneficios ya están incluidos en esa base.
Al resolver un dominio, se sustituye su base manual por sus contribuciones
reconstruidas; no se agregan estas sobre el valor final heredado. Si el origen
de un beneficio sigue ambiguo, ese dominio permanece parcial y muestra la
diferencia propuesta. Para un ascenso asistido deben estar identificados los
niveles por clase y las elecciones previas de las que depende la nueva elección.
El usuario puede completar esa información sin tener que reconstruir todos
los aspectos independientes de la ficha.

## 7. Contrato de estado de juego

### Recursos

`ResourceDefinition` fija capacidad, origen, costes y recuperación.
`ResourceState` guarda gasto o estado, identificado por la concesión estable.
Variantes: contador, fondo de dados, resultados de dados conservados, usos por
objetivo y disponibilidad ilimitada. Cada variante tiene validación propia.

Un cambio de capacidad no reinicia el gasto. Para contadores, la disponibilidad
es `max(0, capacidad - gasto)`. Si un ajuste reduce la capacidad por debajo del
gasto registrado, se conserva ese gasto y no se permiten nuevos consumos;
una recuperación válida o corrección explícita puede resolverlo. Este contrato
amplía la restricción de v2 que exige `used <= maximum`.

Los dados de golpe se agrupan por tamaño, con gasto por fondo. La recuperación
necesita un presupuesto global y asignación entre fondos, no recuperar por
separado el máximo permitido en cada uno.

### Vida y condiciones

PG máximos calculados; PG actuales y temporales persistidos. Política propuesta
para subir: conservar PG actuales, limitar a un máximo reducido cuando proceda,
conservar temporales/condiciones y no ejecutar recuperación. Si la mesa desea
otra política se guarda como configuración y se muestra en la vista previa.

### Magia

`SpellcastingSource` define origen, atributo, listas, cuotas, rituales y modalidad
de acceso. Es una concesión calculada, no el único atributo global de v2.
`SpellGrant` identifica conjuro, origen y modo: conocido, libro, siempre preparado,
ritual, a voluntad o uso propio. Se deriva de decisiones/adquisiciones.

`PreparedSelection` guarda IDs de concesiones elegibles por fuente. Conocer el
mismo conjuro desde dos fuentes no pierde sus atributos ni condiciones de uso.
La UI puede agrupar el nombre, pero lanzar exige resolver el origen y recurso.

`SpellPool` distingue espacios ordinarios compartidos, pacto y usos especiales.
Cada fondo conserva consumo y recuperación. Las conversiones y cruces permitidos
son operaciones explícitas, no movimientos arbitrarios entre fondos.

### Equipo y contenido manual

La entrega de equipo inicial se registra una vez por concesión/operación. Luego
inventario y moneda son estado de juego: vender o consumir un objeto no hace
que reaparezca al recalcular el personaje. Los objetos recibidos durante la
aventura conservan su procedencia sin convertirse en elecciones iniciales.

Acciones y rasgos generados se proyectan con IDs estables. Los manuales se
persisten con origen `manual`. Una corrección de un generado usa un ajuste
explícito. Las criaturas auxiliares conservan tanto plantilla/origen como su
estado actual; cambiar de forma no crea un ascenso.

## 8. Ejemplos de datos

Ejemplos parciales ilustrativos; no son fichas completas ni JSON importable por
la aplicación actual. Los IDs de instancia mostrados respetan el patrón existente.

### Adquisición del quinto nivel de guerrero

```json
{
  "id": "lvl_00000000000000000000000000000005",
  "characterLevel": 5,
  "classRef": { "key": "phb-2014/class/fighter", "version": 1 },
  "hitPoints": { "method": "fixed", "base": 6 },
  "decisions": []
}
```

El motor resuelve clase 5, Constitución del personaje, Ataque Extra y demás
beneficios. No se guardan copias editables de `classLevel` o del PG final aquí.

### Dos orígenes de lanzamiento en el multiclase

```json
{
  "spellcastingSources": [
    {
      "id": "src_00000000000000000000000000000001",
      "classKey": "phb-2014/class/cleric",
      "ability": "wisdom",
      "accessMode": "prepared-list"
    },
    {
      "id": "src_00000000000000000000000000000002",
      "classKey": "phb-2014/class/wizard",
      "ability": "intelligence",
      "accessMode": "spellbook"
    }
  ]
}
```

Este segundo ejemplo es parte de la proyección, no un segundo historial
autoritativo. Los dados y los espacios se resuelven en sus fondos correspondientes.

## 9. Borrador y confirmación

`BuilderDraft` contiene ID, usuario/campaña, operación (`create`, `level-up` o
`adopt`), personaje destino cuando exista, construcción candidata, progreso
visual, `rulesLock` y versiones base de construcción/configuración.
La posición visual del tutorial no representa un beneficio adquirido.

Cada respuesta se guarda en el borrador y recalcula preguntas/pendientes.
Al confirmar: resolver referencias, validar respuestas y requisitos, calcular
beneficios, cargar estado actual, generar diferencias y aplicar la operación
completa con una clave de idempotencia.

Si cambiaron decisiones o reglas de campaña desde la base, reconstruir el
borrador y pedir revisión de las diferencias concretas. Si cambiaron solo PG o
gasto de recursos, incorporar el estado reciente y conservarlo; no restaurar
la copia antigua del borrador. La transacción compara las versiones finales
observadas y vuelve a revisar si hubo cambios durante la confirmación.

No fusionar automáticamente dos intentos de adquirir el mismo próximo nivel.
No repetir entrega de equipo ni ascenso si el usuario reintenta una operación
que ya se confirmó. Los borradores incompletos no entran en la lista de fichas
jugables como si fueran personajes terminados.

## 10. Integración y compatibilidad

Mapa lógico de persistencia propuesto, sin crear tablas ni migraciones:

| Información | Ubicación prevista |
| --- | --- |
| Definiciones/versiones | Catálogo de contenido y revisiones publicadas |
| Configuración | Configuración versionada de campaña |
| Construcción inicial | Fragmento `character-build` |
| Nivel adquirido | Fragmento `character-level-step` por paso |
| Adquisición en aventura | Fragmento `character-acquisition` por adquisición |
| Ajuste explícito | Fragmento `character-override` por ajuste |
| Recursos | Fragmentos `character-resource` por fondo/recurso |
| PG y condiciones | Estado de partida del personaje |
| Preparación y elecciones de descanso | Estado de partida con referencias de origen |
| Inventario/notas/manuales/extras | Colecciones existentes adaptadas con procedencia |
| Borrador | Almacenamiento separado por usuario/campaña |

Los nombres de fragmentos propuestos no están todavía admitidos por los
contratos TypeScript/SQL. Su futura incorporación requiere adaptar ensamblado,
fragmentación, restricciones, importación/exportación y conflictos en conjunto.
La ficha calculada puede tener caché, pero no una colección autoritativa de
copias de todos los efectos; los consumos se conservan por ID de concesión.

La importación de v2 comprueba primero su checksum original. Preserva los datos
manuales, convierte lo inequívoco y conserva la base heredada cuando falta
historial. No deduce elecciones pasadas de atributos finales. Los respaldos
anteriores se mantienen accesibles; la adopción muestra diferencias antes de guardar.

Orden futuro de transición: lectores v3 capaces de importar v2; persistencia
compatible; control de versión mínima de escritura; adopción optativa y
activación del asistente. Un cliente v2 no debe cargar y guardar una v3 eliminando
sus campos desconocidos. No se modifica automáticamente una ficha al abrirla.

## 11. Verificación prevista

Para la implementación posterior, comprobar al menos:

- Selección de subclase y cada ASI en el nivel de clase correcto.
- Dos reconstrucciones producen las mismas concesiones e identidades.
- Sustituir una selección conserva restricciones y presupuesto del evento.
- Una competencia duplicada no se convierte en pericia.
- Magia racial/de dote no consume plazas de clase sin que la regla lo indique.
- Libro, preparación y lista elegible son distintos.
- Cambios de capacidad no recuperan recursos gastados.
- Multiclase conserva varios dados y atributos de lanzamiento.
- Equipamiento vendido no se entrega otra vez.
- Confirmación repetida no duplica nivel ni beneficios.
- Cambios simultáneos de partida se conservan o fuerzan revisión explícita.
- Lectura/adopción/exportación preserva contenido manual y datos no reconstruidos.

## 12. Qué queda después de este diseño

Los contratos técnicos quedan propuestos aquí sin trasladar su diseño al usuario.
Las decisiones de mesa (dotes, multiclase, método de atributos/PG y excepciones)
seguirán siendo controles de configuración del GM, no obstáculos para definir
las estructuras del programa.

Antes de declarar listo el paquete PHB faltan los cotejos de contenido señalados
en la matriz y los inventarios de raza, trasfondo, dotes y equipo. Ese trabajo
puede avanzar junto con el motor; una opción solo se habilita como verificada
cuando sus reglas y referencias están completas. El tutorial visual se construye
sobre estas preguntas y conserva los estados de cobertura.
