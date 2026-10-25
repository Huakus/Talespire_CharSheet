# Editor de monstruos

El editor agrupa identidad, combate, características, aptitudes, defensas,
rasgos, acciones y conjuros. Guardar y cancelar están en una barra superior que
permanece visible al desplazar el formulario. Nombre, velocidad, sentidos e
idiomas disponen de todo el ancho; los campos cortos se agrupan por función.
Las características muestran su modificador y lo actualizan al editar el valor.

Las defensas usan una tabla de tipos de daño en español, con columnas independientes
para vulnerabilidad, resistencia e inmunidad. Las selecciones adicionales de
contenido importado se conservan como opciones fuera de la tabla. La inmunidad
a condiciones usa etiquetas ajustadas al ancho, sin un panel de scroll adicional.
Los conjuros tienen búsqueda por texto y filtro de seleccionados; el filtro no
altera las selecciones ni descarta nombres ausentes del catálogo cargado.

Cada rasgo o acción se edita con nombre, descripción y uso opcional, y permite
agregar o quitar entradas. El formulario mantiene cada colección como JSON en
un campo oculto; `bindMonsterEditor` reconstruye las filas después de restaurar
el borrador. Los cambios de filas sincronizan ese JSON antes de que
`FormDraftStore` capture el formulario y antes de guardar. Esto permite conservar
saltos de línea y caracteres `|` en las descripciones. El modelo guardado sigue
usando las mismas listas de `MonsterFeature`; no cambia el almacenamiento.

Las pruebas de `monster-editor.test.ts` verifican edición y creación, selecciones
de defensas, descripciones multilínea, nombres importados, navegación con
borradores y recuperación tras un fallo al guardar.
