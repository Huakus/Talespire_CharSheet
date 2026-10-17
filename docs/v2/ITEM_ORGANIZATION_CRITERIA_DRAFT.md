# Organización de objetos: criterios propuestos

17 de octubre de 2026. Borrador para acordar antes de implementar o modificar datos. Complementa `ITEMS_EXPLORATORY_AUDIT.md`; no autoriza borrar, fusionar, traducir ni reemplazar entradas.

## Identidad e idioma

Un objeto representa una definición de reglas, no un idioma. La versión inglesa y su traducción española deberían estar relacionadas con la misma identidad cuando se confirme que tienen la misma fuente, versión y mecánicas. Un nombre parecido o un índice heredado coincidente solo propone una correspondencia; no la demuestra.

| Situación | Tratamiento propuesto |
| --- | --- |
| Inglés y español equivalentes, cotejados | Una entrada principal en español. Conservar el original inglés como referencia y los nombres anteriores como alias. |
| Solo inglés, o equivalencia española no confirmada | Conservar íntegro en Pendientes de traducción. No mezclar con el catálogo principal listo en español. |
| Español existente pero roto o sin cotejar | Conservarlo junto al original y marcar Pendiente de revisión. Si es ilegible, ubicarlo en pendientes hasta recuperarlo. |
| Mismo nombre, distintas reglas | Conservar ambas versiones y marcar Conflicto de versión; resolver antes de fusionar. |
| Una ficha o comercio usa una versión pendiente | Mantener la posesión y sus datos visibles. La organización del catálogo no debe hacer desaparecer equipo existente. |
| Hay una traducción provisional | Identificarla como provisional; no presentarla como traducción oficial del manual. |

No se elimina una entrada por estar en inglés. Una futura consolidación requiere comprobar equivalencias, preservar originales y variantes, revisar todas las referencias, migrar de forma verificable y mantener recuperación. Archivar una versión no debe cortar el acceso a copias que la usan.

En la instantánea del relevamiento hay 803 filas inglesas: 791 comparten un índice heredado con alguna fila española y 12 no. **No son 791 equivalencias certificadas ni 12 objetos necesariamente exclusivos del inglés.** Entre los doce hay candidatos conocidos como Cloak of Charisma +1/Capa de Carisma +1 y Lucent Core/Núcleo Luciente, cuyos índices son distintos. El segundo además contiene una versión adaptada dentro de un JSON pegado: una traducción y un cambio de reglas pueden estar mezclados. Este ejemplo impide decidir la identidad solamente por nombre, idioma o índice.

## Dimensiones independientes de clasificación

| Dimensión | Qué responde |
| --- | --- |
| Tipo físico | Qué es: arma, armadura, escudo, herramienta, munición, equipo de aventura, poción, pergamino, anillo, varita, bastón, cetro, objeto maravilloso, montura o vehículo. Los detalles de combate pueden existir también en un bastón mágico. |
| Procedencia | Oficial comprobado, contenido de campaña confirmado o procedencia pendiente. Guardar la fuente real, edición de reglas y página cuando estén verificadas. |
| Magia y rareza | Si es mágico y su rareza. Un arma mágica sigue siendo un arma. |
| Condiciones de uso | Si requiere llevarse puesto, empuñarse, sintonizarse, cumplir requisitos o consumirse. |
| Funciones | Bonos, daño, curación, conjuros, movimiento, protección, almacenamiento u otras capacidades. Puede tener varias. |
| Calidad editorial | Texto cotejado, traducción pendiente, descripción dañada o conflicto de versión. |
| Implementación | No requiere automatización adicional, resolución manual, asistencia parcial o funciones implementadas y verificadas. |
| Disponibilidad para ECE | Habilitado, pendiente de decisión o fuera del catálogo activo; separado de la procedencia y de la calidad del texto. |

La etiqueta actual `official` no es prueba de procedencia. `imported` tampoco demuestra que algo sea casero. Identificar que un objeto proviene de un libro no implica habilitar ese libro. Se conserva la información de los objetos existentes sin ampliar automáticamente los manuales acordados.

No usar etiquetas libres para repetir atributos que ya tienen un campo: idioma, tipo, rareza o sintonización. Los filtros se pueden construir a partir de esos campos. Reservar etiquetas libres para agrupaciones útiles de campaña, si se decide necesitarlas.

## Definición, variante y posesión

- **Definición base:** identidad estable, nombres por idioma, fuente, descripción y reglas comunes.
- **Variante de campaña:** base de la que deriva y modificaciones autorizadas. Un cambio de nombre de ambientación puede ser solo un alias; cambiar daño, restricciones o poderes es una variante de reglas.
- **Copia poseída:** propietario, cantidad, nombre personal si corresponde, equipo, sintonización, cargas actuales y estado propio. Dos copias no comparten cargas ni la sintonización de sus portadores.

Las reglas generales y el máximo de cargas pertenecen a la definición; las cargas gastadas a la copia. Las reglas de identidad no se deben deducir del nombre visible. Una corrección de catálogo tampoco debe sobrescribir automáticamente las personalizaciones de una ficha.

## Estándar editorial y funcional

Cada objeto debería poder mostrar nombre y tipo, procedencia, ambientación cuando corresponda, reglas de uso, capacidades, recursos y recuperación. Esos bloques solo se muestran cuando aportan información. Los datos pendientes se declaran como pendientes, sin inventar precios, límites, requisitos o reglas para completar campos.

Para contenido oficial, conservar el texto de la fuente española cotejada y normalizar su presentación en párrafos, listas y tablas legibles. Preservar aparte el original recuperado. Para contenido de campaña, separar ambientación, reglas y notas del GM. Eliminar HTML o recuperar un JSON incrustado es una transformación editorial que necesita comprobar que no pierde reglas o tablas.

Las capacidades que la aplicación ejecuta deben estar estructuradas y vinculadas a la instancia del objeto: requisitos, acción/disparador, coste, efecto, objetivo, duración y recuperación. Una descripción que menciona un conjuro no concede automáticamente ese conjuro, y una tirada disponible no implica que su resultado se aplique a la ficha.

Un objeto puede estar bien descrito y tener efectos manuales. También puede tener un texto dañado aunque sus estadísticas básicas funcionen. La revisión editorial y la implementación funcional son evaluaciones distintas. Un equipo sencillo puede estar completo sin necesitar un botón Usar.

## Presentación propuesta

El catálogo habitual mostraría las entradas en español habilitadas para ECE. Un área de revisión conservaría Pendientes de traducción, Pendientes de contenido y Conflictos de versión. Los originales y versiones archivadas seguirían siendo consultables. Las posesiones existentes permanecerían en las fichas, con avisos de revisión cuando corresponda.

El trabajo siguiente, una vez acordados estos criterios, sería aplicar la clasificación al relevamiento y preparar las correspondencias para revisar. Los originales se conservan durante ese proceso; las correcciones, fusiones y funcionalidades se planifican después sobre objetos concretos. Esta propuesta no cambia todavía ningún objeto ni flujo de la aplicación.
