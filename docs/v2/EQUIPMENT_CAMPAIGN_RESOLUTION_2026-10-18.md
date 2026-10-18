# Objetos de campaña y nuevas mecánicas de equipo

**Actualización posterior:** la [retirada física y recuperación de textos](EQUIPMENT_RETIREMENT_2026-10-18.md) llevó ECE a la revisión 1294: 646 versiones antiguas y 20 preparaciones eliminadas, reglas de 37 herramientas completadas, sus 14 copias actualizadas y protección contra reimportación comprobada. Quedan 177 versiones inglesas por cotejar y funcionalidades por automatizar. Los datos de abajo describen la revisión 1287.

Aplicado en ECE, revisión **1287**. Quedó cerrado el grupo de 25 entradas que se había apartado: hay **cero entradas con `revision_pendiente` activas** y **839 definiciones normalizadas**. Esto no certifica que todo el catálogo tenga traducción oficial acreditada o todos sus efectos automatizados.

## Decisiones aplicadas

| Objeto | Resultado |
| --- | --- |
| Cristal Carmsí | Corregido a **Cristal Carmesí**, marcado custom y conservado como reliquia narrativa. Su texto no define cargas, bonos, daño ni penalizaciones cuantificadas; no se inventaron. |
| Núcleo Luciente | Recuperado el JSON incrustado y publicada la versión **Núcleo Luciente Adaptado**. Conserva todos los textos y originales. |
| Varita de molestar / Varita del fastidio | Consolidadas como una **Varita del fastidio** custom. Ambas aparecen relacionadas con *Wand of Annoyance*, pero sus reglas antiguas eran conflictivas. Se definió una regla consolidada bajo la autorización del GM; no se presenta como objeto oficial. |
| Armadura Mortis, Daga que regresa, Túnica del Paso de Invierno, Amuleto del Explorador | Retirados del catálogo mediante baja lógica, con los payloads originales íntegros. |

La copia antigua de la segunda varita también quedó retirada. Su fila completa se conserva adicionalmente dentro de `rules.original.mergedCatalogOriginal` de la varita consolidada. Se guardaron los alias para encontrarla por ambos nombres. Los originales españoles e ingleses de preparación siguen intactos.

Antes de modificar el lote se verificó que ninguna de sus ocho entradas estuviera referenciada por inventarios de personajes o comerciantes. Los objetos personales ya revisados, incluido el **Núcleo luciente fragmentado de Draven**, conservan su identidad y sus reglas propias: la versión Adaptada no se asigna por semejanza de nombre.

## Interpretación del Núcleo

El texto descriptivo en español y su versión inglesa coinciden en **tres cargas y recuperación durante un descanso largo con un fragmento de Cristal Luciente insertado**. El campo antiguo de descanso corto era incompatible y se corrigió.

Se priorizó la definición Adaptada incrustada para su rareza poco común y peso de 3 lb. Se conservó la exigencia de sintonización del registro y se reconoció la competencia con herramientas de hojalatero/manitas (`tinker-tools`), que la descripción también llama herramientas de artífice. Los valores externos discrepantes quedan archivados.

Las tres resonancias permanecen:

- **Recuerdo, verde:** una carga, diez minutos; ventaja en la Investigación y búsquedas concretas descritas.
- **Umbral, azul:** una carga, un minuto; resistencia al frío y ventaja frente al clima extremo.
- **Revelación, violeta:** una carga, un minuto; interacción con mecanismos aelorianos. Bloqueada si el núcleo está inestable.

Se explicitó una convención operativa de campaña para cerrar el uso: activar una resonancia cuesta una acción y solo se mantiene un efecto del núcleo a la vez. Reconfigurar mantiene su acción y prueba de Inteligencia con herramientas CD 12, sin gasto de carga. La recarga exige insertar el cristal; como el texto no dice que se consuma, no se lo elimina automáticamente.

## Regla consolidada de la varita

Requiere sintonización y empuñarla. Como acción, se gasta una de sus **tres cargas** y se elige una criatura visible a **30 pies**. Hace una salvación de **Sabiduría CD 14**. Si falla, queda fastidiada hasta el comienzo del siguiente turno del usuario y tiene desventaja en su primera salvación de Constitución para mantener concentración durante ese intervalo. La desventaja termina al aplicarse o al vencer ese plazo.

No inflige daño, no rompe concentración automáticamente ni afecta otras tiradas o acciones. Recupera todas las cargas al amanecer y conserva la resistencia narrativa a la destrucción por medios ordinarios. El fastidio no es un estado oficial de 5e.

La penalización específica, el plazo hasta el turno del usuario y la rareza poco común son **reglas nuevas de esta consolidación**, autorizada por el pedido de definir sus mecánicas. Se distinguen de los textos originales: uno tenía CD 14 y tres cargas; el otro, Sabiduría CD 10, alcance y efecto meramente narrativo. No se certificaron falsamente como dos traducciones idénticas de un manual.

## Mecánicas implementadas en el symbiote

- Estado del Núcleo por copia: resonancia configurada, efecto activo, duración restante, gasto desde el descanso, desgaste pendiente e inestabilidad. Sobrevive a guardar, recargar y serializar inventarios de comerciantes.
- Reconfiguración con d20 validado, Inteligencia proyectada y competencia de herramientas. Fallar no cambia la resonancia ni gasta una carga.
- Activaciones que comprueban configuración, herramientas, equipo, sintonización y cargas. Los usos no disponibles se deshabilitan.
- Duración en rondas de juego: avanzar una ronda, un minuto o terminar el efecto. No usa el reloj real.
- Desgaste al gastar tres cargas antes del descanso; un 1 en el d20 causa inestabilidad y bloquea Revelación. La recuperación ordinaria de descanso no evita esa tirada ni rellena cargas.
- Recarga condicionada y reparación con confirmaciones explícitas. La reparación exige descanso largo, materiales metálicos de 25 po y cristal; no resta monedas fingiendo que equivalen a materiales ya disponibles.
- Registro de daño tipificado que aplica defensas automáticas de objetos y la resistencia del Umbral azul antes de los PG temporales. La CD de concentración usa el daño resultante. «Daño ya calculado» evita aplicar dos veces una resistencia. No se deducen condiciones de defensa a partir de prosa ambigua ni se afirma automatizar todas las defensas raciales o de clase.
- **Beber y curarme** para consumibles con un único efecto de curación explícito: valida o solicita la tirada, consume la unidad y aplica la curación en una sola operación. Respeta los PG máximos y los PG temporales, admite las formas de druida y rechaza que un personaje incapacitado beba por sí mismo. El control aparece solo para objetos poseídos.
- Las tiradas de daño de capacidades siguen disponibles después de gastar su última carga: tirar dados no equivale a activar de nuevo el poder.

La varita descuenta cargas y recupera al amanecer. Su salvación y la desventaja del objetivo siguen asistidas: el sistema no elige un objetivo ni modifica silenciosamente otra ficha. El GM identifica qué mecanismos responden a Revelación y qué tiradas corresponden a clima extremo. Estas intervenciones y los costes materiales no retirados automáticamente se indican en la interfaz; no se etiquetan como automatización completa.

Los cotejos textuales de los dos objetos de Tasha y otros poderes singulares del catálogo continúan documentados en sus fichas. Cerrar este grupo de 25 no elimina esos pendientes técnicos ni habilita borrados de archivos de recuperación.

## Validación

La publicación principal se ensayó con rollback y se aplicó con guardas de revisión, igualdad de filas y comprobación de ausencia de referencias. Se hizo un refinamiento posterior de los enlaces a párrafos para evitar repetir la descripción completa en cada capacidad.

Los tres payloads finales coinciden exactamente con la publicación preparada. Las cinco filas retiradas conservan sus payloads originales. Permanecieron iguales los checksums de los registros fuera del lote, fichas, stock, versiones de personajes, preparaciones, catálogo compartido y otras campañas. No se modificó `.localstorage/`.

- Suite v2 completa: **114 archivos, 1.131 pruebas aprobadas**.
- Tras los ajustes finales de presentación: **43 pruebas dirigidas aprobadas**, incluida la visibilidad y deshabilitación de la curación propia.
- TypeScript y compilación con `npm run build:v2 -- --emptyOutDir=false` correctos.
- Carga de los 16 personajes reales y sus 241 objetos verificada sin cambios pendientes de caché.
- Revisión visual en Chromium de una ficha sintética estrecha, con controles del Núcleo, daño y poción. Se corrigieron el ajuste de anchura y los estilos de los controles. No equivale a una prueba directa dentro de TaleSpire.

Evidencia: [definiciones finales](equipment-preparation-2026-10-17/campaign-resolution-definitions.json), [verificación de la base](equipment-preparation-2026-10-17/campaign-resolution-verified.json).
