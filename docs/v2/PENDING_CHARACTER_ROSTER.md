# Implementación de Edrick, Draven y Maelion

Estado: **implementado en la campaña ECE** el 17 de agosto de 2026. Los tres
personajes se crearon mediante una única operación granular atómica de Supabase,
desde la revisión 520 a la 521, sin modificar `.localstorage/`.

La definición persistible y sus IDs determinísticos viven en
`scripts/character-seeding/expedition-characters.ts`. Los blueprints de
`test/fixtures/pending-character-blueprints.ts` se conservan como fuente de
preflight y trazabilidad de las decisiones adoptadas.

La lectura posterior confirmó 139 fragmentos nuevos, tres versiones de personaje
en revisión 0 y ninguna definición de conjuro ausente. El RPC granular devolvió
la campaña completa en revisión 521 con 11 personajes y 565 fragmentos.

## Fuentes y criterio

- Documento de campaña: `Notas de Campaña`, pestañas detalladas de Edrick Voss,
  Draven Korr y Maelion Vaelaris.
- Reglas base: *Manual del Jugador 5e* de 2014 suministrado en Drive.
- Reglas adicionales suministradas: *Guía de Xanathar para Todo*, usada para
  `Absorber elementos`.
- Excepción documentada: Artífice/Armero procede de *Tasha's Cauldron of
  Everything*, que no está en la carpeta suministrada. La implementación usa
  las reglas 5e 2014 verificadas para el Armero y deja explícitas sus decisiones
  de armadura, escudo, infusiones y Lanzarrayos.
- Las pestañas detalladas son la fuente narrativa. Cuando un total contradice
  una regla, el blueprint conserva la intención, calcula el valor reglado y
  registra la decisión adoptada.

Los datos preparados están en
`test/fixtures/pending-character-blueprints.ts`. La prueba de preflight impide
que se pierdan secciones, valida los derivados y separa conjuros ordinarios de
los raciales, de subclase y de Secretos Mágicos.

## Resumen de preflight

| Personaje | Base preparada | Bloqueos principales |
| --- | --- | --- |
| Edrick Voss | Humano variante, Explorador 7/Cazador, 5 conjuros, inventario completo | método de PG, segundo enemigo predilecto, trasfondo/idiomas, entrada de `Cordón de flechas` |
| Draven Korr | Humano variante, Artífice 7/Armero, 8 preparados + 4 de subclase, inventario completo | fuente Tasha, armadura/infusiones, pistola con escudo, contenido personalizado |
| Maelion Vaelaris | Drow, Bardo 7/Colegio del Saber, 10 conocidos + 2 Secretos + magia racial, inventario completo | CA, tercer truco, conjuro de nivel 4, Laúd de Doss, trasfondo/idiomas |

## Edrick Voss

### Totales preparados

- CA 18: cuero tachonado 12 + Destreza 5 + magia 1.
- PG 67, conservados como resultado de tiradas. El promedio fijo daría 60.
- Salvaciones: Fuerza y Destreza.
- Ataque con `Vigía Invernal`: +12; daño `1d8+7`. Con Tirador experto:
  +7; daño `1d8+17`.
- Ataque con `Colmillo Gris`: +9; daño `1d6+6`.
- CD de conjuro 14, ataque de conjuro +6; espacios 4/2; 5 conjuros
  conocidos.

### Habilidades corregidas

| Habilidad | Normal | Contextual |
| --- | ---: | ---: |
| Percepción | +6 | +9 si la prueba de Sabiduría está cubierta por Explorador Nato |
| Supervivencia | +6 | +9 en la misma condición |
| Sigilo | +8 | — |
| Investigación | +4 | — |
| Atletismo | +3 | — |
| Trato con animales | +6 | — |

La fuente escribía +11 en Sigilo sin aportar Pericia. No se aplicará una
bonificación inventada. El reparto provisional usa tres habilidades de
Explorador, dos del trasfondo personalizado y una del Humano variante.

### Integridad de reglas

El blueprint incluye Enemigo predilecto, Explorador nato, Tiro con Arco,
Lanzamiento de conjuros, Conciencia primigenia, Ataque adicional, Coloso
asesino, Escapar de la horda y Tirador experto. También incluye todas las
flechas especiales, consumibles anti-troll y equipo de expedición enumerados
en el documento.

Decisiones aplicadas:

1. Se conservaron 67 PG como resultado de tiradas.
2. Se usaron humanoides (orcos y goblinoides) como segundo enemigo predilecto.
3. Se usó el trasfondo personalizado `Explorador de frontera`, basado en
   Forastero, y los idiomas provisionales del blueprint.
4. `Cordón de flechas` 2014 se guardó como definición completa embebida porque
   no existe en el catálogo actual de la campaña.

## Draven Korr

### Totales confirmables

- PG 59 con promedio fijo de Artífice 7 y Constitución 16.
- Salvaciones: Constitución +6 e Inteligencia +8.
- CD de conjuro 16 y ataque de conjuro +8; espacios 4/3.
- Herramientas basadas en Inteligencia: +11 por Pericia con herramientas.
- Arcano, Investigación e Historia: +8. Arcano e Investigación no reciben
  Pericia por ser Artífice.
- Lanzarrayos sin infusión: +8, `1d6+5` de relámpago, más `1d6` una vez por
  turno. Con Arma mejorada: +9, `1d6+6`, más ese `1d6` una vez por turno.

### Conflicto de armadura e infusiones

La propuesta fuente no es legal completa a nivel 7:

- una Armadura arcana es un solo objeto hasta nivel 9;
- el mismo objeto no puede llevar a la vez Armadura mejorada y Arma mejorada;
- una armadura que ya sea mágica no puede recibir una infusión;
- media armadura/armadura pesada con desventaja en Sigilo cancela, no conserva,
  la ventaja del modelo Infiltrador;
- Experto en ballestas elimina `Carga`, pero no elimina la necesidad de una
  mano libre para la propiedad `Munición`.

Por eso la CA 20 se conserva como objetivo, no como configuración aprobada.
Hay que elegir explícitamente entre las alternativas siguientes:

| Alternativa | Resultado |
| --- | --- |
| Media armadura + escudo mejorado | CA 20, Sigilo normal; el Lanzarrayos puede llevar Arma mejorada si la armadura es el único segmento infundido |
| Coraza + escudo mejorado | CA 19, ventaja en Sigilo |
| Armadura mágica personalizada | Puede alcanzar CA 20 y ventaja, pero deja de ser una construcción puramente oficial y no admite infusión sobre la armadura |

La pistola repetidora también exige una elección: usarla como respaldo con el
escudo guardado, o dedicar una infusión activa a Disparo repetido. En este
último caso debe reemplazarse Bolsa de contención u otra infusión.

La implementación adopta la primera opción. Como Ballesta de mano +1 usa
Destreza 14, su ataque es +6 y su daño `1d6+3`; los valores +9/`1d6+6` de la
fuente solo serían posibles añadiendo una propiedad personalizada para usar
Inteligencia.

### Conjuros y rasgos

El blueprint completa las dos selecciones ordinarias que faltaban con `Alarma`
y `Restablecimiento menor`. Los cuatro conjuros de Armero preparados siempre
son `Proyectil mágico`, `Onda atronadora`, `Imagen múltiple` y `Shatter`.
`Inmovilizar persona` queda retirado porque no pertenece a esa lista de
subclase.

También quedan enumerados Retoques mágicos, Infundir objeto, La herramienta
adecuada para el trabajo, Pericia con herramientas, Destello de genio,
Armadura arcana, Modelo Infiltrador y Ataque adicional.

No se debe convertir este blueprint en `CharacterV2` hasta:

1. autorizar una fuente de reglas de Artífice/Armero;
2. elegir la configuración de armadura/infusiones;
3. resolver la pistola, el escudo y la mano libre;
4. aprobar las dos preparaciones sugeridas y el trasfondo;
5. crear las entradas personalizadas aprobadas en el catálogo.

## Maelion Vaelaris

### Totales preparados

- CA 16: cuero tachonado 12 + Destreza 3 + magia 1. La CA 17 de la fuente no
  tiene soporte mecánico declarado.
- PG 52 con promedio fijo.
- Salvaciones: Destreza +6 y Carisma +8.
- CD de conjuro 16, ataque de conjuro +8; espacios 4/3/3/1.
- Estoque +1: ataque +7, daño `1d8+4`.
- Inspiración bárdica d8: 5 usos, recuperados en descanso corto o largo gracias
  a Fuente de inspiración.
- Líder inspirador: 12 PG temporales.

### Habilidades corregidas

| Habilidad | Grado | Total |
| --- | --- | ---: |
| Historia | Pericia | +8 |
| Investigación | Pericia | +8 |
| Arcano | Competencia | +5 |
| Persuasión | Competencia | +8 |
| Perspicacia | Competencia | +4 |
| Percepción | Competencia | +4 |
| Engaño | Competencia | +8 |
| Interpretación | Competencia | +8 |

El reparto provisional evita duplicar Arcano: Sabio aporta Arcano e Historia;
el Colegio aporta Investigación, Perspicacia y Percepción; Bardo aporta
Persuasión, Engaño e Interpretación. Las Pericias siguen siendo Historia e
Investigación.

### Conjuros, Drow y objetos

Bardo 7 conoce 3 trucos de clase y 10 conjuros ordinarios. El borrador conserva
`Burla dañina`, `Ilusión menor` y `Mano de mago`, y deja `Prestidigitación`
fuera a la espera de aprobación. `Luces danzantes` se registra por separado
como magia racial. Se propone `Puerta dimensional` como décimo conjuro y opción
de nivel 4. `Contrahechizo` y `Espíritus guardianes` son los dos Secretos
Mágicos adicionales y no cuentan contra los 10.

La hoja final debe incluir además Sensibilidad a la luz solar, Entrenamiento
con armas drow, Fuego feérico y Oscuridad; estaban incompletos en la fuente.

La recomendación para el `Laúd de los Ecos Profundos` es usar un Laúd de Doss
oficial renombrado: poco común, requiere sintonización y no concede +2 a ataques
de conjuro. Mantener la rareza `Raro` y el +2 exigiría diseñar y aprobar un
objeto personalizado distinto.

## Estado del catálogo

Se verificaron en lectura las entradas oficiales reutilizables para armas,
armaduras, consumibles, equipo común y la mayoría de conjuros. Los blueprints
guardan sus `contentKey` para evitar búsquedas ambiguas y asegurar que la
implementación pueda reproducirse.

Contenido resuelto como definiciones personalizadas dentro de las hojas:

- `Cordón de flechas` en español 2014.
- Bolsa de contención replicada y Monóculo analítico de Draven.
- Armadura/infusiones/rasgos de Armero en español.
- Laúd de Doss en español.
- El Laúd de Doss en español se mantiene como objeto personalizado de Maelion.

## Procedimiento aplicado

1. Se convirtieron los blueprints a `CharacterV2` con IDs estables y únicos.
2. Se validó cada personaje con `CharacterV2Schema` y se ensayó el ciclo
   `fragmentCampaign`/`assembleCampaign` sin red.
3. Se resolvieron 36 vínculos de conjuros contra 32 entradas oficiales del
   catálogo. `Cordón de flechas` quedó como definición completa embebida.
4. Se guardaron los 139 fragmentos y las tres versiones en una sola llamada a
   `save_campaign_fragment_batch`, protegida por la revisión esperada 520.
5. Se releyó la campaña mediante `read_campaign_fragments` y se verificaron las
   cantidades, revisiones, autoría y definiciones almacenadas.
