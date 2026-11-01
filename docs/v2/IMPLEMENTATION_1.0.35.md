# Entrega 1.0.35 — 2026-10-27

## Cambios

| Pedido | Implementación |
| --- | --- |
| Eliminar personaje no responde | Diálogo de confirmación dentro del documento; no usa `window.confirm`. Cancelar no escribe; confirmar ejecuta la eliminación con limpieza de referencias existente. |
| Experiencia independiente | Agregar PX sólo modifica experiencia. El nivel actual permanece; al alcanzar el próximo umbral aparece brillo dorado y un botón que abre el tutorial. Se conserva el excedente de PX. El ascenso manual del menú sigue disponible para campañas por hitos. |
| Descripciones antes de elegir | Vista previa en los selectores del tutorial para conjuros de todas las clases, dotes, estilos, maniobras, metamagia y demás opciones con descripción en el catálogo. Se puede consultar sin seleccionar; incluye opciones no disponibles. Los conjuros copiados de mago incluyen su descripción propia. |
| Iniciativa de la hoja | El resultado nativo usa personaje, combate, época e identidad de tirada para escribir directamente en el repositorio compartido. Sólo completa `null`, sin sustituir cero ni valores negativos. La sección Iniciativa se quitó de la hoja; el botón de cabecera permanece. |
| Solapas | Varias filas al faltar ancho, sin scroll horizontal. |
| Tarjetas de administración | Identidad a la izquierda, acciones a la derecha, nombre/vínculo agrupados y estado de vinculación explícito. |
| Vincular en el tablero actual | Botón directo «Vincular seleccionada». Seleccionar una sola miniatura en TaleSpire y pulsarlo. Hoja, asociación persistente y participante existente se actualizan juntos; se libera el vínculo anterior. |
| Salvaciones | Cada una debajo de su característica. Verde si supera su modificador, rojo si es inferior; muestra también el número para no depender sólo del color. |
| Imágenes de combate | Quitadas; las tarjetas no solicitan miniaturas. Se conserva el nombre nativo, incluso sin ficha asociada. Las imágenes de las hojas y sus adaptadores siguen disponibles. |
| Identidades | Se guardan por separado ID/nombre nativo, referencia a ficha y nombre individual del combatiente. Al asociar una criatura se elige el menor sufijo libre: `Goblin`, `Goblin 1`, etc. Los nombres ya guardados se conservan. Se editan desde la tarjeta expandida; un personaje usa siempre el nombre de su hoja. |
| Espacio de combate | CA en una insignia pequeña; características/salvaciones, defensas y accesos a acciones en la tarjeta contraída. En la parte expandida quedan reglas, habilidades, sentidos, idiomas y controles de edición, sin duplicar el bloque compacto de la criatura. |

La iniciativa ya no espera un mensaje al GM: el cambio llega por el mecanismo de persistencia y actualización de campaña. TaleSpire continúa siendo el origen del resultado del dado. Las tiradas enviadas antes de limpiar iniciativa o cambiar la asociación se ignoran; no se crean participantes fuera de combate.

El campo nuevo `combatantName` de la asociación admite datos anteriores (`null` por defecto). No se requiere una migración SQL: forma parte del JSON existente. Las ediciones de la ficha de criatura actualizan estadísticas y referencia, conservando el nombre individual. Las tareas de desarrollo no modificaron `.localstorage/` ni registros de campaña en la base.

## Nombre de miniatura en TaleSpire

La [API pública de Symbiotes](https://symbiote-docs.talespire.com/api_doc_v0_1.md.html) expone lectura y eventos de nombre, pero no una operación de renombrado. Se agregó «Copiar nombre para TaleSpire» en cada participante, usando `system.clipboard.setText` si existe y el portapapeles web como alternativa. Luego el GM pega el nombre en el editor nativo de la miniatura. La UI explica este límite y no presenta una acción de renombrado automático inexistente.

## Verificación

Pruebas de regresión sobre confirmación/cancelación de eliminación, vinculación desde administración y limpieza de referencias, iniciativa persistida sin mensajes TS, conservación de cero y valores negativos, resultados tardíos, nombres individuales, acumulación de PX y apertura voluntaria del tutorial, descripciones de conjuros/dotes y disposición semántica de salvaciones.

La captura de Computer Use no mostró de forma fiable la ventana solicitada. No se actuó sobre el tablero para intentar forzar la captura. La verificación de interfaz se realizó mediante pruebas de DOM; queda pendiente revisar la presentación dentro de TaleSpire con el tamaño de panel utilizado en partida.

El paquete se genera localmente; no se publica en GitHub ni mod.io. El manifiesto de desarrollo conserva «Code» y su canal aislado; el ZIP restaura el nombre/canal públicos. Recargar el Symbiote tras instalar la nueva compilación.

### Resultado final

- `npm run typecheck`: correcto.
- `npx vitest run test/v2 --maxWorkers=3 --testTimeout=60000`: **140 archivos y 1290 pruebas correctas**.
- `npm run package:modio`: correcto; compila con `--emptyOutDir=false`. Sólo permanece la advertencia de tamaño del bundle.
- ZIP verificado: `release/Talespire_CharSheet-1.0.35-modio.zip`, seis archivos, versión 1.0.35 y canal público `10f34bc9-dfa2-4623-a691-bf0a1fb2d9d4`.
- Hash de fuentes incorporado y cotejado con el código actual: `9f8dc3311ac122a73245ad38da634632123ff11923688a7f9b648f52c45f8c31`.
- SHA256 del ZIP: `44A6D2517C52C22795B6A5B13035DA54B97EE734AA0B5D0F75E00EB5CCEBEE5F`.
