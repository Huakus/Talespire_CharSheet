# Identificación, Varka e interacciones con comerciantes

Estado: identificación y comerciantes implementados; reparación de Varka aplicada y verificada, 2026-11-02.

## Decisiones e implementación

El usuario confirmó que sólo el GM identifica. Hasta entonces, la presentación de la copia al jugador contiene el nombre y apariencia definidos por el GM, peso y cantidad, con gestión de posesión/transferencia pero sin capacidades utilizables. No se cambió el estado de los objetos existentes: la ausencia del campo conserva el comportamiento anterior.

Implementado:

- Estado opcional `identification` por copia; controles en el editor de inventario de una ficha administrada por el GM y en cada objeto del inventario del comerciante. Identificar conserva cargas y contadores. Marcar sin identificar quita equipo y sintonización.
- Proyección de presentación sin descripción, definición, precio base, rareza, etiquetas o capacidades reales; acciones y conjuros vinculados ocultos; filtros y nombres en mensajes/registro usan la identidad visible. Los datos reales permanecen en el modelo compartido: este cambio no añade confidencialidad del protocolo ni restringe la lectura del catálogo.
- Bloqueo de equipo, sintonización, activación, gasto, consumo y otras operaciones del objeto en dominio. Sus efectos pasivos, CA, atributos y espacios adicionales de conjuro no se aplican. El objeto sigue contando para el peso.
- Conservación de identificación al editar y transferir; las comparaciones de apilado incluyen el estado. Los objetos sin identificar no recuperan recursos a través de la recuperación general mientras permanecen bloqueados.
- RPC `execute_campaign_merchant_loot`, separado de la edición de NPC y de la compraventa: permisos de miembro, estado y configuración de comerciante, revisiones y cantidades, transferencia atómica, conservación de recursos y ausencia de movimientos de dinero. Un reintento con las mismas revisiones se rechaza y no vuelve a transferir.
- Trigger de servidor para impedir que un jugador cambie la identificación o los campos reservados de un objeto sin identificar mediante actualizaciones de fragmentos. Puede modificar cantidad, orden y grupo. La edición general de contenido continúa reservada al GM.
- Vistas sin comercio rotuladas “Inventario del comerciante”/“Mis objetos”; botón de intercambio sólo con compraventa activa y NPC activo; ajuste automático de modo cuando deja de estar disponible.
- Nombres alternativos de Descarga agonizante en el selector y explicación de la sustitución cuando el ascenso no concede un cupo nuevo.

La migración `20261103014511_merchant_loot_and_item_identification.sql` fue aplicada a Supabase. La verificación del servidor con `scripts/sql/verify-merchant-loot-identification.sql` pasó: transferencia, contadores, composición de monedas, reintentos, permisos de identificación de jugador/GM, rechazo de saqueo de NPC activo y rechazo de compraventa deshabilitada. La transacción de prueba se revirtió y se verificó que no persistieran campañas de prueba. El endpoint de saqueo no puede ejecutarse como `anon`; su acceso `authenticated` es deliberado y valida la pertenencia a campaña dentro de la función.

Varka: el usuario no recuerda el ascenso original y eligió reemplazar **Arma Mejorada del Pacto** por **Descarga agonizante**. Se registró la sustitución en el ascenso a nivel 10 y se validó el historial completo; esto documenta la reparación acordada, no un nivel de adquisición original demostrado. La ficha conserva cinco invocaciones. Estallido arcano pasa de `1d10` a `1d10+5` por impacto; el arma de pacto pierde el +1 que dependía de la invocación retirada (ataque total +8 → +7; bono de daño +4 → +3).

La reparación se guardó en una transacción con comprobación de revisiones y de los valores anteriores completos: campaña 1850 → 1851, Varka 42 → 43. La lectura posterior confirmó exactamente cuatro fragmentos cambiados (historial, estado derivado de Brujo, acción de arma de pacto y grupo de rasgos de Brujo). Todos los demás fragmentos son idénticos, incluidos inventario, PG, monedas, espacios gastados, conjuros y notas. También se validó una simulación de la subida a nivel 11 sin guardarla. Respaldo, cambios preparados y verificación: `character-repairs/varka-agonizing-blast/`. El script `scripts/prepare-varka-invocation-repair.mjs` sólo prepara y valida localmente; no se conecta a la base de datos.

Las otras interacciones de comerciante que utilizan edición general (hurtar, asaltar, implantar y negociación) quedan como hallazgo para trabajo adicional. Esta entrega corrige la operación de saqueo solicitada y no amplía los permisos generales de jugadores.

Verificación de implementación: suite completa `test/v2` con dos workers, **162 archivos / 1.433 pruebas aprobadas**. La nueva regresión de descubrimiento de invocaciones también pasó; una revisión posterior de siete suites relacionadas aprobó **73 pruebas**. `npm run typecheck` y `npm run build:v2 -- --emptyOutDir=false` terminaron correctamente. El build referencia `assets/v2-Brjht1Jb.js` y conserva los assets anteriores. La primera ejecución masiva sin limitar workers fue interrumpida tras agotar tiempos en pruebas de constructores; la ejecución completa limitada pasó. No se verificó visualmente dentro de TaleSpire.

## Alcance y evidencia

Durante la investigación inicial se revisaron las fuentes locales y se hicieron consultas de sólo lectura al proyecto Supabase TaleSpire CharSheet, campaña ECE. La implementación y la reparación posterior de Varka se describen arriba. No se modificó `.localstorage/`; se conservaron los cambios preexistentes de `warlock-play-panel.ts` y su prueba.

### 1. Objetos sin identificar

`CharacterInventoryItemFieldsSchema` no tiene un estado general de identificación. `rules.storage.known` sólo representa el contenido conocido de un contenedor de conjuros; no debe reutilizarse para esta mejora.

Las descripciones se muestran desde varios componentes y los efectos se calculan en distintas rutas: proyección de estadísticas, acciones de equipo, capacidades, recursos y conjuros concedidos por objetos. Ocultar la descripción de una tarjeta no bloquea esas funcionalidades.

Propuesta:

- Guardar el estado por copia poseída, con nombre y apariencia visibles mientras no está identificada. No modificar el catálogo al identificar una copia.
- Mantener el comportamiento de los objetos existentes cuando el nuevo campo no esté presente; no desidentificar inventarios completos con una migración implícita.
- Centralizar la comprobación de identificación y aplicarla a descripción, vistas previas, acciones, efectos pasivos, bonificaciones, conjuros concedidos y operaciones de activación. Bloquear también la ejecución directa de esas operaciones.
- Conservar el estado al transferir, comprar, saquear o separar pilas; no combinar copias con estados de identificación distintos.
- Identificar debe revelar la información y habilitar las capacidades sin reiniciar cargas, usos ni otros contadores.
- Si sólo el GM puede identificar, comprobar su permiso en el servidor además de ocultar el control al jugador. Revisar las vías de escritura de fragmentos y restauración de ficha.

Decisión confirmada posteriormente: sólo el GM identifica; nombre/apariencia, peso y cantidad visibles; funcionalidades bloqueadas. Si la descripción debe ser confidencial incluso al inspeccionar los datos recibidos por el cliente, hará falta además separar los datos reservados en el servidor y controlar su lectura. Un cambio de presentación no garantiza esa confidencialidad.

Aceptación: antes de identificar no aparecen descripciones ni funcionalidades reservadas en inventario, acciones, conjuros, buscadores o vistas de comerciante; no se aplican bonificaciones ni se gastan recursos por operaciones bloqueadas. Después de identificar se habilitan las funciones conservando cantidades y contadores. El GM puede consultar la información real.

### 2. Descarga agonizante de Varka

El catálogo contiene `agonizing-blast`, presentado como **Descarga agonizante**, y requiere conocer `eldritch-blast`. La Varka actual conoce ese truco desde nivel 1, está en nivel 10 y tiene este historial de invocaciones:

| Nivel | Selección actual |
| --- | --- |
| 2 | Armadura de sombras; Habla de las bestias |
| 5 | Arma Mejorada del Pacto |
| 7 | Influencia cautivadora |
| 9 | Capa de Moscas |

No hay sustituciones registradas hasta nivel 10. `agonizing-blast` no está en el historial actual y cumple los requisitos. En nivel 10 no hay cupo nuevo: el asistente permite obtenerla mediante sustitución. El selector de invocación sustituta aparece al elegir primero una invocación anterior.

La ficha archivada `-ELIMINAR- Varka` conserva estas cinco invocaciones: Explosion agonizante, Empujon repelente, Vision del Diablo, Forma de las Sombras y Mil caras. Por lo tanto, existe evidencia de que Varka ya tenía la capacidad en su ficha anterior; no existe evidencia suficiente para determinar en qué nivel la eligió ni por qué no la encontró en la sesión reportada. El nombre distinto y el flujo de sustitución son explicaciones posibles, no hechos confirmados.

Propuesta:

- Aclarar en el asistente cuándo no hay cupo nuevo y cómo sustituir una invocación; mejorar el reconocimiento de nombres alternativos (Descarga/Explosión/Estallido agonizante y Agonizing Blast) sin crear capacidades duplicadas.
- Confirmar qué selección actual debe reemplazar y desde qué nivel. No agregar una sexta invocación al nivel 10 ni inventar el nivel histórico.
- Preparar una reparación puntual y revisable: modificar la selección del nivel indicado o registrar una sustitución en un ascenso existente. Validar todo el historial con `validateWarlockBuild`/`replayWarlockChoices` y recalcular los beneficios con `applyWarlockBenefits`.
- Comparar antes/después: sólo deben cambiar las elecciones y capacidades afectadas. Preservar inventario, PG actuales, recursos gastados y demás estado de juego; guardar con control de revisión para detectar cambios concurrentes.
- Comprobar que el daño de Estallido arcano suma CAR por impacto y que futuras subidas reconocen la selección. No basta añadir un rasgo de texto ni cambiar sólo el bono del botón de daño.

Resuelto posteriormente: sustituir Arma Mejorada del Pacto por Agonizing Blast en el ascenso a nivel 10. Se mantienen las otras cuatro invocaciones actuales. No se reconstruye un nivel de adquisición original sin evidencia.

### 3. Saqueo bloqueado por permisos de GM

Confirmado en código y configuración remota: Edran tiene `state: dead`, `loot: true`, `barter: false`, `interaction: true`. Puede ser saqueado según `merchantCanBeLooted`.

Sin embargo, `executeMerchantTransaction(..., "loot")` llama a `persistMerchantInventory`, que usa `runtime.saveMonster`. Esa ruta guarda la definición completa del NPC mediante `save_campaign_content_entry`, cuya función vigente exige `can_manage_campaign_content` y devuelve `CAMPAIGN_GM_REQUIRED` al jugador. El permiso de edición de contenido es correcto; la operación de saqueo usa una vía inadecuada.

La compraventa ya tiene una operación atómica específica: `execute_campaign_merchant_trade`. El saqueo sigue una ruta separada con escrituras sucesivas. Hurtar, asaltar, implantar y resolver negociaciones también utilizan rutas de edición general y deben revisarse como parte del mismo problema, sin asumir que todos funcionan para jugadores.

Propuesta:

- Implementar una operación de servidor específica para transferencias autorizadas de saqueo, tomando como referencia los controles de la compraventa: miembro de campaña, comerciante y NPC vinculados, interacción habilitada, estado muerto/inconsciente, permiso de saqueo, cantidades y revisiones actuales.
- Quitar stock y agregar objetos al personaje en una única transacción; preservar recursos, definición e identificación de cada copia. No transferir dinero automáticamente: el comportamiento actual de esta acción sólo transfiere los objetos seleccionados.
- Hacer que el cliente invoque la operación autorizada, sin intentar guardar el NPC completo ni usar escrituras parciales como alternativa en remoto.
- Incluir idempotencia o un mecanismo equivalente de protección frente a reintentos. Verificar que dos jugadores no puedan llevarse la misma unidad.
- Auditar las otras interacciones afectadas y aplicar operaciones específicas para las que el GM haya habilitado; no conceder edición general de comerciantes a jugadores para resolver estos errores.

Aceptación: un jugador puede saquear Edran; un segundo intento o una carrera no duplica objetos; no puede saquear un comerciante activo ni uno con saqueo deshabilitado; un fallo revierte toda la transferencia; el jugador sigue sin poder editar la ficha del NPC.

### 4. Comprar/vender visibles con compraventa deshabilitada

El ajuste general es `interactions.barter`. La interfaz usa los modos internos `buy` y `sell` para otras acciones además del comercio:

- `buy`: comprar, hurtar, asaltar y saquear.
- `sell`: vender e implantar evidencia.

`renderMerchantInteractions` muestra esos modos cuando alguna acción asociada está permitida, pero sus rótulos siempre dicen Comprar/Vender. Así, Edran muestra Comprar porque puede ser saqueado aunque `barter` sea falso. El carrito y su confirmación sí comprueban `barter`; la función de compraventa del servidor también lo valida. La evidencia permite confirmar una incoherencia de presentación, no una compraventa exitosa con el ajuste deshabilitado.

Propuesta:

- Separar los rótulos de las vistas de inventario de las acciones comerciales. Con comercio deshabilitado, usar “Inventario del comerciante” y “Mis objetos” según las acciones disponibles, y mostrar “Saquear”, “Hurtar”, “Asaltar” o “Implantar” sólo cuando correspondan.
- Ocultar Comprar, Vender y la confirmación de intercambio cuando `barter` esté deshabilitado o el estado del NPC impida comerciar.
- Elegir automáticamente un modo permitido si la configuración cambia con la vista abierta; descartar o invalidar selecciones comerciales obsoletas y revalidar antes de ejecutar.
- Conservar el saqueo habilitado aunque la compraventa esté deshabilitada.

Aceptación: cubrir todas las combinaciones relevantes de compraventa, saqueo, hurto e implantación, incluidos cambios recibidos mientras el jugador tiene abierta la vista. Confirmar tanto la interfaz como el rechazo del servidor ante una operación comercial no permitida.

## Orden propuesto durante la investigación inicial

1. Resolver las decisiones de identificación y la selección histórica de Varka.
2. Corregir las vistas y acciones de comerciantes, y añadir la transferencia de saqueo con permisos y atomicidad en el servidor. Revisar las otras interacciones que usan edición general.
3. Implementar identificación como estado de las copias y aplicar sus bloqueos de manera transversal.
4. Preparar y verificar la reparación puntual de Varka con el nivel y reemplazo confirmados; aplicar con control de concurrencia.
5. Ejecutar pruebas de dominio, interfaz, persistencia y autorización como jugador/GM; verificar carreras de saqueo sin tocar inventarios reales para probar. Ejecutar typecheck y construir con `npm run build:v2 -- --emptyOutDir=false`. Revisar visualmente los flujos finales en TaleSpire.

Las correcciones de comerciantes pueden prepararse mientras se resuelven las decisiones de identificación e historial.

## Verificación inicial

Se ejecutaron `merchant-interaction`, `invocation-preview`, `phb-warlock-builder`, `phb-warlock-ui` y `supabase-campaign-content-store`: 162 de 163 pruebas pasaron en la primera ejecución. La prueba de las 270 combinaciones de raza/trasfondo agotó el límite de 5 segundos; se repitió aisladamente con límite de 20 segundos y pasó (2,71 segundos de ejecución de prueba). No se cambió la configuración de tests.

Estas pruebas establecen una referencia del comportamiento existente. No cubren por sí solas una transferencia de saqueo real con permisos de jugador ni las nuevas condiciones de identificación. No se construyó una nueva versión durante esta fase de investigación.
