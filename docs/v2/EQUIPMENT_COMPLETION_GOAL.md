# Objetivo solicitado por el GM

Completar todos los pasos para que solo queden objetos útiles, únicos, completos y utilizables en español. Eliminar versiones antiguas y preparaciones obsoletas tras recuperar su información; actualizar las referencias de personajes y comerciantes; retirar comentarios de migración de la interfaz; implementar las funciones y validar el recorrido completo. Conservar copias de otras campañas y no modificar `.localstorage/`.

## Condiciones de cierre

- Ninguna definición inglesa, duplicada o de preparación en el catálogo utilizable de ECE.
- Texto español completo y sin comentarios internos de migración en las tarjetas.
- Referencias válidas de inventarios y comerciantes, conservando identidad y estado de cada copia.
- Mecánicas representadas y controles funcionales; las condiciones normales de juego no se sustituyen por mensajes genéricos de automatización pendiente.
- Pruebas de adquisición, equipo, sintonización, uso, recursos, recuperación y transferencia; compilación activa y revisión visual.
- Registro interno de decisiones y recuperación separado de los objetos utilizables.

Estado: **en curso**. El goal del sistema anterior sigue sin terminar y figura limitado por uso; la herramienta rechazó crear uno nuevo sobre él. Este documento registra el alcance ampliado sin dar por alcanzado el objetivo.

Último cambio de datos verificado: ECE **1304**. Quedan **828 definiciones españolas**, sin filas inglesas, preparaciones internas ni nombres duplicados detectados. Se archivaron y retiraron **834 definiciones redundantes y 853 preparaciones**. Las 1.687 claves retiradas no reaparecen al importar con el RPC normal del GM. Las 16 fichas cargan con sus 241 objetos, conservan sus estados y referencias válidas; los comerciantes conservan sus 24 copias.

Funciones añadidas: pruebas de las 37 herramientas con característica elegida, competencia/pericia y Talento Seguro; recuperación atómica de Inspiración de Bardo desde el tambor; peso y reglas completas de embarcaciones. Las tarjetas separan los archivos y comentarios internos de las reglas del objeto.

El catálogo compartido también se normalizó: **757 definiciones oficiales españolas**, **815 filas antiguas o ajenas al catálogo oficial retiradas**, ninguna inglesa y ningún nombre duplicado. Los hashes de todas las campañas existentes, sus fichas, contenido y versiones permanecen iguales tras esa operación. Se archivaron y cotejaron los 1.572 originales compartidos completos antes de modificar la fuente común.

Pendiente para cerrar el objetivo: completar las propiedades especiales todavía no representadas, efectos con objetivo y duración, uso gratuito de Canalizar divinidad desde el amuleto y Laúd de Doss. La limpieza de ambos catálogos no acredita que todas las mecánicas estén automatizadas. El análisis funcional actual identifica **403 efectos sin representar**; varias propiedades ya funcionan mediante otros campos, pero requieren conciliación y validación por capacidad antes de cerrar el objetivo.
