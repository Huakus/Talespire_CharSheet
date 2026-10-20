# Objetivo solicitado por el GM

Completar todos los pasos para que solo queden objetos útiles, únicos, completos y utilizables en español. Eliminar versiones antiguas y preparaciones obsoletas tras recuperar su información; actualizar las referencias de personajes y comerciantes; retirar comentarios de migración de la interfaz; implementar las funciones y validar el recorrido completo. Conservar copias de otras campañas y no modificar `.localstorage/`.

## Condiciones de cierre

- Ninguna definición inglesa, duplicada o de preparación en el catálogo utilizable de ECE.
- Texto español completo y sin comentarios internos de migración en las tarjetas.
- Referencias válidas de inventarios y comerciantes, conservando identidad y estado de cada copia.
- Mecánicas representadas y controles funcionales; las condiciones normales de juego no se sustituyen por mensajes genéricos de automatización pendiente.
- Pruebas de adquisición, equipo, sintonización, uso, recursos, recuperación y transferencia; compilación activa y revisión visual.
- Registro interno de decisiones y recuperación separado de los objetos utilizables.
- Las tablas de cada poción de curación muestran solo su variante; nombre, rareza, tirada y consumo deben coincidir en catálogos, inventarios y comerciantes. Revisar posibles duplicados o variantes cuya distinción se haya perdido, conservando los originales hasta aclararlo.

Estado: **en curso**. El goal del sistema anterior sigue sin terminar y figura limitado por uso; la herramienta rechazó crear uno nuevo sobre él. Este documento registra el alcance ampliado sin dar por alcanzado el objetivo.

Último cambio de datos verificado: ECE **1450**. Quedan **828 definiciones españolas**, sin filas inglesas ni nombres duplicados detectados. Hay **20 personajes, 294 copias en inventarios y 24 en comerciantes**, con cero referencias rotas. Dos objetos nuevos de apuntes personales permanecen sin catálogo; se conservan y no se vinculan con variantes que pertenecen a otros personajes. La limpieza histórica de la revisión 1304 archivó y retiró **834 definiciones redundantes y 853 preparaciones**; sus pruebas de reimportación se conservan como evidencia histórica.

Funciones añadidas: pruebas de las 37 herramientas con característica elegida, competencia/pericia y Talento Seguro; recuperación atómica de Inspiración de Bardo desde el tambor; peso y reglas completas de embarcaciones. Las tarjetas separan los archivos y comentarios internos de las reglas del objeto.

El catálogo compartido también se normalizó: **757 definiciones oficiales españolas**, **815 filas antiguas o ajenas al catálogo oficial retiradas**, ninguna inglesa y ningún nombre duplicado. Los hashes de todas las campañas existentes, sus fichas, contenido y versiones permanecen iguales tras esa operación. Se archivaron y cotejaron los 1.572 originales compartidos completos antes de modificar la fuente común.

Actualización del 19 de octubre: las cuatro pociones de curación muestran solo su propia fila y conservan fórmulas distintas; no había definiciones duplicadas de estas cuatro identidades. La corrección alcanzó 15 copias de personajes y cinco de comerciantes. Beber o administrar una poción registra el gasto y la curación en una operación; el receptor a 0 PG reinicia las salvaciones de muerte y recupera la consciencia. La Perla de poder permite elegir un espacio gastado y convertir los de nivel 4 o superior a nivel 3, con lanzamiento desde Conjuros y contabilidad separada de su uso al amanecer. Se actualizaron sus tres copias sin recargar sus contadores.

Se corrigió también la reintroducción de plantillas antiguas desde el generador: sus 237 plantillas oficiales tienen identidad española y definición canónica. La creación toma la revisión actual del catálogo cargado, y existe una copia española incluida para el funcionamiento sin conexión. Se vincularon 36 objetos recientes de tres fichas con 22 entradas existentes, conservando cantidades, estados y precios. No se agregaron definiciones duplicadas.

Pendiente para cerrar el objetivo: completar las propiedades especiales todavía no representadas, efectos con duración, uso gratuito de Canalizar divinidad desde el amuleto y Laúd de Doss. La limpieza de ambos catálogos no acredita que todas las mecánicas estén automatizadas. El análisis actual identifica **402 efectos sin representar y 158 capacidades declaradas sin adaptador**; algunos funcionan mediante otros campos y necesitan conciliación individual. La revisión visual de los controles nuevos en TaleSpire queda pendiente: el entorno no dispone de navegador controlable. No se modificó `.localstorage/`.

Evidencia actual: [estado de la campaña](equipment-completion-2026-10-19/final-status.json), [vinculación de las copias recientes](equipment-completion-2026-10-19/builder-equipment-relink-verified.json) y [avance funcional](EQUIPMENT_COMPLETION_2026-10-19.md). La suite general verificó 125 archivos y 1.197 pruebas; las ampliaciones posteriores de recuperación se verifican además con sus pruebas específicas.
