# Combate de TaleSpire

El panel GM muestra las miniaturas de la cola nativa, en su orden y con su turno
activo. Los cambios llegan por eventos de iniciativa y se comprueban cada 2,5
segundos. Consultar una cola no permite saber si TS está en exploración o en modo
por turnos: la sección Combate permanece disponible en ambos modos.

Cada tarjeta muestra la imagen de biblioteca de la miniatura, su nombre y la
información de la criatura o personaje asociado. Los PG tienen una columna propia
que ocupa todo el alto de la tarjeta, junto a las columnas de CA e iniciativa.
Los controles de daño, curación y condiciones están agrupados al expandir; la
ficha de la criatura se abre junto con los detalles del participante.

El centro de la tarjeta tiene tres bloques alineados a la izquierda: identidad,
estadísticas y estados. El nombre ocupa la cabecera y debajo se muestran clase o
tipo y nivel o VD, manteniendo este último visible aunque la descripción sea
larga. Cada estadística tiene su etiqueta sobre el valor: velocidad, percepción
pasiva y, cuando la hoja tenga una característica de lanzamiento válida, CD y
ataque de conjuros. La grilla usa dos columnas y pasa a cuatro cuando el centro
dispone de al menos 240px. Turno activo, concentración, condiciones y agotamiento
comparten una fila propia al pie, separada por una línea sutil. Una regla genérica
de los resúmenes usa `:where` para que no imponga centrado sobre esta estructura.
El nombre bajo el retrato ocupa como máximo dos líneas y conserva el nombre
completo en su tooltip. Los datos de identidad completos del personaje están al
expandir la tarjeta. El aviso de asociación pendiente usa una sola línea de
texto y mantiene sus dos acciones y su fondo rojo.

La imagen sigue el modelo activo y se actualiza al cambiar de forma. Se conserva
el elemento DOM original para no perder imágenes dibujadas en un canvas. Si el
modelo no proporciona una imagen, se muestra un marcador de reemplazo. No se
encontró una llamada documentada para extraer el retrato exacto de la cola nativa.
La API utilizada tampoco permite
seleccionar una miniatura del tablero haciendo clic en la tarjeta.

La carga es completamente automática y usa el `boardAssetId` de la forma activa
de la instancia del tablero. Se validan también los errores que la API devuelve
como objetos `{ cause: ... }`, para no guardarlos como si fueran un catálogo válido.
Si la imagen todavía no está disponible, se vuelve a intentar a los 1, 3 y 10
segundos, y luego cada 30 segundos. Los eventos de paquetes de contenido y cambios
de forma invalidan la caché y actualizan la imagen inmediatamente. Los errores
se registran en consola y en el contexto del reporte de problemas, sin interrumpir
el combate. No se requiere cargar ni asignar imágenes manualmente.

### Diagnosticar imágenes que no aparecen

En el menú `⋯` del GM, abrir **Diagnóstico de imágenes**. Muestra la versión y
compilación cargadas, las funciones de API disponibles y el estado de cada
participante. El informe incluye el ID de instancia, modelo activo, cantidad de
formas y paquetes, etapa pendiente o fallida, error nativo e intentos de carga.
También inspecciona el elemento insertado: etiqueta, tamaño visible, dimensiones
del canvas y estado de carga de los recursos de imagen. Recibir un elemento no
se interpreta como confirmación de que se haya dibujado correctamente.

**Actualizar diagnóstico** captura el estado actual; **Reintentar imágenes**
solicita otra carga sin cambiar el combate. Después de reintentar, actualizar el
diagnóstico para ver el resultado. **Copiar informe** permite compartir el JSON;
si el portapapeles no está disponible, selecciona el texto para copiar con Ctrl+C.
El mismo diagnóstico se incluye en el contexto del reporte de problemas. No
captura píxeles, URLs de recursos ni el contenido completo de los paquetes.

Las asociaciones se guardan en `gm.miniatureAssociations`, por campaña e ID de
instancia de miniatura. Se pueden crear, cambiar y quitar desde cada tarjeta.
Un vínculo explícito tiene prioridad sobre la miniatura guardada en una hoja.
Quitar una asociación conserva un registro vacío para evitar restaurar
automáticamente ese vínculo anterior.

La iniciativa se puede tirar desde la tarjeta o ingresar manualmente al
expandirla. Las tiradas enviadas desde una hoja de personaje asociado se cargan
automáticamente. La identidad de la hoja acompaña a la tirada hasta su resolución;
el GM no necesita recibir primero un resumen de estadísticas para identificarla.
Las tiradas solicitadas por el GM usan una referencia interna para distinguir
miniaturas con nombres iguales. Cancelar una tirada libera el botón; limpiar las
iniciativas descarta también sus resultados pendientes.

La lista conserva siempre el orden de TS. Las flechas muestran la posición
recomendada por iniciativa; el GM modifica el orden desde TS. Los empates
conservan el orden relativo de la cola y quienes no tienen iniciativa quedan al
final de la recomendación. Se muestran avisos rojos con texto para iniciativas
pendientes o asociaciones ausentes/inválidas.

El combate se guarda automáticamente en un único encuentro reservado por campaña
(`ACTIVE_COMBAT_ID` en `CombatSessionRepository`). Cada cambio de cola o estado
actualiza ese mismo registro mediante la persistencia habitual de la campaña y
sus controles de revisión. No hace falta crear, elegir ni guardar encuentros.
El formato de fragmentos existente permite actualizar sólo el fragmento de este
combate; no requiere cambios de tablas ni de permisos en Supabase.

Al reabrir, se recuperan participantes, iniciativas, orden, turno activo y ronda,
además de PG actuales, máximos y temporales, CA, condiciones y visibilidad de las
criaturas. Los personajes conservan su iniciativa y actualizan sus estadísticas
desde su hoja. La cola de TS continúa definiendo los participantes y el orden:
reconciliarla conserva el estado de quienes siguen presentes y retira a quienes
ya no están. Una cola vacía guarda el combate vacío. Los encuentros anteriores
permanecen intactos en el almacenamiento y no se muestran en este panel.

## Verificación

Pruebas principales: `combat-session.test.ts`, `native-combat-ui.test.ts`,
`gm-workspace.test.ts`, `encounter.test.ts`, `encounter-application.test.ts`,
`talespire-miniature.test.ts` y `actions-and-dice.test.ts`. La persistencia de un
único fragmento se verifica también con `campaign-fragments.test.ts` y
`supabase-granular-campaign-repository.test.ts`.

Vista manual con datos ficticios y repositorio en memoria:
`/test/fixtures/native-combat-preview.html`. Acepta `?width=360&theme=light`
para revisar la vista estrecha y el tema claro con Vite. No accede a datos reales.
