# Entrega 1.0.41 — 2026-10-30

- Las hojas visibles aparecen antes que las ocultas; dentro de cada sección se ordenan alfabéticamente. La terminología de administración pasa de Archivado a Oculto, con acciones Mostrar/Ocultar. El estado existente conserva su significado: excluir del selector de jugadores sin borrar la hoja ni quitarla del combate.
- Las tarjetas comienzan contraídas y muestran sólo el nombre, el control de despliegue y Abrir. Los detalles incluyen clase/nivel/jugador, estado, indicación de creación con tutorial, nombre editable, exportación, eliminación y asignación de grupo.
- La procedencia del tutorial se muestra sólo cuando existe el registro de creación guiada. Las hojas sin ese registro se identifican como «Sin registro de tutorial»; no se les atribuye una procedencia inventada.
- La vinculación de miniaturas se retira de la administración y de la cabecera de la hoja. Se conserva la asociación de participantes desde combate y las asociaciones existentes.
- Los grupos son persistentes y colapsables. Cada hoja pertenece como máximo a un grupo; el resto aparece en Sin grupo. Se pueden crear y renombrar grupos, mover hojas, disolver el grupo sin borrar hojas y mostrar/ocultar todos sus miembros. Las cabeceras indican cantidades visibles y ocultas.
- Las acciones conjuntas se guardan en una sola operación sobre el repositorio de campaña. Se preservan cambios ajenos y se reintentan conflictos de persistencia; una composición de grupo desactualizada se rechaza para no administrar integrantes inesperados. Eliminar una hoja limpia su pertenencia al grupo.
- Los grupos se serializan en el fragmento existente de configuración GM. Las campañas antiguas sin grupos siguen siendo válidas; se conserva el campo interno de archivo por compatibilidad. No se requieren tablas ni migraciones nuevas.

Verificación enfocada: TypeScript y 79 pruebas de administración, organización, serialización remota, selección de jugadores, combate y CSS calculado. Se verifica que los detalles estén ocultos al contraer las tarjetas, la apertura no las expanda, la visibilidad conjunta sea atómica y los cambios simultáneos respeten las versiones.

Suite general: 144 archivos y 1321 pruebas aprobadas. Después de reforzar la exclusión mutua de membresías frente a fusiones concurrentes, pasaron otras 23 pruebas enfocadas de organización, UI, fragmentos y merge.
