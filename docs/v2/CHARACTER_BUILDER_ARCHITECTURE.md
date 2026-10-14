# Asistente de personajes de 5e 2014: propuesta de arquitectura

> Estado ampliado al 14/10/2026: Clérigo y opciones de Xanathar para las cuatro
> clases disponibles. La cobertura actual y las correcciones posteriores se documentan en
> [Clérigo y Xanathar](CLERIC_XANATHAR_IMPLEMENTATION.md). Los recuentos PHB de esta
> entrega anterior describen su alcance original.

Entregas implementadas: [Guerrero y sus tres arquetipos](CHARACTER_BUILDER_IMPLEMENTATION.md)
y [Mago y sus ocho escuelas](WIZARD_BUILDER_IMPLEMENTATION.md), además de
[Brujo y sus tres patrones](WARLOCK_BUILDER_IMPLEMENTATION.md), de nivel 1 a 20.
El resto de esta arquitectura describe el objetivo completo y las etapas pendientes.

Estado: propuesta para discusión, 12 de octubre de 2026. No implementada.
Este documento no autoriza migraciones, modificaciones de personajes ni cambios remotos.

Documento complementario: [matriz de elecciones del Manual del Jugador 2014](PHB_2014_CHOICE_MATRIX.md).
Inventaría las 12 clases y 40 subclases, sus disparadores de elección y los
pendientes de verificación de reglas. Es una base de planificación; todavía no
constituye un catálogo mecánico completo ni validado para ejecución.

Diseño concretado: [contratos de datos y ejemplos](CHARACTER_BUILDER_DATA_CONTRACTS.md).
Propone las estructuras de contenido, decisiones, progresión, estado de partida
y compatibilidad con v2. Continúa siendo documentación, no implementación.

## 1. Objetivo y significado de cobertura

Permitir crear personajes mediante un tutorial, iniciar en cualquier nivel del
rango ordinario 1–20 y reutilizar el mismo sistema para subir de nivel.
El usuario definió el catálogo inicial: **solo el Manual del Jugador 2014**.
La primera versión debe cubrir sus combinaciones de clase, raza, trasfondo y
progresión, incluidas las reglas opcionales que habilite el GM.
Los contratos deben poder extenderse después a suplementos compatibles y
contenido personalizado, sin exigir sus catálogos ni editores en esta etapa.

### Alcance de la primera versión

| Contenido | Cobertura prevista |
| --- | --- |
| Clases y subclases del manual | Todas sus progresiones y elecciones necesarias para construir la ficha |
| Razas y subrazas del manual | Rasgos, aumentos, idiomas y elecciones; variantes disponibles según configuración |
| Trasfondos del manual | Competencias, equipo, rasgo, personalidad y personalización permitida por sus reglas |
| Dotes y multiclase | Soportadas como opciones habilitables por el GM |
| Opciones de clase | Estilos, maniobras, invocaciones, metamagia, pactos y demás elecciones del manual |
| Conjuros y equipo del manual | Selección y concesión según cada origen, nivel y alternativa inicial |
| Generación y avance | Métodos de atributos, PG, equipo y progresión contemplados por el manual |

La matriz detallada deberá identificar cada opción y su cobertura de construcción,
validación y uso durante la partida. Cubrir el manual completo no se demuestra
solo con una lista de clases o con el subconjunto del SRD.

Quedan para una fase posterior los suplementos, reglas de 2024 y publicación de
contenido personalizado. La limitación inicial corresponde a nuevas selecciones
del asistente; las fichas manuales existentes conservan su contenido, aunque
incluya opciones fuera del catálogo inicial.

Hay tres compromisos diferentes:

- **Representación:** guardar una opción y sus elecciones sin perder información.
- **Validación:** comprobar requisitos, cantidades y compatibilidad con la campaña.
- **Automatización:** producir los resultados mecánicos correspondientes.

En una ampliación futura, una opción personalizada puede estar representada sin tener todas sus mecánicas
automatizadas. Cada definición debe declarar esa cobertura. La interfaz debe
mostrar los pendientes concretos; no presentar un personaje como verificado
cuando una regla todavía necesita resolución manual.

El tutorial debe explicar las elecciones y sugerir alternativas, pero permitir
al jugador decidir. Su funcionamiento no necesita un servicio de IA.

## 2. Base actual y cambios necesarios

La evaluación se basa en el código local, sin consultar ni modificar datos de
campaña remotos o `.localstorage/`.

| Área | Estado actual | Cambio propuesto |
| --- | --- | --- |
| Identidad | Clase, subclase, raza, subraza y trasfondo son textos | Referencias a definiciones versionadas; textos como etiquetas de presentación y compatibilidad |
| Nivel | Un número total | Secuencia de niveles y clase adquirida en cada uno; total y niveles por clase derivados |
| Atributos | Seis valores finales | Valores iniciales, método de generación y contribuciones de raza, elecciones, dotes y excepciones |
| Competencias | Listas y multiplicadores finales | Concesiones con origen; elecciones de reemplazo y pericia explícita |
| Dados de golpe | Un tamaño y un máximo | Fondos por tipo de dado, con máximos derivados y gasto separado |
| Magia | Una característica global y espacios por nivel | Orígenes de magia, aprendizaje y preparación independientes; fondos de espacios y usos propios |
| Rasgos | Texto, usos y un ajuste genérico por rasgo | Definiciones reutilizables con varios efectos, progresión, elecciones y recursos |
| Efecto activable | Descripción y bandera activa | Conservar el texto; añadir efectos mecánicos tipados donde corresponda |
| Catálogo | Conjuros, equipo, monstruos, tiendas y checklist | Clases, subclases, razas, subrazas/linajes, trasfondos, dotes, rasgos y opciones |
| Borradores | Valores de formularios en memoria | Borrador persistente del asistente, con revisión base y catálogo fijado |
| Persistencia | Fragmentos con revisiones y lote transaccional | Extender los fragmentos, preservar la transacción y revisar conflictos de progresión |
| Autoría | Roles de campaña; personaje sin propietario explícito en el dominio | Decidir asignación y permisos sobre personajes y borradores |

Referencias locales: `src/domain/character/character-v2.ts`,
`character-spell-model.ts`, `character-content-model.ts`,
`character-effect-model.ts`, `src/domain/content/campaign-content.ts`,
`src/ui/form-draft-store.ts`, `src/infrastructure/remote/campaign-fragments.ts`.

## 3. Separación de responsabilidades

```text
Paquetes y definiciones + configuración de campaña
                         ↓
             Motor de reglas y elecciones
                         ↑
           Decisiones e historial del personaje
                         ↓
            Resultado calculado con procedencia
                         +
             Estado actual de juego y excepciones
                         ↓
          Ficha, tutorial y vista previa de cambios
```

Conservar TypeScript, Zod, Vite, TaleSpire y Supabase. No aparece una necesidad
de cambiar de framework ni de proveedor. Sí hace falta separar el nuevo
asistente de `browser-app.ts` para que las reglas no dependan del DOM.

El motor debe ser determinista y funcionar con un conjunto local de datos.
Supabase almacena y sincroniza; TaleSpire aporta integración y tiradas.
La confirmación puede validar permisos y revisiones en servidor. Si se requiere
validación autoritativa de reglas, debe ejecutar el mismo motor versionado,
en lugar de reescribir sus reglas en SQL.

## 4. Modelo de contenido

### Paquetes y versiones

Introducir paquetes de contenido con identificador estable, versión, fuente,
idioma, sistema compatible, dependencias y catálogo de definiciones.
Separar explícitamente:

- Sistema de reglas: `dnd5e-2014`.
- Publicación y fecha del libro o suplemento.
- Edición/errata de la definición y versión del paquete.
- Idioma de presentación.
- Procedencia y condiciones de distribución del contenido incluido.

El año de publicación no decide por sí solo si algo es compatible con 2014.
Actualmente el filtro de conjuros de player compara `year` con `2014`; debe
revisarse junto con la importación, sin reinterpretar valores heredados a ciegas.

Cada referencia del personaje fija identificador y versión de la definición.
Renombrar una opción no cambia su identidad. Publicar una nueva versión no
modifica personajes existentes. Retirar contenido del catálogo activo impide
nuevas selecciones pero conserva el material necesario para leer los existentes.
Propuesta: revisiones publicadas inmutables y exportación del subconjunto de
definiciones usado por cada personaje, evitando duplicar el catálogo completo.

### Definiciones

Tipos previstos:

- Clase: dado de golpe, requisitos, competencias iniciales y de multiclase,
  equipo inicial, progresión 1–20, magia y momento de elegir subclase.
- Subclase: clase compatible, progresión, rasgos y listas/elecciones adicionales.
- Raza y subraza/linaje: tamaño, movimiento, sentidos, atributos, idiomas,
  competencias y beneficios iniciales o progresivos.
- Trasfondo: competencias, herramientas/idiomas, equipo, rasgo y personalización.
- Dote: requisitos, repetibilidad, elecciones y efectos.
- Rasgo: texto, condiciones, concesiones, efectos, acciones y recursos.
- Opción: estilo de combate, invocación, metamagia, maniobra, pacto u otra
  alternativa seleccionable, referenciable desde distintas fuentes.
- Conjuro y equipo: ampliar sus contratos actuales para procedencia y versiones.

Las definiciones describen reglas, no solo párrafos. Los textos traducidos no
deben usarse como identificadores ni como instrucciones ejecutables.

### Elecciones y condiciones

Un contrato común debe permitir elegir una o varias opciones, distribuir puntos,
asignar valores, registrar una tirada, seleccionar paquetes de equipo, cambiar
una selección previa o conceder automáticamente una opción.

Cada elección especifica cantidad, candidatos, requisitos, nivel de aparición,
dependencias, duplicados permitidos y regla de sustitución. Las opciones pueden
abrir nuevas elecciones. Cambiar una selección previa exige volver a validar
sus dependencias y mostrar qué se invalida antes de confirmarlo.

Usar condiciones y fórmulas tipadas: nivel total, nivel de clase, modificador,
competencia, sumas, mínimos/máximos y tablas. No aceptar JavaScript arbitrario
en contenido de campaña. Las mecánicas que excedan ese lenguaje necesitan un
evaluador registrado en el motor o una excepción manual identificada.

## 5. Modelo del personaje

### Construcción e historial

Propuesta conceptual de bloques, cuyos nombres definitivos siguen abiertos:

| Bloque | Responsabilidad |
| --- | --- |
| `build` | Sistema, versiones de contenido, raza, trasfondo, generación de atributos y elecciones iniciales |
| `advancement` | Secuencia de niveles; clase, elecciones, tirada/valor base de PG y sustituciones en cada ascenso |
| `overrides` | Excepciones explícitas con motivo, autor y alcance |
| `projection` | Valores calculados y explicación de sus contribuciones; caché opcional, no segunda fuente independiente |
| `runtime` | PG actuales/temporales, recursos gastados, condiciones, preparación y otros estados de juego |

Registrar las decisiones, no cada clic del tutorial. Cada elección necesita
identificador de instancia, origen, nivel, definición versionada y resultado.
El orden de clases importa: clase inicial y primer nivel de una clase adicional
conceden beneficios diferentes. El nivel total se deriva de la secuencia.

Los aumentos de atributos deben conservar su origen. Para PG, guardar el valor
base adquirido en cada nivel permite recalcular cambios de Constitución sin
sumarlos dos veces. Los PG máximos y los actuales son conceptos separados.
Si cambia un máximo, debe existir una política explícita sobre el estado actual;
subir de nivel no debe equivaler automáticamente a descansar.

### Magia, recursos y entidades generadas

Un personaje puede tener varios orígenes de magia: clases, raza, dotes y objetos.
Cada origen indica característica, CD/ataque, acceso a listas, cantidades,
aprendizaje, preparación, rituales y restricciones.

Separar lista disponible, conjuros conocidos, libro, preparados y siempre
preparados. Ampliar la lista elegible no implica aprender ni preparar todo.
Si el mismo conjuro proviene de dos fuentes, conservar ambas concesiones y sus
condiciones de lanzamiento aunque la UI pueda agrupar su presentación.

Los espacios ordinarios compartidos, la Magia de Pacto y los usos de rasgos u
objetos requieren fondos diferentes. Registrar nivel del espacio, capacidad,
gasto y recuperación; permitir cruces entre fondos solo cuando la regla lo
autorice. Arcanos y otros usos especiales no se representan como espacios
ordinarios por conveniencia.

Generalizar recursos de clase: ki, furia, puntos de hechicería, usos, dados de
maniobra, etc. Cada recurso tiene identidad, origen, capacidad, coste y descanso
de recuperación. Conservar el gasto al recalcular su capacidad.

Cada acción, rasgo o elemento generado debe tener una identidad estable y
referencia a su concesión. Recalcular no vuelve a añadir equipo inicial, oro,
acciones ni rasgos. El equipo inicial se entrega una vez; luego el inventario
evoluciona mediante las operaciones de juego existentes.

Representar también compañeros, familiares y formas mediante plantillas
vinculadas cuando una opción los requiera. No se presupone automatizar toda su
operación de combate para que el asistente pueda registrar su selección.

## 6. Motor y asistente compartidos

Operaciones propuestas:

1. Resolver las definiciones y versiones habilitadas por la campaña.
2. Determinar concesiones automáticas y elecciones pendientes.
3. Comprobar candidatos y explicar cada requisito incumplido.
4. Aplicar una elección al borrador y reconciliar sus dependencias.
5. Calcular la ficha y su procedencia sin modificar datos persistidos.
6. Producir una vista previa del cambio respecto de la ficha vigente.
7. Validar y confirmar en una sola operación.

Creación en nivel alto reproduce las decisiones necesarias desde el primer
nivel hasta el objetivo. La interfaz puede agrupar preguntas y ofrecer valores
sugeridos, pero conserva la secuencia relevante de decisiones.

La subida de nivel agrega un paso a esa secuencia y presenta solo las elecciones
que corresponden. Las mejoras de atributos se disparan por la progresión de
cada clase; no asumir que todas siguen el mismo calendario.

El tutorial debe tener explicación breve, opciones con requisitos visibles,
resumen siempre disponible, navegación atrás/adelante, indicadores de pendientes
y reanudación. Los pasos se generan desde las elecciones disponibles; el orden
visual puede ser flexible aunque las dependencias estén controladas.

No es necesario implementar una simulación universal de combate para completar
la construcción: algunos rasgos pueden quedar registrados y explicados para
uso manual. La cobertura debe distinguir construcción y uso durante la partida.

## 7. Configuración de campaña y administración

Un perfil versionado de campaña debe fijar sistema, paquetes permitidos, reglas
opcionales, niveles iniciales, métodos de atributos, método de PG, equipo/riqueza
inicial y política de excepciones. Dotes y multiclase son decisiones de campaña.
Inicialmente este perfil habilita solo contenido del Manual del Jugador 2014.
En una ampliación, las variantes de suplementos deben identificarse
individualmente, sin activarse solo por importar un libro.

Para la primera versión se necesita configuración de campaña y un proceso de
carga/validación del paquete del manual. El editor/importador de contenido
personalizado, su vista previa y publicación por el GM quedan para una fase
posterior. Desde el inicio, una definición rota debe identificarse y explicar
sus errores, en lugar de desaparecer silenciosamente.

Recomendación de permisos a discutir: jugador crea y modifica sus borradores y
personajes asignados; GM configura reglas, publica contenido y autoriza
excepciones. La lectura de fichas puede seguir siendo compartida según la mesa.
En una fase posterior se pueden permitir propuestas de contenido del jugador
sin publicarlas automáticamente en el catálogo de campaña. La asignación de personajes debe ser explícita; el
texto `playerName` no sirve como autorización.

## 8. Persistencia y cambios de plataforma

### Catálogo

Extender los tipos de `campaign_content_entries`, los esquemas Zod, adaptadores,
importación/exportación y configuración de GM. Añadir un modelo de paquetes y revisiones
publicadas, más configuración de campaña. La estructura SQL exacta del catálogo
debe decidirse después de inventariar sus restricciones actuales en servidor;
esta revisión examinó contratos del repositorio, no el esquema remoto completo.

Propuesta: conservar el catálogo por campaña como vista de contenido habilitado
y agregar almacenamiento de versiones inmutables. No sustituir la revisión de
concurrencia de una fila por la versión mecánica de una definición: cumplen
propósitos diferentes.

### Personajes y borradores

Extender los fragmentos existentes con configuración de reglas, construcción,
pasos de progresión y excepciones. Mantener recursos gastados fuera del historial
de construcción. Adaptar fragmentación, ensamblado, checksums, respaldo local,
importación/exportación y sincronización.

Recomendación: borradores en almacenamiento separado, por usuario y campaña,
con tipo de operación, personaje destino, revisión base, versión del catálogo,
elecciones, progreso y versión del motor. Reanudar después de cerrar el Symbiote;
no publicar un personaje incompleto como ficha de juego. Caché local separada
de los datos de campaña; soporte offline para un borrador requiere también su
conjunto de definiciones. La confirmación remota requiere conexión.

### Confirmación y concurrencia

Crear o subir de nivel debe guardar historial, rasgos, magia, recursos y valores
afectados en una sola transacción. Revalidar personaje, políticas y versiones
utilizadas antes de confirmar. Una clave de operación evita aplicar el mismo
ascenso dos veces tras un reintento.

El lote transaccional actual sirve como base, pero su fusión genérica no debe
combinar automáticamente dos progresiones incompatibles. Si ambos clientes
intentan adquirir el mismo próximo nivel, se rechaza o reconstruye el borrador
con nueva vista previa. Cambios simultáneos de recursos deben conservarse o
provocar revisión explícita, nunca restaurar valores antiguos desde el borrador.

Los tipos nuevos requieren revisar restricciones SQL, RPC, semillas de estado,
políticas de acceso y eventos de sincronización. La autorización debe comprobarse
en servidor. RLS protege el acceso a filas; no reemplaza la validación de reglas
ni la comprobación transaccional de versiones.

## 9. Compatibilidad con fichas existentes

No es posible recuperar automáticamente todas las elecciones históricas a
partir de valores finales y texto libre. Por ejemplo, un 18 en Carisma no revela
atributos iniciales, aumentos, dotes ni bonificaciones de objetos.

Proponer tres estados de adopción:

- **Manual:** conserva íntegramente la ficha actual.
- **Parcial:** referencias y decisiones verificadas; faltantes y ajustes heredados visibles.
- **Verificado:** historial suficiente para la cobertura declarada.

La vinculación asistida sugiere coincidencias, solicita decisiones ambiguas y
muestra diferencias antes de guardar. No inventa tiradas ni elecciones pasadas.
Cuando falte el historial de PG, conservar un punto de partida documentado con
su nivel y Constitución de referencia, sin afirmar que se reconstruyó completo.

Decidir explícitamente el versionado del formato exportado y la compatibilidad
entre clientes antes de desplegar. Los lectores antiguos pueden descartar campos
que desconocen: se necesita una versión mínima de escritura o transición que
impida que borren la nueva información. Primero compatibilidad de lectura y
persistencia; luego activación del asistente.

## 10. Orden de trabajo y criterios de aceptación

| Fase | Entregable | Condición para avanzar |
| --- | --- | --- |
| 1. Alcance | Manual del Jugador 2014 confirmado; matriz de clases/subclases documentada; restantes inventarios pendientes | Definir la cobertura verificable de cada opción del manual |
| 2. Contratos | Propuesta concreta de datos documentada, con ejemplos de guerrero, mago y multiclase | Llevar los contratos a esquemas validados sin perder las distinciones de la matriz |
| 3. Motor | Validación, resolución de elecciones y proyección determinista | Recalcular sin duplicaciones y explicar cada resultado |
| 4. Persistencia | Borradores, versiones, transacción y compatibilidad | Reanudar, exportar, importar y resolver conflictos sin pérdida de información |
| 5. Configuración | Paquete validado del manual y perfil de reglas de campaña | Controlar variantes y opciones disponibles; editor personalizado diferido |
| 6. Tutorial | Creación y ascenso sobre el mismo motor | Cerrar todas las elecciones obligatorias y revisar cambios antes de guardar |
| 7. Adopción | Vinculación de fichas existentes | Conservar contenido manual y señalar lo que sigue sin verificar |

Validación mínima: clase marcial simple; mago con libro y truco racial; brujo
con invocaciones, pacto y recursos distintos; subclase lanzadora parcial;
multiclase con dos características de magia y dados diferentes; mejora de
Constitución; competencia duplicada; dote con elecciones; sustitución de una
opción con dependencias; creación a nivel alto;
reintento de confirmación; dos ascensos simultáneos; cambio concurrente de PG;
importación/exportación y adopción de una ficha sin historial.

El contenido personalizado y los suplementos tendrán sus propios casos de
aceptación cuando se incorporen; no son condición para lanzar la primera versión.

La arquitectura puede admitir más opciones que el catálogo inicialmente cargado.
La matriz de cobertura debe enumerar qué contenido está disponible, qué partes
se validan y qué mecánicas todavía requieren operación manual.

## 11. Decisiones confirmadas y abiertas

Confirmado: catálogo de lanzamiento limitado al Manual del Jugador 2014.
Suplementos y contenido personalizado quedan para ampliaciones posteriores.

Pendiente:

1. Variantes y reglas opcionales del manual habilitadas por defecto.
2. Edición compartida de personajes o asignación individual con intervención del GM.
3. Métodos de atributos, PG, equipo, nivel inicial y excepciones permitidas.
4. Edición manual de fichas verificadas: pasar por elecciones o guardar overrides explícitos.
5. Alcance de la validación en servidor y del trabajo offline del borrador.
6. Forma de adoptar fichas existentes y política de compatibilidad con clientes anteriores.

## Fuentes de reglas y plataforma

- [Reglas básicas de 2014: personalización](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options):
  opciones de campaña y requisitos; niveles, dados, competencias y magia por clase
  y fondos de espacios distintos. Sustenta que no basta un campo global de magia.
- [Reglas básicas de 2014: creación](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters):
  atributos, avances, PG y ajuste retroactivo cuando cambia Constitución.
- [Reglas básicas de 2014: trasfondos](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/personality-and-background):
  personalización y sustitución de competencias duplicadas.
- [SRD y versiones](https://www.dndbeyond.com/srd): separar material de 2014
  y revisión de 2024; no elegir automáticamente el SRD más reciente.
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security):
  autorización de acceso a los nuevos datos.
- [Arquitectura actual](ARCHITECTURE.md),
  [persistencia granular](GRANULAR_PERSISTENCE.md) y
  [catálogo actual](../CAMPAIGN_CONTENT.md).
